import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'FI Admin screens an entity onboarding — approve or reject with notes',
  inputSchema: z.object({
    onboardingId: z.string(),
    decision: z.enum(['Approved', 'Rejected']),
    notes: z.string().optional(),
  }),
  outputSchema: z.object({ success: z.boolean(), newStage: z.string(), newStatus: z.string(), offerLetterId: z.string().optional() }),
  execute: async ({ input, context }) => {
    const onboarding = await zite.onboardings.findOne({ id: input.onboardingId });
    if (!onboarding) throw new Error('Onboarding not found');

    const reviewedBy = `${context.user.firstName || ''} ${context.user.lastName || ''}`.trim() || context.user.email;
    const now = new Date().toISOString();

    const updateData: Record<string, any> = {
      fiReviewedBy: reviewedBy,
      fiReviewedAt: now,
      fiReviewNotes: input.notes || null,
    };

    let offerLetterId: string | undefined;

    if (input.decision === 'Approved') {
      updateData.currentStage = 'Awaiting Offer Response';
      updateData.overallStatus = 'Offer Received';

      // Get entity and limit proposal to create offer letter
      const entityId = onboarding.entity
        ? (Array.isArray(onboarding.entity) ? onboarding.entity[0] : onboarding.entity)
        : null;

      const programId = onboarding.program
        ? (Array.isArray(onboarding.program) ? onboarding.program[0] : onboarding.program)
        : null;

      // Look up approved limit from limit proposals or entity
      let approvedLimit = 0;
      let tenorDays = 90;
      let interestRate = 12;

      if (entityId) {
        // Check limit proposals for this onboarding
        const lpResult = await zite.sql({
          query: `SELECT lp."approvedAmount", lp."proposedAmount", lp."preferredTenorDays"
                  FROM "LimitProposals" lp
                  JOIN "LimitProposalsOnboardings" lpo ON lpo."limitProposalsId" = lp.id
                  WHERE lpo."onboardingsId" = $1
                    AND lp."status" = 'Approved'
                  ORDER BY lp.created_at DESC LIMIT 1`,
          params: [input.onboardingId],
        });

        if (lpResult.rows.length > 0) {
          const lp = lpResult.rows[0] as any;
          approvedLimit = Number(lp.approvedAmount || lp.proposedAmount || 0);
          tenorDays = Number(lp.preferredTenorDays || 90);
        } else {
          // Fall back to entity approved limit
          const entity = await zite.entities.findOne({ id: entityId });
          approvedLimit = Number(entity?.approvedLimit || 0);
        }

        // Check FI pricing and program for the offer terms
        if (programId) {
          const pricingResult = await zite.sql({
            query: `SELECT fp."interestRate", fp."tenorDays",
                           fp."troveFeeRate", fp."troveFeeFixed",
                           fp."fiChargeRate", fp."fiChargeFixed",
                           fp."transactionFeeRate", fp."processingFeeRate", fp."processingFeeFixed"
                    FROM "FiProgramPricing" fp
                    JOIN "FiProgramPricingPrograms" fpp ON fpp."fiProgramPricingId" = fp.id
                    WHERE fpp."programsId" = $1
                    LIMIT 1`,
            params: [programId],
          });
          if (pricingResult.rows.length > 0) {
            const pr = pricingResult.rows[0] as any;
            if (pr.interestRate) interestRate = Number(pr.interestRate);
            if (pr.tenorDays) tenorDays = Number(pr.tenorDays);
          }
        }
      }

      // Create the offer letter
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30); // 30-day expiry

      const offerLetter = await zite.offerLetters.create({
        record: {
          entity: entityId || null,
          onboarding: input.onboardingId,
          program: programId || null,
          approvedLimit,
          interestRate,
          tenorDays,
          status: 'Generated',
          expiryDate: expiryDate.toISOString().split('T')[0],
          notes: input.notes || null,
        },
      });

      offerLetterId = offerLetter.id;

      // Update entity status
      if (entityId) {
        await zite.entities.update({
          id: entityId,
          record: { onboardingStatus: 'FI Approved' },
        });
      }

      // Update onboarding stage is already set above

    } else {
      updateData.currentStage = 'FI Document Review';
      updateData.overallStatus = 'Rejected';

      if (onboarding.entity) {
        const entityId = Array.isArray(onboarding.entity) ? onboarding.entity[0] : onboarding.entity;
        if (entityId) {
          await zite.entities.update({
            id: entityId,
            record: { onboardingStatus: 'FI Rejected' },
          });
        }
      }
    }

    await zite.onboardings.update({ id: input.onboardingId, record: updateData });

    return {
      success: true,
      newStage: updateData.currentStage || onboarding.currentStage || '',
      newStatus: updateData.overallStatus || '',
      offerLetterId,
    };
  },
});
