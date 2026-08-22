import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'Matches uploaded bank statement entries against system transactions',
  authenticated: true,
  inputSchema: z.object({
    entries: z.array(z.object({
      date: z.string(),
      description: z.string(),
      amount: z.number(),
      reference: z.string().optional(),
      type: z.enum(['credit', 'debit']).default('credit'),
    })),
  }),
  outputSchema: z.object({
    matched: z.array(z.object({
      entryIndex: z.number(),
      entryDescription: z.string(),
      entryAmount: z.number(),
      entryDate: z.string(),
      transactionId: z.string(),
      transactionRef: z.string(),
      transactionAmount: z.number(),
      transactionStatus: z.string(),
      matchConfidence: z.enum(['exact', 'likely', 'partial']),
    })),
    unmatched: z.array(z.object({
      entryIndex: z.number(),
      entryDescription: z.string(),
      entryAmount: z.number(),
      entryDate: z.string(),
      suggestedAction: z.string(),
    })),
    summary: z.object({
      totalEntries: z.number(),
      matchedCount: z.number(),
      unmatchedCount: z.number(),
      matchedTotal: z.number(),
      unmatchedTotal: z.number(),
    }),
  }),
  execute: async ({ input }) => {
    // Get all recent system transactions to match against
    const { rows: systemTxns } = await zite.sql({
      query: `
        SELECT
          id,
          COALESCE("reference", '') AS "reference",
          COALESCE("amount", 0) AS "amount",
          COALESCE("status", '') AS "status",
          COALESCE("type", '') AS "type",
          COALESCE("mPesaReceipt", '') AS "mPesaReceipt",
          created_at AS "createdAt"
        FROM "Transactions"
        ORDER BY created_at DESC
        LIMIT 2000
      `,
    });

    const matched: Array<{
      entryIndex: number;
      entryDescription: string;
      entryAmount: number;
      entryDate: string;
      transactionId: string;
      transactionRef: string;
      transactionAmount: number;
      transactionStatus: string;
      matchConfidence: 'exact' | 'likely' | 'partial';
    }> = [];

    const unmatched: Array<{
      entryIndex: number;
      entryDescription: string;
      entryAmount: number;
      entryDate: string;
      suggestedAction: string;
    }> = [];

    const usedTxnIds = new Set<string>();

    for (let i = 0; i < input.entries.length; i++) {
      const entry = input.entries[i];
      let bestMatch: (typeof matched)[0] | null = null;

      for (const txn of systemTxns) {
        const txnId = String(txn.id);
        if (usedTxnIds.has(txnId)) continue;

        const txnAmount = Number(txn.amount);
        const txnRef = String(txn.reference ?? '');
        const txnMpesa = String(txn.mPesaReceipt ?? '');

        // Exact match: same amount AND (reference match or mpesa receipt match)
        const amountMatch = Math.abs(txnAmount - entry.amount) < 0.01;
        const refMatch = entry.reference && txnRef &&
          txnRef.toLowerCase().includes(entry.reference.toLowerCase());
        const mpesaMatch = entry.reference && txnMpesa &&
          txnMpesa.toLowerCase().includes(entry.reference.toLowerCase());
        const descRefMatch = entry.description &&
          (entry.description.toLowerCase().includes(txnRef.toLowerCase()) ||
           txnRef.toLowerCase().includes(entry.description.toLowerCase()));

        if (amountMatch && (refMatch || mpesaMatch)) {
          bestMatch = {
            entryIndex: i,
            entryDescription: entry.description,
            entryAmount: entry.amount,
            entryDate: entry.date,
            transactionId: txnId,
            transactionRef: txnRef,
            transactionAmount: txnAmount,
            transactionStatus: String(txn.status),
            matchConfidence: 'exact',
          };
          break;
        } else if (amountMatch && descRefMatch) {
          bestMatch = {
            entryIndex: i,
            entryDescription: entry.description,
            entryAmount: entry.amount,
            entryDate: entry.date,
            transactionId: txnId,
            transactionRef: txnRef,
            transactionAmount: txnAmount,
            transactionStatus: String(txn.status),
            matchConfidence: 'likely',
          };
        } else if (amountMatch && !bestMatch) {
          bestMatch = {
            entryIndex: i,
            entryDescription: entry.description,
            entryAmount: entry.amount,
            entryDate: entry.date,
            transactionId: txnId,
            transactionRef: txnRef,
            transactionAmount: txnAmount,
            transactionStatus: String(txn.status),
            matchConfidence: 'partial',
          };
        }
      }

      if (bestMatch) {
        usedTxnIds.add(bestMatch.transactionId);
        matched.push(bestMatch);
      } else {
        unmatched.push({
          entryIndex: i,
          entryDescription: entry.description,
          entryAmount: entry.amount,
          entryDate: entry.date,
          suggestedAction: entry.amount > 0
            ? 'Create a new repayment transaction'
            : 'Review — no matching system transaction found',
        });
      }
    }

    return {
      matched,
      unmatched,
      summary: {
        totalEntries: input.entries.length,
        matchedCount: matched.length,
        unmatchedCount: unmatched.length,
        matchedTotal: matched.reduce((s, m) => s + m.entryAmount, 0),
        unmatchedTotal: unmatched.reduce((s, m) => s + m.entryAmount, 0),
      },
    };
  },
});
