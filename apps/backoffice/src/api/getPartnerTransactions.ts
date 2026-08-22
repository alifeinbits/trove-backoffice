import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'Lists transactions for entities belonging to a specific partner',
  authenticated: true,
  inputSchema: z.object({
    partnerId: z.string().min(1),
    search: z.string().optional(),
    type: z.string().optional(),
  }),
  outputSchema: z.object({
    transactions: z.array(z.any()),
    total: z.number(),
  }),
  execute: async ({ input }) => {
    const params: string[] = [input.partnerId];
    const conditions: string[] = [];

    if (input.search?.trim()) {
      params.push(`%${input.search.trim()}%`);
      conditions.push(`(t."referenceNumber" ILIKE $${params.length} OR e."name" ILIKE $${params.length})`);
    }
    if (input.type?.trim()) {
      params.push(input.type.trim());
      conditions.push(`t."type" = $${params.length}`);
    }

    const where = conditions.length ? `AND ${conditions.join(' AND ')}` : '';

    const result = await zite.sql({
      query: `
        SELECT
          t.id,
          t."referenceNumber" AS "referenceNumber",
          t."amount",
          t."type",
          t."status",
          t."channel",
          t.created_at AS "createdAt",
          e."name" AS "entityName"
        FROM "Transactions" t
        JOIN "Loans" lo ON lo.id = (
          SELECT lt."loansId" FROM "LoansTransactions" lt WHERE lt."transactionsId" = t.id LIMIT 1
        )
        JOIN "EntitiesLoans" el ON el."loansId" = lo.id
        JOIN "Entities" e ON e.id = el."entitiesId"
        JOIN "ApiPartnersEntities" ape ON ape."entitiesId" = e.id
        WHERE ape."apiPartnersId" = $1
        ${where}
        ORDER BY t.created_at DESC
        LIMIT 200
      `,
      params,
    });

    return {
      transactions: result.rows.map(r => ({
        id: String(r.id),
        referenceNumber: String(r.referenceNumber ?? ''),
        amount: r.amount ? Number(r.amount) : 0,
        type: String(r.type ?? ''),
        status: String(r.status ?? ''),
        channel: String(r.channel ?? ''),
        createdAt: r.createdAt ? String(r.createdAt) : null,
        entityName: String(r.entityName ?? ''),
      })),
      total: result.rowCount,
    };
  },
});
