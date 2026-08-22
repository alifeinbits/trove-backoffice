import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'Creates a new program with optional FI pricing attachments',
  authenticated: true,
  inputSchema: z.object({
    name: z.string().min(1),
    productType: z.string().min(1),
    description: z.string().optional(),
    programSize: z.number().optional(),
    creditPeriodDays: z.number().optional(),
    financePercentage: z.number().optional(),
    minParticipantLimit: z.number().optional(),
    maxParticipantLimit: z.number().optional(),
    programOwnerType: z.string().optional(),
    anchorEntityId: z.string().optional(),
    partnerId: z.string().optional(),
    fiPricings: z.array(z.object({
      fiId: z.string().min(1),
      minLimit: z.number(),
      maxLimit: z.number(),
      transactionFeeRate: z.number().optional(),
      processingFeeFixed: z.number().optional(),
      penaltyFeeRate: z.number().optional(),
      autoDisburse: z.boolean().optional(),
    })).optional(),
  }),
  outputSchema: z.object({
    programId: z.string(),
    pricingCount: z.number(),
  }),
  execute: async ({ input, context }) => {
    // Create the program
    const program = await zite.programs.create({ record: {
      name: input.name,
      productType: input.productType,
      description: input.description || null,
      status: 'Active',
      programSize: input.programSize ?? null,
      creditPeriodDays: input.creditPeriodDays ?? null,
      financePercentage: input.financePercentage ?? null,
      minParticipantLimit: input.minParticipantLimit ?? null,
      maxParticipantLimit: input.maxParticipantLimit ?? null,
      programOwnerType: input.programOwnerType || null,
      anchorEntity: input.anchorEntityId || null,
      createdByPartner: input.partnerId || null,
    }});

    // Create FI pricing records if provided
    let pricingCount = 0;
    if (input.fiPricings && input.fiPricings.length > 0) {
      const pricingRecords = input.fiPricings.map((fp) => ({
        pricingName: `${input.name} - Pricing`,
        financialInstitution: fp.fiId,
        program: program.id,
        productType: input.productType,
        minLimit: fp.minLimit,
        maxLimit: fp.maxLimit,
        transactionFeeRate: fp.transactionFeeRate ?? 0,
        processingFeeFixed: fp.processingFeeFixed ?? 0,
        penaltyFeeRate: fp.penaltyFeeRate ?? 0,
        autoDisburse: fp.autoDisburse ?? false,
        status: 'Active' as const,
        processingFeeRate: null,
        pastDueDailyRate: null,
        repaymentBankAccount: null,
        tiersJson: null,
        financingRequests: null,
      }));

      await zite.fiProgramPricing.bulkCreate({ records: pricingRecords });
      pricingCount = pricingRecords.length;
    }

    return { programId: program.id, pricingCount };
  },
});
