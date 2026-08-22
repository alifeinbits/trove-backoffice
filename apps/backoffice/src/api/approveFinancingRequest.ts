import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'Checker/FI approves or rejects a financing request. Auto-disburses if FI pricing has autoDisburse enabled.',
  inputSchema: z.object({
    requestId: z.string(),
    decision: z.enum(['Approved', 'Rejected']),
    comments: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    newStatus: z.string(),
    autoDisbursed: z.boolean(),
    loanReference: z.string().optional(),
  }),
  execute: async ({ input, context }) => {
    const req = await zite.financingRequests.findOne({ id: input.requestId });
    if (!req) throw new Error('Financing request not found');
    if (req.status !== 'Pending Approval' && req.status !== 'Under Review')
      throw new Error(`Cannot approve/reject in "${req.status}" status`);

    const approvedBy = `${context.user.firstName || ''} ${context.user.lastName || ''}`.trim() || context.user.email;

    if (input.decision === 'Rejected') {
      await zite.financingRequests.update({
        id: input.requestId,
        record: {
          status: 'Rejected',
          approvedBy,
          approvedAt: new Date().toISOString(),
          rejectionReason: input.comments || null,
          ...(input.comments ? { comments: input.comments } : {}),
        },
      });
      return { success: true, newStatus: 'Rejected', autoDisbursed: false };
    }

    // Decision is Approved — check autoDisburse on FI pricing
    const programId = req.program
      ? (Array.isArray(req.program) ? req.program[0] : req.program) : undefined;
    const borrowerEntityId = req.borrowerEntity
      ? (Array.isArray(req.borrowerEntity) ? req.borrowerEntity[0] : req.borrowerEntity)
      : (req.requestingEntity ? (Array.isArray(req.requestingEntity) ? req.requestingEntity[0] : req.requestingEntity) : undefined);

    // Look up FI pricing for this program to check autoDisburse
    let autoDisburse = false;
    let pricing: any = null;
    if (programId) {
      const pricingResult = await zite.sql({
        query: `
          SELECT fpp.* FROM "FiProgramPricing" fpp
          JOIN "FiProgramPricingPrograms" fppg ON fppg."fiProgramPricingId" = fpp.id
          WHERE fppg."programsId" = $1 AND fpp."status" = 'Active' AND fpp."autoDisburse" = true
          LIMIT 1
        `,
        params: [programId],
      });
      if (pricingResult.rows.length > 0) {
        autoDisburse = true;
        pricing = pricingResult.rows[0] as any;
      }
    }

    if (!autoDisburse) {
      // Just mark as Approved, user will disburse manually
      await zite.financingRequests.update({
        id: input.requestId,
        record: {
          status: 'Approved',
          approvedBy,
          approvedAt: new Date().toISOString(),
          ...(input.comments ? { comments: input.comments } : {}),
        },
      });
      return { success: true, newStatus: 'Approved', autoDisbursed: false };
    }

    // --- Auto-disburse flow ---
    const amount = req.requestedAmount || req.financeableAmount || 0;
    const loanRef = `LN-${Date.now().toString(36).toUpperCase()}`;

    // Resolve tenor
    let tenorDays = req.tenorDays ? Number(req.tenorDays) : 0;
    if (!tenorDays && programId) {
      const progResult = await zite.programs.findOne({ id: programId });
      if (progResult?.creditPeriodDays) tenorDays = Number(progResult.creditPeriodDays);
    }

    // 1. Create the loan
    const loan = await zite.loans.create({
      record: {
        loanReference: loanRef,
        entity: borrowerEntityId || null,
        program: programId || null,
        productType: req.productType || null,
        principal: amount,
        outstandingBalance: amount,
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

    // 2. Create disbursement transaction
    const txnRef = `TXN-${Date.now().toString(36).toUpperCase()}`;
    await zite.transactions.create({
      record: {
        reference: txnRef,
        loan: loan.id,
        type: 'Disbursement',
        amount,
        paymentMethod: 'Bank Transfer',
        status: 'Completed',
      },
    });

    // 3. Create journal entry + lines for the disbursement
    const journalEntry = await zite.journalEntries.create({
      record: {
        entryDate: new Date().toISOString().slice(0, 10),
        reference: `DISB-${loanRef}`,
        description: `Auto-disbursement for financing request #${req.requestNumber || ''} — ${loanRef}`,
        status: 'Posted',
        totalAmount: amount,
        postedBy: approvedBy,
        entity: borrowerEntityId || null,
        program: programId || null,
        financingRequest: input.requestId,
        loan: loan.id,
      },
    });

    // Debit: Loans Receivable (Asset), Credit: Bank/Cash (Asset)
    // Find or use default GL accounts
    const loansReceivableResult = await zite.sql({
      query: `SELECT id FROM "GlAccounts" WHERE "accountName" ILIKE '%loan%receivable%' AND "isActive" = true LIMIT 1`,
    });
    const bankAccountResult = await zite.sql({
      query: `SELECT id FROM "GlAccounts" WHERE ("accountName" ILIKE '%bank%' OR "accountName" ILIKE '%cash%') AND "accountType" = 'Asset' AND "isActive" = true LIMIT 1`,
    });

    const loansReceivableId = (loansReceivableResult.rows[0] as any)?.id;
    const bankAccountId = (bankAccountResult.rows[0] as any)?.id;

    if (loansReceivableId) {
      await zite.journalLines.create({
        record: {
          journalEntry: journalEntry.id,
          glAccount: loansReceivableId,
          debitAmount: amount,
          creditAmount: 0,
          narration: `Loan disbursed: ${loanRef}`,
        },
      });
    }
    if (bankAccountId) {
      await zite.journalLines.create({
        record: {
          journalEntry: journalEntry.id,
          glAccount: bankAccountId,
          debitAmount: 0,
          creditAmount: amount,
          narration: `Cash out for loan: ${loanRef}`,
        },
      });
    }

    // 4. Update financing request to Disbursed
    await zite.financingRequests.update({
      id: input.requestId,
      record: {
        status: 'Disbursed',
        approvedBy,
        approvedAt: new Date().toISOString(),
        loan: loan.id,
        ...(input.comments ? { comments: input.comments } : {}),
      },
    });

    // 5. Update linked invoices to Financed
    if (req.invoices) {
      const invoiceIds = Array.isArray(req.invoices) ? req.invoices : [req.invoices];
      for (const invId of invoiceIds) {
        await zite.invoices.update({ id: invId, record: { status: 'Financed' } });
      }
    }

    return { success: true, newStatus: 'Disbursed', autoDisbursed: true, loanReference: loanRef };
  },
});
