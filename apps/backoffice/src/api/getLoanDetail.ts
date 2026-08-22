import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'Returns full loan detail with transactions, charges timeline, and penalty breakdown',
  inputSchema: z.object({ loanId: z.string() }),
  outputSchema: z.object({ loan: z.any() }),
  execute: async ({ input }) => {
    const result = await zite.sql({
      query: `
        SELECT l.id, l."loanReference", l."productType", l."principal",
               l."outstandingBalance", l."interestRate", l."penaltyAmount",
               l."status", l."disbursedAt", l."maturityDate", l."daysOverdue",
               l.created_at AS "createdAt",
               e."name" AS "entityName", e.id AS "entityId", e."entityType",
               p."name" AS "programName", p.id AS "programId"
        FROM "Loans" l
        LEFT JOIN "EntitiesLoans" el ON el."loansId" = l.id
        LEFT JOIN "Entities" e ON e.id = el."entitiesId"
        LEFT JOIN "LoansPrograms" lp ON lp."loansId" = l.id
        LEFT JOIN "Programs" p ON p.id = lp."programsId"
        WHERE l.id = $1
        LIMIT 1
      `,
      params: [input.loanId],
    });

    if (result.rows.length === 0) throw new ZiteError('Loan not found');
    const row = result.rows[0] as any;
    const programId = row.programId ? String(row.programId) : null;

    // Transactions (all types including penalties)
    const txResult = await zite.sql({
      query: `
        SELECT t.id, t."reference", t."type", t."amount", t."paymentMethod",
               t."mPesaReceipt", t."phoneNumber", t."status",
               t.created_at AS "createdAt"
        FROM "Transactions" t
        JOIN "LoansTransactions" lt ON lt."transactionsId" = t.id
        WHERE lt."loansId" = $1
        ORDER BY t.created_at DESC
      `,
      params: [input.loanId],
    });

    // Financing requests + resolve both parties
    const frResult = await zite.sql({
      query: `
        SELECT fr.id, fr.autonumber_id AS "requestNumber", fr."requestedAmount",
               fr."financeableAmount", fr."status", fr."productType",
               fr.created_at AS "createdAt",
               re."name" AS "requestingEntityName", re."entityType" AS "requestingEntityType",
               be."name" AS "borrowerEntityName", be."entityType" AS "borrowerEntityType"
        FROM "FinancingRequests" fr
        JOIN "FinancingRequestsLoans" frl ON frl."financingRequestsId" = fr.id
        LEFT JOIN "EntitiesFinancingRequests" efr_req ON efr_req."financingRequestsId" = fr.id
        LEFT JOIN "Entities" re ON re.id = efr_req."entitiesId"
        LEFT JOIN (
          SELECT fr2.id AS fr_id, e2."name", e2."entityType"
          FROM "FinancingRequests" fr2
          CROSS JOIN LATERAL (
            SELECT e.id, e."name", e."entityType"
            FROM jsonb_array_elements_text(fr2."borrowerEntity") AS be_id
            JOIN "Entities" e ON e.id = be_id::uuid
            LIMIT 1
          ) e2
        ) be ON be.fr_id = fr.id
        WHERE frl."loansId" = $1
        ORDER BY fr.created_at DESC
      `,
      params: [input.loanId],
    });

    // Derive parties from financing request or fall back to loan entity
    const fr0 = frResult.rows[0] as any;
    let requestingParty = { name: '', type: '' };
    let borrowerParty = { name: '', type: '' };

    if (fr0) {
      requestingParty = { name: fr0.requestingEntityName || '', type: fr0.requestingEntityType || '' };
      borrowerParty = { name: fr0.borrowerEntityName || '', type: fr0.borrowerEntityType || '' };
    }
    // Fall back to the loan's entity if no financing request found
    if (!requestingParty.name && row.entityName) {
      requestingParty = { name: String(row.entityName), type: String(row.entityType || '') };
    }
    if (!borrowerParty.name && row.entityName) {
      borrowerParty = { name: String(row.entityName), type: String(row.entityType || '') };
    }

    // Get FI name from program pricing
    let fiName = '';
    if (programId) {
      const fiResult = await zite.sql({
        query: `
          SELECT fi."legalName" AS "name"
          FROM "FiProgramPricing" fp
          JOIN "FiProgramPricingPrograms" fpp ON fpp."fiProgramPricingId" = fp.id
          JOIN "FiProgramPricingFinancialInstitutions" fpfi ON fpfi."fiProgramPricingId" = fp.id
          JOIN "FinancialInstitutions" fi ON fi.id = fpfi."financialInstitutionsId"
          WHERE fpp."programsId" = $1 AND fp."status" = 'Active'
          LIMIT 1
        `,
        params: [programId],
      });
      fiName = (fiResult.rows[0] as any)?.name || '';
    }

    // Related notifications/reminders for this loan
    const reminders = await zite.sql({
      query: `
        SELECT n.id, n."title", n."message", n."type", n."read",
               n.created_at AS "createdAt"
        FROM "Notifications" n
        WHERE n."linkPath" = $1
        ORDER BY n.created_at DESC
        LIMIT 20
      `,
      params: [`/loans/${input.loanId}`],
    });

    // FI Pricing for penalty rates
    let penaltyFeeRate = 0;
    let pastDueDailyRate = 0;
    if (programId) {
      const pricingResult = await zite.sql({
        query: `
          SELECT fp."penaltyFeeRate", fp."pastDueDailyRate"
          FROM "FiProgramPricing" fp
          JOIN "FiProgramPricingPrograms" fpp ON fpp."fiProgramPricingId" = fp.id
          WHERE fpp."programsId" = $1 AND fp."status" = 'Active'
          LIMIT 1
        `,
        params: [programId],
      });
      if (pricingResult.rows.length > 0) {
        const pr = pricingResult.rows[0] as any;
        penaltyFeeRate = Number(pr.penaltyFeeRate || 0);
        pastDueDailyRate = Number(pr.pastDueDailyRate || 0);
      }
    }

    const daysOverdue = Number(row.daysOverdue || 0);
    const outstanding = Number(row.outstandingBalance || 0);
    const penaltyAmount = Number(row.penaltyAmount || 0);

    // Classification
    let classification = 'Performing';
    if (daysOverdue > 180) classification = 'Loss';
    else if (daysOverdue > 90) classification = 'Doubtful';
    else if (daysOverdue > 60) classification = 'Substandard';
    else if (daysOverdue > 30) classification = 'Special Mention';
    else if (daysOverdue > 0) classification = 'Watch';

    // Build charges timeline from transactions
    const allTx = txResult.rows as any[];
    const chargesTimeline = allTx
      .filter((t: any) => ['Penalty', 'Interest', 'Fee'].includes(t.type))
      .map((t: any) => ({
        id: String(t.id),
        type: String(t.type),
        amount: Number(t.amount || 0),
        reference: String(t.reference || ''),
        date: t.createdAt ? String(t.createdAt) : null,
        status: String(t.status || ''),
      }));

    // Penalty breakdown
    const dailyPenaltyRate = pastDueDailyRate || 0.001;
    const estimatedDailyPenalty = outstanding * dailyPenaltyRate;

    return {
      loan: {
        id: String(row.id),
        loanReference: String(row.loanReference || ''),
        productType: String(row.productType || ''),
        principal: Number(row.principal || 0),
        outstandingBalance: outstanding,
        interestRate: Number(row.interestRate || 0),
        penaltyAmount,
        status: String(row.status || ''),
        disbursedAt: row.disbursedAt ? String(row.disbursedAt) : null,
        maturityDate: row.maturityDate ? String(row.maturityDate) : null,
        daysOverdue,
        createdAt: row.createdAt ? String(row.createdAt) : null,
        entityName: row.entityName ? String(row.entityName) : null,
        entityId: row.entityId ? String(row.entityId) : null,
        entityType: row.entityType ? String(row.entityType) : null,
        programName: row.programName ? String(row.programName) : null,
        programId: row.programId ? String(row.programId) : null,
        parties: {
          requestingEntity: requestingParty,
          borrowerEntity: borrowerParty,
          financialInstitution: fiName,
        },
        classification,
        penaltyBreakdown: {
          penaltyFeeRate,
          pastDueDailyRate: dailyPenaltyRate,
          estimatedDailyPenalty: Math.round(estimatedDailyPenalty * 100) / 100,
          accruedPenalty: penaltyAmount,
          projectedWeekly: Math.round(estimatedDailyPenalty * 7 * 100) / 100,
          projectedMonthly: Math.round(estimatedDailyPenalty * 30 * 100) / 100,
        },
        chargesTimeline,
        reminders: reminders.rows.map((r: any) => ({
          id: String(r.id),
          title: String(r.title || ''),
          message: String(r.message || ''),
          type: String(r.type || ''),
          read: !!r.read,
          createdAt: r.createdAt ? String(r.createdAt) : null,
        })),
        transactions: allTx.map((t: any) => ({
          id: String(t.id),
          reference: String(t.reference || ''),
          type: String(t.type || ''),
          amount: Number(t.amount || 0),
          paymentMethod: String(t.paymentMethod || ''),
          mPesaReceipt: t.mPesaReceipt ? String(t.mPesaReceipt) : null,
          phoneNumber: t.phoneNumber ? String(t.phoneNumber) : null,
          status: String(t.status || ''),
          createdAt: t.createdAt ? String(t.createdAt) : null,
        })),
        financingRequests: frResult.rows.map((fr: any) => ({
          id: String(fr.id),
          requestNumber: Number(fr.requestNumber || 0),
          requestedAmount: Number(fr.requestedAmount || 0),
          financeableAmount: Number(fr.financeableAmount || 0),
          status: String(fr.status || ''),
          productType: String(fr.productType || ''),
          createdAt: fr.createdAt ? String(fr.createdAt) : null,
        })),
      },
    };
  },
});
