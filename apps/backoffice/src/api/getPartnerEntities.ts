import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'List entities scoped to a specific partner',
  authenticated: true,
  inputSchema: z.object({
    partnerId: z.string().min(1),
    search: z.string().optional(),
    entityType: z.string().optional(),
    kycStatus: z.string().optional(),
    limit: z.number().optional(),
    offset: z.number().optional(),
  }),
  outputSchema: z.object({
    entities: z.array(z.any()),
    total: z.number(),
  }),
  execute: async ({ input }) => {
    const conditions: string[] = ['ape."apiPartnersId" = $1'];
    const params: any[] = [input.partnerId];
    let idx = 2;

    if (input.search) {
      conditions.push(`(e."name" ILIKE $${idx} OR e."contactEmail" ILIKE $${idx})`);
      params.push(`%${input.search}%`);
      idx++;
    }
    if (input.entityType) {
      conditions.push(`e."entityType" = $${idx}`);
      params.push(input.entityType);
      idx++;
    }
    if (input.kycStatus) {
      conditions.push(`e."kycStatus" = $${idx}`);
      params.push(input.kycStatus);
      idx++;
    }

    const where = conditions.join(' AND ');

    const result = await zite.sql({
      query: `
        SELECT e.id, e."name", e."entityType", e."kycStatus", e."onboardingStatus",
          e."contactEmail", e."contactPhone", e."approvedLimit", e.created_at
        FROM "Entities" e
        JOIN "ApiPartnersEntities" ape ON ape."entitiesId" = e.id
        WHERE ${where}
        ORDER BY e.created_at DESC
        LIMIT $${idx} OFFSET $${idx + 1}
      `,
      params: [...params, input.limit || 50, input.offset || 0],
    });

    const countResult = await zite.sql({
      query: `
        SELECT COUNT(DISTINCT e.id) AS cnt
        FROM "Entities" e
        JOIN "ApiPartnersEntities" ape ON ape."entitiesId" = e.id
        WHERE ${where}
      `,
      params,
    });

    return {
      entities: result.rows.map((r: any) => ({
        id: r.id,
        name: r.name || '',
        entityType: r.entityType || '',
        kycStatus: r.kycStatus || '',
        onboardingStatus: r.onboardingStatus || '',
        contactEmail: r.contactEmail || '',
        contactPhone: r.contactPhone || '',
        approvedLimit: r.approvedLimit,
        createdAt: r.created_at || '',
      })),
      total: Number((countResult.rows[0] as any)?.cnt || 0),
    };
  },
});
