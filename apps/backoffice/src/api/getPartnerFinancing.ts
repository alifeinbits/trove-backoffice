import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'Lists financing requests for entities belonging to a specific partner',
  authenticated: true,
  inputSchema: z.object({
    partnerId: z.string().min(1),
    search: z.string().optional(),
    status: z.string().optional(),
  }),
  outputSchema: z.object({
    requests: z.array(z.any()),
    total: z.number(),
  }),
  execute: async ({ input }) => {
    const params: string[] = [input.partnerId];
    const conditions: string[] = [];

    if (input.search?.trim()) {
      params.push(`%${input.search.trim()}%`);
      conditions.push(`(f."requestNumber" ILIKE $${params.length} OR e."name" ILIKE $${params.length})`);
    }
    if (input.status?.trim()) {
      params.push(input.status.trim());
      conditions.push(`f."status" = $${params.length}`);
    }

    const where = conditions.length ? `AND ${conditions.join(' AND ')}` : '';

    const result = await zite.sql({
      query: `
        SELECT
          f.id,
          f."requestNumber" AS "requestNumber",
          f."amount",
          f."status",
          f."tenor",
          f.created_at AS "createdAt",
          e."name" AS "entityName"
        FROM "FinancingRequests" f
        JOIN "EntitiesFinancingRequests" ef ON ef."financingRequestsId" = f.id
        JOIN "Entities" e ON e.id = ef."entitiesId"
        JOIN "ApiPartnersEntities" ape ON ape."entitiesId" = e.id
        WHERE ape."apiPartnersId" = $1
        ${where}
        ORDER BY f.created_at DESC
        LIMIT 200
      `,
      params,
    });

    return {
      requests: result.rows.map(r => ({
        id: String(r.id),
        requestNumber: String(r.requestNumber ?? ''),
        amount: r.amount ? Number(r.amount) : 0,
        status: String(r.status ?? ''),
        tenor: r.tenor ? Number(r.tenor) : null,
        createdAt: r.createdAt ? String(r.createdAt) : null,
        entityName: String(r.entityName ?? ''),
      })),
      total: result.rowCount,
    };
  },
});
