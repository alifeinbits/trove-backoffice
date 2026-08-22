import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'Gets a single API partner with keys and activity summary',
  authenticated: true,
  inputSchema: z.object({ id: z.string() }),
  outputSchema: z.object({ partner: z.any(), keys: z.array(z.any()), recentActivity: z.array(z.any()), entityCount: z.number() }),
  execute: async ({ input }) => {
    const partner = await zite.apiPartners.findOne({ id: input.id });
    if (!partner) throw new ZiteError({ code: 'NOT_FOUND', message: 'Partner not found' });

    // Get keys
    const { records: keys } = await zite.apiKeys.findAll({
      filters: { apiPartner: input.id },
      limit: 100,
    });

    // Get recent activity
    const { records: activity } = await zite.apiActivityLog.findAll({
      filters: { apiPartner: input.id },
      limit: 20,
    });

    // Count entities created by this partner
    const entityResult = await zite.sql({
      query: `
        SELECT COUNT(DISTINCT al."entityCreated") AS "cnt"
        FROM "ApiActivityLog" al
        JOIN "ApiActivityLogApiPartners" ap ON ap."apiActivityLogId" = al.id
        WHERE ap."apiPartnersId" = $1
        AND al."entityCreated" IS NOT NULL
      `,
      params: [input.id],
    });

    return {
      partner: {
        id: partner.id,
        partnerName: partner.partnerName || '',
        partnerType: partner.partnerType || '',
        status: partner.status || 'Pending Approval',
        contactName: partner.contactName || '',
        contactEmail: partner.contactEmail || '',
        contactPhone: partner.contactPhone || '',
        companyRegistration: partner.companyRegistration || '',
        country: partner.country || '',
        website: partner.website || '',
        enabledProducts: partner.enabledProducts || [],
        sandboxEnabled: partner.sandboxEnabled ?? true,
        productionEnabled: partner.productionEnabled ?? false,
        approvedBy: partner.approvedBy || '',
        approvedAt: partner.approvedAt || '',
        notes: partner.notes || '',
        createdAt: partner.createdAt || '',
        updatedAt: partner.updatedAt || '',
      },
      keys: keys.map((k) => ({
        id: k.id,
        keyPrefix: k.keyPrefix || '',
        environment: k.environment || '',
        keyHint: k.keyHint || '',
        label: k.label || '',
        status: k.status || 'Active',
        lastUsedAt: k.lastUsedAt || null,
        createdAt: k.createdAt || '',
        expiresAt: k.expiresAt || null,
        revokedAt: k.revokedAt || null,
      })),
      recentActivity: activity
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
        .map((a) => ({
          id: a.id,
          endpoint: a.endpoint || '',
          method: a.method || '',
          statusCode: a.statusCode || 0,
          environment: a.environment || '',
          createdAt: a.createdAt || '',
          errorMessage: a.errorMessage || '',
        })),
      entityCount: Number((entityResult.rows[0] as any)?.cnt || 0),
    };
  },
});
