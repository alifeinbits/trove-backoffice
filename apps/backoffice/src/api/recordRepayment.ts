import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'Records a loan repayment (bank transfer or M-Pesa), creates transaction, posts journal entries, and auto-settles loan when balance reaches zero',
  authenticated: true,
  inputSchema: z.object({
    loanId: z.string(),
    amount: z.number().positive(),
    paymentMethod: z.enum(['Bank Transfer', 'M-Pesa']),
    mPesaReceipt: z.string().optional(),
    phoneNumber: z.string().optional(),
    bankReference: z.string().optional(),
    comments: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    transactionId: z.string(),
    journalEntryId: z.string(),
    newOutstanding: z.number(),
    loanSettled: z.boolean(),
  }),
  execute: async ({ input, context }) => {
    const loan = await zite.loans.findOne({ id: input.loanId });
    if (!loan) throw new ZiteError({ code: 'NOT_FOUND', message: 'Loan not found' });
    if (loan.status === 'Settled') throw new ZiteError({ code: 'BAD_REQUEST', message: 'Loan is already settled' });
    if (loan.status === 'Written Off') throw new ZiteError({ code: 'BAD_REQUEST', message: 'Cannot record repayment on a written-off loan' });

    const outstanding = loan.outstandingBalance || 0;
    if (input.amount > outstanding * 1.01) {
      throw new ZiteError({ code: 'BAD_REQUEST', message: `Amount KES ${input.amount.toLocaleString()} exceeds outstanding balance of KES ${outstanding.toLocaleString()}` });
    }

    const recordedBy = `${context.user.firstName || ''} ${context.user.lastName || ''}`.trim() || context.user.email;

    // Determine new outstanding and whether to settle
    const newOutstanding = Math.max(0, Math.round((outstanding - input.amount) * 100) / 100);
    const loanSettled = newOutstanding <= 0;

    // Split repayment: compute interest portion from penalty accrued
    const penaltyAmount = loan.penaltyAmount || 0;
    const penaltyPortion = Math.min(penaltyAmount, input.amount);
    const principalPortion = input.amount - penaltyPortion;

    // 1. Create transaction
    const txnRef = `TXN-R-${Date.now().toString(36).toUpperCase()}`;
    const txn = await zite.transactions.create({
      record: {
        reference: input.bankReference || txnRef,
        loan: input.loanId,
        type: 'Repayment',
        amount: input.amount,
        paymentMethod: input.paymentMethod,
        mPesaReceipt: input.mPesaReceipt || null,
        phoneNumber: input.phoneNumber || null,
        status: 'Completed',
      },
    });

    // 2. Update loan balance and status
    const loanUpdate: Record<string, any> = {
      outstandingBalance: newOutstanding,
    };
    if (loanSettled) {
      loanUpdate.status = 'Settled';
      loanUpdate.daysOverdue = 0;
    }
    if (penaltyPortion > 0) {
      loanUpdate.penaltyAmount = Math.max(0, penaltyAmount - penaltyPortion);
    }
    await zite.loans.update({ id: input.loanId, record: loanUpdate });

    // 3. Post double-entry journal entries
    // Determine GL accounts based on product type
    const productGlMap: Record<string, string> = {
      'Invoice Finance': '1110',
      'Reverse Factoring': '1170',
      'Invoice Discounting': '1160',
      'Blended Finance': '1180',
      'Leasing': '1140',
      'Warehouse Receipt': '1150',
    };
    const receivableAcctNum = productGlMap[loan.productType || ''] || '1110';
    const cashAcctNum = input.paymentMethod === 'M-Pesa' ? '1210' : '1200';

    const [receivableResult, cashResult] = await Promise.all([
      zite.sql({ query: `SELECT id, "accountName" FROM "GlAccounts" WHERE "accountNumber" = $1 AND "isActive" = true LIMIT 1`, params: [receivableAcctNum] }),
      zite.sql({ query: `SELECT id, "accountName" FROM "GlAccounts" WHERE "accountNumber" = $1 AND "isActive" = true LIMIT 1`, params: [cashAcctNum] }),
    ]);

    const receivableAcct = receivableResult.rows[0] as any;
    const cashAcct = cashResult.rows[0] as any;

    if (!receivableAcct?.id || !cashAcct?.id) {
      // Gracefully skip journal if GL not seeded
      return {
        success: true,
        transactionId: txn.id,
        journalEntryId: '',
        newOutstanding,
        loanSettled,
      };
    }

    const entityId = Array.isArray(loan.entity) ? loan.entity[0] : loan.entity;
    const programId = Array.isArray(loan.program) ? loan.program[0] : loan.program;

    const je = await zite.journalEntries.create({
      record: {
        entryDate: new Date().toISOString().slice(0, 10),
        reference: `JE-REPAY-${loan.loanReference || input.loanId.slice(0, 8)}`,
        description: `Repayment of KES ${input.amount.toLocaleString()} via ${input.paymentMethod} for ${loan.loanReference}${loanSettled ? ' (SETTLED)' : ''}`,
        status: 'Posted',
        totalAmount: input.amount,
        postedBy: recordedBy,
        entity: entityId || null,
        program: programId || null,
        loan: input.loanId,
        financingRequest: null,
      },
    });

    // DR Cash/Bank (money coming in)
    await zite.journalLines.create({
      record: {
        journalEntry: je.id,
        glAccount: cashAcct.id,
        debitAmount: input.amount,
        creditAmount: 0,
        narration: `DR: ${cashAcct.accountName} — Repayment received for ${loan.loanReference}`,
      },
    });

    // CR Receivable (reducing the loan balance)
    await zite.journalLines.create({
      record: {
        journalEntry: je.id,
        glAccount: receivableAcct.id,
        debitAmount: 0,
        creditAmount: input.amount,
        narration: `CR: ${receivableAcct.accountName} — ${loan.loanReference} repayment${loanSettled ? ' (loan settled)' : ''}`,
      },
    });

    return {
      success: true,
      transactionId: txn.id,
      journalEntryId: je.id,
      newOutstanding,
      loanSettled,
    };
  },
});
