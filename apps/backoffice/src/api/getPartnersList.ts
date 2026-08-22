import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'Lists all API partners with key counts and last activity',
  authenticated: true,
  inputSchema: z.object({
    status: z.string().optional(),
    partnerType: z.string().optional(),
  }),
  outputSchema: z.object({ partners: z.array(z.any()) }),
  execute: async ({ input }) => {
    const filters: Record<string, unknown> = {};
    if (input.status) filters.status = input.status;
    if (input.partnerType) filters.partnerType = input.partnerType;

    const { records } = await zite.apiPartners.findAll({ filters, limit: 500 });

    // Get key counts and last activity per partner via SQL
    const result = await zite.sql({
      query: `
        SELECT
          p.id,
          COUNT(DISTINCT CASE WHEN k."status" = 'Active' AND k."environment" = 'Sandbox' THEN k.id END) AS "sandboxKeys",
          COUNT(DISTINCT CASE WHEN k."status" = 'Active' AND k."environment" = 'Production' THEN k.id END) AS "prodKeys",
          MAX(al."createdAt") AS "lastActivity"
        FROM "ApiPartners" p
        LEFT JOIN "ApiKeysApiPartners" akap ON akap."apiPartnersId" = p.id
        LEFT JOIN "ApiKeys" k ON k.id = akap."apiKeysId"
        LEFT JOIN "ApiActivityLogApiPartners" aalap ON aalap."apiPartnersId" = p.id
        LEFT JOIN "ApiActivityLog" al ON al.id = aalap."apiActivityLogId"
        GROUP BY p.id
      `,
    });

    const statsMap: Record<string, { sandboxKeys: number; prodKeys: number; lastActivity: string | null }> = {};
    result.rows.forEach((r: any) => {
      statsMap[String(r.id)] = {
        sandboxKeys: Number(r.sandboxKeys || 0),
        prodKeys: Number(r.prodKeys || 0),
        lastActivity: r.lastActivity || null,
      };
    });

    return {
      partners: records.map((p) => ({
        id: p.id,
        partnerName: p.partnerName || '',
        partnerType: p.partnerType || '',
        status: p.status || 'Pending Approval',
        contactName: p.contactName || '',
        contactEmail: p.contactEmail || '',
        contactPhone: p.contactPhone || '',
        companyRegistration: p.companyRegistration || '',
        country: p.country || '',
        website: p.website || '',
        enabledProducts: p.enabledProducts || [],
        sandboxEnabled: p.sandboxEnabled ?? true,
        productionEnabled: p.productionEnabled ?? false,
        notes: p.notes || '',
        createdAt: p.createdAt || '',
        updatedAt: p.updatedAt || '',
        sandboxKeys: statsMap[p.id]?.sandboxKeys || 0,
        prodKeys: statsMap[p.id]?.prodKeys || 0,
        lastActivity: statsMap[p.id]?.lastActivity || null,
      })),
    };
  },
});
