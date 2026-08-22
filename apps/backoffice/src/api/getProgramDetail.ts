import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'Gets full program detail with FI pricing, entities, stats',
  inputSchema: z.object({ programId: z.string() }),
  outputSchema: z.object({ program: z.any() }),
  execute: async ({ input }) => {
    const program = await zite.programs.findOne({ id: input.programId });
    if (!program) throw new Error('Program not found');

    // Anchor entity name
    let anchorName = '';
    if (program.anchorEntity) {
      const anchorId = Array.isArray(program.anchorEntity) ? program.anchorEntity[0] : program.anchorEntity;
      if (anchorId) {
        const anchor = await zite.entities.findOne({ id: anchorId });
        anchorName = anchor?.name || '';
      }
    }

    // FI Pricing
    const pricingResult = await zite.sql({
      query: `
        SELECT fp.id, fp."pricingName", fp."productType", fp."minLimit", fp."maxLimit",
               fp."transactionFeeRate", fp."processingFeeFixed", fp."processingFeeRate",
               fp."penaltyFeeRate", fp."pastDueDailyRate", fp."repaymentBankAccount",
               fp."tiersJson", fp."status", fp."autoDisburse",
               fp."interestRate", fp."tenorDays",
               fp."troveFeeRate", fp."troveFeeFixed",
               fp."fiChargeRate", fp."fiChargeFixed",
               fi."legalName" AS "fiName", fi."tradingName" AS "fiTradingName",
               fi.id AS "fiId", fi."bankCode", fi."swiftCode"
        FROM "FiProgramPricing" fp
        JOIN "FiProgramPricingPrograms" fpp ON fpp."fiProgramPricingId" = fp.id
        LEFT JOIN "FiProgramPricingFinancialInstitutions" fpfi ON fpfi."fiProgramPricingId" = fp.id
        LEFT JOIN "FinancialInstitutions" fi ON fi.id = fpfi."financialInstitutionsId"
        WHERE fpp."programsId" = $1
        ORDER BY fi."legalName"
      `,
      params: [input.programId],
    });

    // Participating entities
    const entitiesResult = await zite.sql({
      query: `
        SELECT e.id, e."name", e."entityType", e."kycStatus", e."approvedLimit",
               e."onboardingStatus", e."contactEmail"
        FROM "Entities" e
        JOIN "EntitiesPrograms" ep ON ep."entitiesId" = e.id
        WHERE ep."programsId" = $1
        ORDER BY e."name"
      `,
      params: [input.programId],
    });

    // Stats
    const statsResult = await zite.sql({
      query: `
        SELECT
          COUNT(DISTINCT e.id) AS "entityCount",
          COUNT(DISTINCT l.id) AS "loanCount",
          COALESCE(SUM(l."principal"), 0) AS "totalDisbursed",
          COALESCE(SUM(l."outstandingBalance"), 0) AS "totalOutstanding",
          COUNT(DISTINCT CASE WHEN l."status" = 'Overdue' THEN l.id END) AS "overdueCount",
          COUNT(DISTINCT fr.id) AS "financingRequestCount"
        FROM "Programs" p
        LEFT JOIN "EntitiesPrograms" ep ON ep."programsId" = p.id
        LEFT JOIN "Entities" e ON e.id = ep."entitiesId"
        LEFT JOIN "LoansPrograms" lp ON lp."programsId" = p.id
        LEFT JOIN "Loans" l ON l.id = lp."loansId"
        LEFT JOIN "FinancingRequestsPrograms" frp ON frp."programsId" = p.id
        LEFT JOIN "FinancingRequests" fr ON fr.id = frp."financingRequestsId"
        WHERE p.id = $1
      `,
      params: [input.programId],
    });

    const stats = statsResult.rows[0] || {};

    return {
      program: {
        ...program,
        anchorName,
        fiPricing: pricingResult.rows.map(r => ({
          ...r,
          tiers: r.tiersJson ? JSON.parse(String(r.tiersJson)) : [],
          transactionFeeRate: r.transactionFeeRate ? Number(r.transactionFeeRate) * 100 : 0,
          processingFeeRate: r.processingFeeRate ? Number(r.processingFeeRate) * 100 : 0,
          penaltyFeeRate: r.penaltyFeeRate ? Number(r.penaltyFeeRate) * 100 : 0,
          pastDueDailyRate: r.pastDueDailyRate ? Number(r.pastDueDailyRate) * 100 : 0,
          interestRate: r.interestRate ? Number(r.interestRate) * 100 : 0,
          troveFeeRate: r.troveFeeRate ? Number(r.troveFeeRate) * 100 : 0,
          troveFeeFixed: Number(r.troveFeeFixed || 0),
          fiChargeRate: r.fiChargeRate ? Number(r.fiChargeRate) * 100 : 0,
          fiChargeFixed: Number(r.fiChargeFixed || 0),
          tenorDays: Number(r.tenorDays || 0),
        })),
        entities: entitiesResult.rows,
        stats: {
          entityCount: Number(stats.entityCount ?? 0),
          loanCount: Number(stats.loanCount ?? 0),
          totalDisbursed: Number(stats.totalDisbursed ?? 0),
          totalOutstanding: Number(stats.totalOutstanding ?? 0),
          overdueCount: Number(stats.overdueCount ?? 0),
          financingRequestCount: Number(stats.financingRequestCount ?? 0),
        },
      },
    };
  },
});
