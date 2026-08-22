import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

const MPESA_DAILY_LIMIT = 500000; // KES 500,000

export default createEndpoint({
  description: 'Disburses an approved financing request via bank transfer or M-Pesa, creates loan, transaction, and journal entries',
  inputSchema: z.object({
    requestId: z.string(),
    disbursementMethod: z.enum(['Bank Transfer', 'M-Pesa']),
    bankAccountId: z.string().optional(),
    mpesaPhoneNumber: z.string().optional(),
    amount: z.number(),
    comments: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    loanReference: z.string(),
    transactionReference: z.string(),
    journalEntryId: z.string(),
  }),
  execute: async ({ input, context }) => {
    const req = await zite.financingRequests.findOne({ id: input.requestId });
    if (!req) throw new Error('Financing request not found');
    if (req.status !== 'Approved') throw new Error(`Cannot disburse in "${req.status}" status. Must be "Approved".`);

    const disbursedBy = `${context.user.firstName || ''} ${context.user.lastName || ''}`.trim() || context.user.email;

    // Resolve entities
    const borrowerEntityId = req.borrowerEntity
      ? (Array.isArray(req.borrowerEntity) ? req.borrowerEntity[0] : req.borrowerEntity)
      : (req.requestingEntity ? (Array.isArray(req.requestingEntity) ? req.requestingEntity[0] : req.requestingEntity) : undefined);
    const programId = req.program
      ? (Array.isArray(req.program) ? req.program[0] : req.program) : undefined;

    // --- M-Pesa daily limit validation ---
    if (input.disbursementMethod === 'M-Pesa') {
      if (!input.mpesaPhoneNumber) throw new Error('Phone number is required for M-Pesa disbursement');
      if (input.amount > MPESA_DAILY_LIMIT) {
        throw new Error(`Amount KES ${input.amount.toLocaleString()} exceeds M-Pesa daily limit of KES ${MPESA_DAILY_LIMIT.toLocaleString()}. Use Bank Transfer instead.`);
      }
      // Check total M-Pesa disbursements today
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayResult = await zite.sql({
        query: `SELECT COALESCE(SUM("amount"), 0) AS total FROM "Transactions" WHERE "paymentMethod" = 'M-Pesa' AND "type" = 'Disbursement' AND "status" = 'Completed' AND created_at >= $1`,
        params: [todayStart.toISOString()],
      });
      const todayTotal = Number((todayResult.rows[0] as any)?.total || 0);
      if (todayTotal + input.amount > MPESA_DAILY_LIMIT) {
        throw new Error(`M-Pesa daily limit reached. Today's total: KES ${todayTotal.toLocaleString()}. Adding KES ${input.amount.toLocaleString()} would exceed KES ${MPESA_DAILY_LIMIT.toLocaleString()}.`);
      }
    }

    // --- Bank Transfer: resolve bank account ---
    let resolvedBankAccountId = input.bankAccountId;
    if (input.disbursementMethod === 'Bank Transfer') {
      if (!resolvedBankAccountId || resolvedBankAccountId === 'default') {
        // Auto-resolve from entity's primary bank account
        if (borrowerEntityId) {
          const bankResult = await zite.sql({
            query: `SELECT ba.id FROM "BankAccounts" ba JOIN "BankAccountsEntities" bae ON bae."bankAccountsId" = ba.id WHERE bae."entitiesId" = $1 AND ba."status" = 'Active' AND ba."accountType" != 'Mobile Money' ORDER BY ba."isPrimary" DESC NULLS LAST LIMIT 1`,
            params: [borrowerEntityId],
          });
          resolvedBankAccountId = (bankResult.rows[0] as any)?.id;
        }
        if (!resolvedBankAccountId) {
          throw new Error('No active bank account found for this entity. Please add a bank account during onboarding.');
        }
      }
    }

    // Resolve tenor: use request's tenorDays, fall back to program's creditPeriodDays
    let tenorDays = req.tenorDays ? Number(req.tenorDays) : 0;
    if (!tenorDays && programId) {
      const progResult = await zite.programs.findOne({ id: programId });
      if (progResult?.creditPeriodDays) tenorDays = Number(progResult.creditPeriodDays);
    }

    // --- 1. Create loan ---
    const loanRef = `LN-${Date.now().toString(36).toUpperCase()}`;
    const loan = await zite.loans.create({
      record: {
        loanReference: loanRef,
        entity: borrowerEntityId || null,
        program: programId || null,
        productType: req.productType || null,
        principal: input.amount,
        outstandingBalance: input.amount,
        interestRate: req.interestRate || 0,
        status: 'Active',
        disbursedAt: new Date().toISOString(),
        maturityDate: tenorDays
          ? new Date(Date.now() + tenorDays * 86400000).toISOString().slice(0, 10)
          : null,
        daysOverdue: 0,
        borrowerEntityType: null,
        financingRequests: input.requestId,
      },
    });

    // --- 2. Create disbursement transaction ---
    const txnRef = `TXN-${Date.now().toString(36).toUpperCase()}`;
    const txnRecord: Record<string, any> = {
      reference: txnRef,
      loan: loan.id,
      type: 'Disbursement',
      amount: input.amount,
      paymentMethod: input.disbursementMethod === 'M-Pesa' ? 'M-Pesa' : 'Bank Transfer',
      status: 'Completed',
    };
    if (input.disbursementMethod === 'M-Pesa' && input.mpesaPhoneNumber) {
      txnRecord.phoneNumber = input.mpesaPhoneNumber;
      txnRecord.mPesaReceipt = `MP${Date.now().toString(36).toUpperCase()}`;
    }
    await zite.transactions.create({ record: txnRecord });

    // --- 3. Create double-entry journal entry ---
    // Map product type to the correct receivable GL account
    const productGlMap: Record<string, string> = {
      'Invoice Finance': '1110',       // Loans Receivable
      'Reverse Factoring': '1170',     // Reverse Factoring Receivable
      'Invoice Discounting': '1160',   // Invoice Discounting Receivable
      'Blended Finance': '1180',       // Blended Finance Receivable
      'Leasing': '1140',              // Lease Receivable
      'Warehouse Receipt': '1150',     // Warehouse Receipt Advances
    };
    const debitAccountNumber = productGlMap[req.productType || ''] || '1110'; // fallback to Loans Receivable
    const creditAccountNumber = input.disbursementMethod === 'M-Pesa' ? '1210' : '1200';

    const debitAccountResult = await zite.sql({
      query: `SELECT id, "accountName" FROM "GlAccounts" WHERE "accountNumber" = $1 AND "isActive" = true LIMIT 1`,
      params: [debitAccountNumber],
    });
    const creditAccountResult = await zite.sql({
      query: `SELECT id, "accountName" FROM "GlAccounts" WHERE "accountNumber" = $1 AND "isActive" = true LIMIT 1`,
      params: [creditAccountNumber],
    });

    const debitAccount = debitAccountResult.rows[0] as any;
    const creditAccount = creditAccountResult.rows[0] as any;

    if (!debitAccount?.id) throw new Error(`GL account ${debitAccountNumber} not found for product type "${req.productType}". Please seed GL accounts.`);
    if (!creditAccount?.id) throw new Error(`GL account ${creditAccountNumber} not found. Please seed GL accounts.`);

    // Create the journal entry
    const journalEntry = await zite.journalEntries.create({
      record: {
        entryDate: new Date().toISOString().slice(0, 10),
        reference: `JE-DISB-${loanRef}`,
        description: `Disbursement of ${req.productType || 'Loan'} via ${input.disbursementMethod} for ${loanRef} — KES ${input.amount.toLocaleString()}`,
        status: 'Posted',
        totalAmount: input.amount,
        postedBy: disbursedBy,
        entity: borrowerEntityId || null,
        program: programId || null,
        financingRequest: input.requestId,
        loan: loan.id,
      },
    });

    // Debit: Product-specific receivable
    await zite.journalLines.create({
      record: {
        journalEntry: journalEntry.id,
        glAccount: debitAccount.id,
        debitAmount: input.amount,
        creditAmount: 0,
        narration: `DR: ${debitAccount.accountName} — ${loanRef} disbursed to borrower`,
      },
    });

    // Credit: Bank / M-Pesa Float
    await zite.journalLines.create({
      record: {
        journalEntry: journalEntry.id,
        glAccount: creditAccount.id,
        debitAmount: 0,
        creditAmount: input.amount,
        narration: `CR: ${creditAccount.accountName} — ${input.disbursementMethod} for ${loanRef}`,
      },
    });

    // --- 4. Update financing request to Disbursed ---
    const updateData: Record<string, any> = {
      status: 'Disbursed',
      loan: loan.id,
    };
    if (input.comments) {
      updateData.comments = (req.comments ? req.comments + '\n' : '') + `[Disbursement] ${disbursedBy}: ${input.comments}`;
    }
    await zite.financingRequests.update({ id: input.requestId, record: updateData });

    // --- 5. Update invoice statuses ---
    if (req.invoices) {
      const invoiceIds = Array.isArray(req.invoices) ? req.invoices : [req.invoices];
      for (const invId of invoiceIds) {
        await zite.invoices.update({ id: invId, record: { status: 'Financed' } });
      }
    }

    return {
      success: true,
      loanReference: loanRef,
      transactionReference: txnRef,
      journalEntryId: journalEntry.id,
    };
  },
});
