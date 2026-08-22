import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'Returns reconciliation dashboard data with KPIs and discrepancy lists',
  authenticated: true,
  inputSchema: z.object({
    tab: z.enum(['overview', 'transactions', 'invoices', 'statements']).default('overview'),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
  }),
  outputSchema: z.object({
    kpis: z.object({
      totalTransactions: z.number(),
      matchedTransactions: z.number(),
      unmatchedTransactions: z.number(),
      totalTransactionAmount: z.number(),
      matchedAmount: z.number(),
      unmatchedAmount: z.number(),
      totalInvoices: z.number(),
      financedInvoices: z.number(),
      unfinancedInvoices: z.number(),
      invoiceAmountTotal: z.number(),
      financedAmountTotal: z.number(),
      discrepancyCount: z.number(),
    }),
    transactionDiscrepancies: z.array(z.object({
      id: z.string(),
      reference: z.string(),
      type: z.string(),
      amount: z.number(),
      status: z.string(),
      loanReference: z.string().nullable(),
      loanOutstanding: z.number().nullable(),
      issue: z.string(),
      createdAt: z.string().nullable(),
    })),
    invoiceDiscrepancies: z.array(z.object({
      id: z.string(),
      invoiceNumber: z.string(),
      amount: z.number(),
      status: z.string(),
      issuerName: z.string().nullable(),
      recipientName: z.string().nullable(),
      financingStatus: z.string().nullable(),
      financedAmount: z.number().nullable(),
      issue: z.string(),
      createdAt: z.string().nullable(),
    })),
    loanBalanceMismatches: z.array(z.object({
      id: z.string(),
      loanReference: z.string(),
      principal: z.number(),
      outstandingBalance: z.number(),
      totalRepayments: z.number(),
      totalDisbursements: z.number(),
      expectedBalance: z.number(),
      variance: z.number(),
      entityName: z.string().nullable(),
    })),
  }),
  execute: async ({ input }) => {
    const dateFilter = input.dateFrom && input.dateTo
      ? `AND t.created_at >= $1 AND t.created_at <= $2`
      : '';
    const params = input.dateFrom && input.dateTo
      ? [input.dateFrom, input.dateTo]
      : [];

    // KPI: Transaction reconciliation summary
    const txnSummary = await zite.sql({
      query: `
        SELECT
          COUNT(*) AS "totalTxn",
          COUNT(*) FILTER (WHERE "status" = 'Completed') AS "matchedTxn",
          COUNT(*) FILTER (WHERE "status" IN ('Pending', 'Failed', 'Reversed')) AS "unmatchedTxn",
          COALESCE(SUM("amount"), 0) AS "totalAmt",
          COALESCE(SUM("amount") FILTER (WHERE "status" = 'Completed'), 0) AS "matchedAmt",
          COALESCE(SUM("amount") FILTER (WHERE "status" IN ('Pending', 'Failed', 'Reversed')), 0) AS "unmatchedAmt"
        FROM "Transactions"
      `,
    });

    // KPI: Invoice reconciliation summary
    const invSummary = await zite.sql({
      query: `
        SELECT
          COUNT(*) AS "totalInv",
          COUNT(*) FILTER (WHERE "status" IN ('Financed', 'Fully Financed', 'Finance Requested', 'Financing Approved')) AS "financedInv",
          COUNT(*) FILTER (WHERE "status" IN ('Uploaded', 'Pending Verification', 'Verified', 'Finance Eligible')) AS "unfinancedInv",
          COALESCE(SUM("amount"), 0) AS "totalInvAmt",
          COALESCE(SUM("amount") FILTER (WHERE "status" IN ('Financed', 'Fully Financed', 'Finance Requested', 'Financing Approved')), 0) AS "financedAmt"
        FROM "Invoices"
      `,
    });

    // Transaction discrepancies: unmatched or problematic transactions
    const txnDiscrep = await zite.sql({
      query: `
        SELECT
          t.id,
          COALESCE(t."reference", '') AS "reference",
          COALESCE(t."type", 'Unknown') AS "type",
          COALESCE(t."amount", 0) AS "amount",
          COALESCE(t."status", 'Unknown') AS "status",
          l."loanReference",
          l."outstandingBalance" AS "loanOutstanding",
          t.created_at AS "createdAt",
          CASE
            WHEN t."status" = 'Failed' THEN 'Failed transaction'
            WHEN t."status" = 'Reversed' THEN 'Reversed transaction'
            WHEN t."status" = 'Pending' AND t.created_at < now() - interval '48 hours' THEN 'Pending over 48h'
            WHEN t."type" = 'Repayment' AND t."amount" > COALESCE(l."outstandingBalance", 0) AND l.id IS NOT NULL THEN 'Overpayment'
            ELSE 'Requires review'
          END AS issue
        FROM "Transactions" t
        LEFT JOIN "LoansTransactions" lt ON lt."transactionsId" = t.id
        LEFT JOIN "Loans" l ON l.id = lt."loansId"
        WHERE t."status" IN ('Pending', 'Failed', 'Reversed')
           OR (t."type" = 'Repayment' AND t."amount" > COALESCE(l."outstandingBalance", 0) AND l.id IS NOT NULL)
        ORDER BY t.created_at DESC
        LIMIT 100
      `,
    });

    // Invoice discrepancies: invoices with financing issues
    const invDiscrep = await zite.sql({
      query: `
        SELECT
          i.id,
          COALESCE(i."invoiceNumber", '') AS "invoiceNumber",
          COALESCE(i."amount", 0) AS "amount",
          COALESCE(i."status", 'Unknown') AS "status",
          issuer."name" AS "issuerName",
          recipient."name" AS "recipientName",
          fr."status" AS "financingStatus",
          fr."financeableAmount" AS "financedAmount",
          i.created_at AS "createdAt",
          CASE
            WHEN i."status" = 'Finance Requested' AND fr."status" IS NULL THEN 'No financing request found'
            WHEN i."status" = 'Financing Approved' AND fr."status" = 'Rejected' THEN 'Status mismatch with financing'
            WHEN i."amount" IS NOT NULL AND fr."financeableAmount" IS NOT NULL AND fr."financeableAmount" > i."amount" THEN 'Financeable exceeds invoice amount'
            WHEN i."dueDate" IS NOT NULL AND i."dueDate" < CURRENT_DATE AND i."status" NOT IN ('Paid', 'Early Paid', 'Fully Financed') THEN 'Overdue and unpaid'
            ELSE 'Requires review'
          END AS issue
        FROM "Invoices" i
        LEFT JOIN "EntitiesInvoices" ei ON ei."invoicesId" = i.id
        LEFT JOIN "Entities" issuer ON issuer.id = ei."entitiesId"
        LEFT JOIN "Entities" recipient ON recipient.id = ei."entitiesId"
        LEFT JOIN "FinancingRequestsInvoices" fri ON fri."invoicesId" = i.id
        LEFT JOIN "FinancingRequests" fr ON fr.id = fri."financingRequestsId"
        WHERE
          (i."status" = 'Finance Requested' AND fr."status" IS NULL)
          OR (i."status" = 'Financing Approved' AND fr."status" = 'Rejected')
          OR (i."amount" IS NOT NULL AND fr."financeableAmount" IS NOT NULL AND fr."financeableAmount" > i."amount")
          OR (i."dueDate" IS NOT NULL AND i."dueDate" < CURRENT_DATE AND i."status" NOT IN ('Paid', 'Early Paid', 'Fully Financed'))
        ORDER BY i.created_at DESC
        LIMIT 100
      `,
    });

    // Loan balance mismatches: expected vs actual balance
    const loanMismatches = await zite.sql({
      query: `
        SELECT
          l.id,
          COALESCE(l."loanReference", '') AS "loanReference",
          COALESCE(l."principal", 0) AS "principal",
          COALESCE(l."outstandingBalance", 0) AS "outstandingBalance",
          COALESCE(repay.total, 0) AS "totalRepayments",
          COALESCE(disb.total, 0) AS "totalDisbursements",
          (COALESCE(l."principal", 0) - COALESCE(repay.total, 0)) AS "expectedBalance",
          ABS(COALESCE(l."outstandingBalance", 0) - (COALESCE(l."principal", 0) - COALESCE(repay.total, 0))) AS "variance",
          e."name" AS "entityName"
        FROM "Loans" l
        LEFT JOIN (
          SELECT lt."loansId", SUM(t."amount") AS total
          FROM "LoansTransactions" lt
          JOIN "Transactions" t ON t.id = lt."transactionsId"
          WHERE t."type" = 'Repayment' AND t."status" = 'Completed'
          GROUP BY lt."loansId"
        ) repay ON repay."loansId" = l.id
        LEFT JOIN (
          SELECT lt."loansId", SUM(t."amount") AS total
          FROM "LoansTransactions" lt
          JOIN "Transactions" t ON t.id = lt."transactionsId"
          WHERE t."type" = 'Disbursement' AND t."status" = 'Completed'
          GROUP BY lt."loansId"
        ) disb ON disb."loansId" = l.id
        LEFT JOIN "EntitiesLoans" el ON el."loansId" = l.id
        LEFT JOIN "Entities" e ON e.id = el."entitiesId"
        WHERE l."status" IN ('Active', 'Overdue')
        HAVING ABS(COALESCE(l."outstandingBalance", 0) - (COALESCE(l."principal", 0) - COALESCE(repay.total, 0))) > 1
        ORDER BY ABS(COALESCE(l."outstandingBalance", 0) - (COALESCE(l."principal", 0) - COALESCE(repay.total, 0))) DESC
        LIMIT 50
      `,
    });

    const t = txnSummary.rows[0] || {};
    const inv = invSummary.rows[0] || {};

    const discrepancyCount =
      txnDiscrep.rows.length + invDiscrep.rows.length + loanMismatches.rows.length;

    return {
      kpis: {
        totalTransactions: Number(t.totalTxn ?? 0),
        matchedTransactions: Number(t.matchedTxn ?? 0),
        unmatchedTransactions: Number(t.unmatchedTxn ?? 0),
        totalTransactionAmount: Number(t.totalAmt ?? 0),
        matchedAmount: Number(t.matchedAmt ?? 0),
        unmatchedAmount: Number(t.unmatchedAmt ?? 0),
        totalInvoices: Number(inv.totalInv ?? 0),
        financedInvoices: Number(inv.financedInv ?? 0),
        unfinancedInvoices: Number(inv.unfinancedInv ?? 0),
        invoiceAmountTotal: Number(inv.totalInvAmt ?? 0),
        financedAmountTotal: Number(inv.financedAmt ?? 0),
        discrepancyCount,
      },
      transactionDiscrepancies: txnDiscrep.rows.map((r: any) => ({
        id: String(r.id),
        reference: String(r.reference ?? ''),
        type: String(r.type ?? ''),
        amount: Number(r.amount ?? 0),
        status: String(r.status ?? ''),
        loanReference: r.loanReference ? String(r.loanReference) : null,
        loanOutstanding: r.loanOutstanding != null ? Number(r.loanOutstanding) : null,
        issue: String(r.issue),
        createdAt: r.createdAt ? String(r.createdAt) : null,
      })),
      invoiceDiscrepancies: invDiscrep.rows.map((r: any) => ({
        id: String(r.id),
        invoiceNumber: String(r.invoiceNumber ?? ''),
        amount: Number(r.amount ?? 0),
        status: String(r.status ?? ''),
        issuerName: r.issuerName ? String(r.issuerName) : null,
        recipientName: r.recipientName ? String(r.recipientName) : null,
        financingStatus: r.financingStatus ? String(r.financingStatus) : null,
        financedAmount: r.financedAmount != null ? Number(r.financedAmount) : null,
        issue: String(r.issue),
        createdAt: r.createdAt ? String(r.createdAt) : null,
      })),
      loanBalanceMismatches: loanMismatches.rows.map((r: any) => ({
        id: String(r.id),
        loanReference: String(r.loanReference ?? ''),
        principal: Number(r.principal ?? 0),
        outstandingBalance: Number(r.outstandingBalance ?? 0),
        totalRepayments: Number(r.totalRepayments ?? 0),
        totalDisbursements: Number(r.totalDisbursements ?? 0),
        expectedBalance: Number(r.expectedBalance ?? 0),
        variance: Number(r.variance ?? 0),
        entityName: r.entityName ? String(r.entityName) : null,
      })),
    };
  },
});
