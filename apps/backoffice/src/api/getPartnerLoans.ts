import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'Lists loans for entities belonging to a specific partner',
  authenticated: true,
  inputSchema: z.object({
    partnerId: z.string().min(1),
    search: z.string().optional(),
    status: z.string().optional(),
  }),
  outputSchema: z.object({
    loans: z.array(z.any()),
    total: z.number(),
  }),
  execute: async ({ input }) => {
    const params: string[] = [input.partnerId];
    const conditions: string[] = [];

    if (input.search?.trim()) {
      params.push(`%${input.search.trim()}%`);
      conditions.push(`(lo."loanNumber" ILIKE $${params.length} OR e."name" ILIKE $${params.length})`);
    }
    if (input.status?.trim()) {
      params.push(input.status.trim());
      conditions.push(`lo."status" = $${params.length}`);
    }

    const where = conditions.length ? `AND ${conditions.join(' AND ')}` : '';

    const result = await zite.sql({
      query: `
        SELECT
          lo.id,
          lo."loanNumber" AS "loanNumber",
          lo."principalAmount" AS "principalAmount",
          lo."outstandingBalance" AS "outstandingBalance",
          lo."status",
          lo."maturityDate" AS "maturityDate",
          lo.created_at AS "createdAt",
          e."name" AS "entityName"
        FROM "Loans" lo
        JOIN "EntitiesLoans" el ON el."loansId" = lo.id
        JOIN "Entities" e ON e.id = el."entitiesId"
        JOIN "ApiPartnersEntities" ape ON ape."entitiesId" = e.id
        WHERE ape."apiPartnersId" = $1
        ${where}
        ORDER BY lo.created_at DESC
        LIMIT 200
      `,
      params,
    });

    return {
      loans: result.rows.map(r => ({
        id: String(r.id),
        loanNumber: String(r.loanNumber ?? ''),
        principalAmount: r.principalAmount ? Number(r.principalAmount) : 0,
        outstandingBalance: r.outstandingBalance ? Number(r.outstandingBalance) : 0,
        status: String(r.status ?? ''),
        maturityDate: r.maturityDate ? String(r.maturityDate) : null,
        createdAt: r.createdAt ? String(r.createdAt) : null,
        entityName: String(r.entityName ?? ''),
      })),
      total: result.rowCount,
    };
  },
});
