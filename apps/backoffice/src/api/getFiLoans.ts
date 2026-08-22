import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'Returns all loans with entity and program details for FI view',
  inputSchema: z.object({
    status: z.string().optional(),
  }),
  outputSchema: z.object({
    loans: z.array(z.object({
      id: z.string(),
      loanReference: z.string(),
      entityName: z.string(),
      programName: z.string(),
      productType: z.string(),
      principal: z.number(),
      outstandingBalance: z.number(),
      interestRate: z.number(),
      status: z.string(),
      disbursedAt: z.string().nullable(),
      maturityDate: z.string().nullable(),
      daysOverdue: z.number(),
    })),
  }),
  execute: async ({ input }) => {
    let whereClause = '';
    const params: any[] = [];
    if (input.status && input.status !== 'all') {
      whereClause = `WHERE l."status" = $1`;
      params.push(input.status);
    }

    const result = await zite.sql({
      query: `
        SELECT l.id, l."loanReference", l."productType",
               COALESCE(l."principal", 0) AS principal,
               COALESCE(l."outstandingBalance", 0) AS "outstandingBalance",
               COALESCE(l."interestRate", 0) AS "interestRate",
               COALESCE(l."status", 'Active') AS status,
               l."disbursedAt", l."maturityDate",
               COALESCE(l."daysOverdue", 0) AS "daysOverdue",
               COALESCE(e."name", '') AS "entityName",
               COALESCE(p."name", '') AS "programName"
        FROM "Loans" l
        LEFT JOIN "EntitiesLoans" el ON el."loansId" = l.id
        LEFT JOIN "Entities" e ON e.id = el."entitiesId"
        LEFT JOIN "LoansPrograms" lp ON lp."loansId" = l.id
        LEFT JOIN "Programs" p ON p.id = lp."programsId"
        ${whereClause}
        ORDER BY l."disbursedAt" DESC NULLS LAST, l.created_at DESC
        LIMIT 500
      `,
      params,
    });

    const loans = (result.rows as any[]).map(r => ({
      id: String(r.id),
      loanReference: String(r.loanReference || ''),
      entityName: String(r.entityName || ''),
      programName: String(r.programName || ''),
      productType: String(r.productType || ''),
      principal: Number(r.principal),
      outstandingBalance: Number(r.outstandingBalance),
      interestRate: Number(r.interestRate),
      status: String(r.status),
      disbursedAt: r.disbursedAt ? String(r.disbursedAt) : null,
      maturityDate: r.maturityDate ? String(r.maturityDate) : null,
      daysOverdue: Number(r.daysOverdue),
    }));

    return { loans };
  },
});
