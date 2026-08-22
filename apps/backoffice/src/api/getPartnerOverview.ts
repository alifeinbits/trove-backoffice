import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'Dashboard overview scoped to a specific partner — shows only their entities, invoices, loans, etc.',
  authenticated: true,
  inputSchema: z.object({
    partnerId: z.string().min(1),
  }),
  outputSchema: z.object({
    partner: z.any(),
    entityCount: z.number(),
    invoiceCount: z.number(),
    financingRequestCount: z.number(),
    loanCount: z.number(),
    totalDisbursed: z.number(),
    totalOutstanding: z.number(),
    recentEntities: z.array(z.any()),
    recentActivity: z.array(z.any()),
    apiKeyCount: z.number(),
  }),
  execute: async ({ input }) => {
    const partner = await zite.apiPartners.findOne({ id: input.partnerId });
    if (!partner) {
      return {
        partner: null, entityCount: 0, invoiceCount: 0, financingRequestCount: 0,
        loanCount: 0, totalDisbursed: 0, totalOutstanding: 0,
        recentEntities: [], recentActivity: [], apiKeyCount: 0,
      };
    }

    // Count entities created by this partner
    const entityStats = await zite.sql({
      query: `
        SELECT COUNT(DISTINCT e.id) AS cnt
        FROM "Entities" e
        JOIN "ApiPartnersEntities" ape ON ape."entitiesId" = e.id
        WHERE ape."apiPartnersId" = $1
      `,
      params: [input.partnerId],
    });

    // Count invoices on partner's entities
    const invoiceStats = await zite.sql({
      query: `
        SELECT COUNT(DISTINCT i.id) AS cnt
        FROM "Invoices" i
        JOIN "EntitiesInvoices" ei ON ei."invoicesId" = i.id
        JOIN "ApiPartnersEntities" ape ON ape."entitiesId" = ei."entitiesId"
        WHERE ape."apiPartnersId" = $1
      `,
      params: [input.partnerId],
    });

    // Count financing requests
    const frStats = await zite.sql({
      query: `
        SELECT COUNT(DISTINCT fr.id) AS cnt
        FROM "FinancingRequests" fr
        JOIN "EntitiesFinancingRequests" efr ON efr."financingRequestsId" = fr.id
        JOIN "ApiPartnersEntities" ape ON ape."entitiesId" = efr."entitiesId"
        WHERE ape."apiPartnersId" = $1
      `,
      params: [input.partnerId],
    });

    // Loan stats
    const loanStats = await zite.sql({
      query: `
        SELECT
          COUNT(DISTINCT l.id) AS cnt,
          COALESCE(SUM(l."principal"), 0) AS "totalDisbursed",
          COALESCE(SUM(l."outstandingBalance"), 0) AS "totalOutstanding"
        FROM "Loans" l
        JOIN "EntitiesLoans" el ON el."loansId" = l.id
        JOIN "ApiPartnersEntities" ape ON ape."entitiesId" = el."entitiesId"
        WHERE ape."apiPartnersId" = $1
      `,
      params: [input.partnerId],
    });

    // Recent entities
    const recentEntities = await zite.sql({
      query: `
        SELECT e.id, e."name", e."entityType", e."kycStatus", e."onboardingStatus", e.created_at
        FROM "Entities" e
        JOIN "ApiPartnersEntities" ape ON ape."entitiesId" = e.id
        WHERE ape."apiPartnersId" = $1
        ORDER BY e.created_at DESC
        LIMIT 5
      `,
      params: [input.partnerId],
    });

    // Recent API activity
    const recentActivity = await zite.sql({
      query: `
        SELECT a.id, a."endpoint", a."method", a."statusCode", a."requestSummary", a.created_at
        FROM "ApiActivityLog" a
        JOIN "ApiActivityLogApiPartners" alp ON alp."apiActivityLogId" = a.id
        WHERE alp."apiPartnersId" = $1
        ORDER BY a.created_at DESC
        LIMIT 10
      `,
      params: [input.partnerId],
    });

    // API key count
    const keyStats = await zite.sql({
      query: `
        SELECT COUNT(*) AS cnt
        FROM "ApiKeys" ak
        JOIN "ApiKeysApiPartners" akp ON akp."apiKeysId" = ak.id
        WHERE akp."apiPartnersId" = $1 AND ak."status" = 'Active'
      `,
      params: [input.partnerId],
    });

    return {
      partner: {
        id: partner.id,
        partnerName: partner.partnerName || '',
        partnerType: partner.partnerType || '',
        status: partner.status || '',
        enabledProducts: partner.enabledProducts || [],
        sandboxEnabled: partner.sandboxEnabled,
        productionEnabled: partner.productionEnabled,
      },
      entityCount: Number((entityStats.rows[0] as any)?.cnt || 0),
      invoiceCount: Number((invoiceStats.rows[0] as any)?.cnt || 0),
      financingRequestCount: Number((frStats.rows[0] as any)?.cnt || 0),
      loanCount: Number((loanStats.rows[0] as any)?.cnt || 0),
      totalDisbursed: Number((loanStats.rows[0] as any)?.totalDisbursed || 0),
      totalOutstanding: Number((loanStats.rows[0] as any)?.totalOutstanding || 0),
      recentEntities: recentEntities.rows.map((r: any) => ({
        id: r.id,
        name: r.name || '',
        entityType: r.entityType || '',
        kycStatus: r.kycStatus || '',
        onboardingStatus: r.onboardingStatus || '',
        createdAt: r.created_at || '',
      })),
      recentActivity: recentActivity.rows.map((r: any) => ({
        id: r.id,
        endpoint: r.endpoint || '',
        method: r.method || '',
        statusCode: r.statusCode,
        requestSummary: r.requestSummary || '',
        createdAt: r.created_at || '',
      })),
      apiKeyCount: Number((keyStats.rows[0] as any)?.cnt || 0),
    };
  },
});
