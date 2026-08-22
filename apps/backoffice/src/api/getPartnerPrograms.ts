import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'Lists programs associated with a partner via the ApiPartnersPrograms link table',
  authenticated: true,
  inputSchema: z.object({
    partnerId: z.string().min(1),
    search: z.string().optional(),
  }),
  outputSchema: z.object({
    programs: z.array(z.any()),
  }),
  execute: async ({ input }) => {
    const params: (string)[] = [input.partnerId];
    let searchClause = '';
    if (input.search?.trim()) {
      params.push(`%${input.search.trim()}%`);
      searchClause = `AND (p."name" ILIKE $2 OR p."productType" ILIKE $2)`;
    }

    const result = await zite.sql({
      query: `
        SELECT
          p.id,
          p."name",
          p."productType" AS "productType",
          p."status",
          p."description",
          p."size",
          p."creditPeriodDays" AS "creditPeriodDays",
          p."financePercentage" AS "financePercentage",
          p.created_at AS "createdAt",
          (SELECT COUNT(*) FROM "EntitiesPrograms" ep WHERE ep."programsId" = p.id) AS "entityCount",
          (SELECT COUNT(*) FROM "FiProgramPricingPrograms" fp WHERE fp."programsId" = p.id) AS "fiCount"
        FROM "Programs" p
        JOIN "ApiPartnersPrograms" ap ON ap."programsId" = p.id
        WHERE ap."apiPartnersId" = $1
        ${searchClause}
        ORDER BY p.created_at DESC
        LIMIT 100
      `,
      params,
    });

    return {
      programs: result.rows.map(r => ({
        id: String(r.id),
        name: String(r.name ?? ''),
        productType: String(r.productType ?? ''),
        status: String(r.status ?? ''),
        description: r.description ? String(r.description) : null,
        size: r.size ? Number(r.size) : null,
        creditPeriodDays: r.creditPeriodDays ? Number(r.creditPeriodDays) : null,
        financePercentage: r.financePercentage ? Number(r.financePercentage) : null,
        createdAt: r.createdAt ? String(r.createdAt) : null,
        entityCount: Number(r.entityCount ?? 0),
        fiCount: Number(r.fiCount ?? 0),
      })),
    };
  },
});
