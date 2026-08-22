import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'Creates or updates FI program pricing with tiers',
  inputSchema: z.object({
    programId: z.string(),
    fiId: z.string(),
    productType: z.string(),
    minLimit: z.number(),
    maxLimit: z.number(),
    transactionFeeRate: z.number(),
    processingFeeFixed: z.number().optional(),
    processingFeeRate: z.number().optional(),
    penaltyFeeRate: z.number().optional(),
    pastDueDailyRate: z.number().optional(),
    interestRate: z.number().optional(),
    tenorDays: z.number().optional(),
    troveFeeRate: z.number().optional(),
    troveFeeFixed: z.number().optional(),
    fiChargeRate: z.number().optional(),
    fiChargeFixed: z.number().optional(),
    repaymentBankAccount: z.string().optional(),
    autoDisburse: z.boolean().optional(),
    tiers: z.array(z.object({
      tierName: z.string(),
      minAmount: z.number(),
      maxAmount: z.number(),
      interestRate: z.number(),
      tenorDays: z.number(),
    })).optional(),
  }),
  outputSchema: z.object({ success: z.boolean(), pricingId: z.string() }),
  execute: async ({ input }) => {
    // Get FI name for pricing name
    const fi = await zite.financialInstitutions.findOne({ id: input.fiId });
    const program = await zite.programs.findOne({ id: input.programId });

    const pricingName = `${fi?.tradingName || fi?.legalName || 'FI'} - ${program?.name || 'Program'}`;

    const record = await zite.fiProgramPricing.create({
      record: {
        pricingName,
        financialInstitution: input.fiId,
        program: input.programId,
        productType: input.productType as any,
        minLimit: input.minLimit,
        maxLimit: input.maxLimit,
        transactionFeeRate: input.transactionFeeRate / 100,
        processingFeeFixed: input.processingFeeFixed || 0,
        processingFeeRate: (input.processingFeeRate || 0) / 100,
        penaltyFeeRate: (input.penaltyFeeRate || 0) / 100,
        pastDueDailyRate: (input.pastDueDailyRate || 0) / 100,
        interestRate: (input.interestRate || 0) / 100,
        tenorDays: input.tenorDays || 0,
        troveFeeRate: (input.troveFeeRate || 0) / 100,
        troveFeeFixed: input.troveFeeFixed || 0,
        fiChargeRate: (input.fiChargeRate || 0) / 100,
        fiChargeFixed: input.fiChargeFixed || 0,
        repaymentBankAccount: input.repaymentBankAccount || null,
        tiersJson: input.tiers ? JSON.stringify(input.tiers) : null,
        autoDisburse: input.autoDisburse ?? false,
        status: 'Active',
      },
    });

    return { success: true, pricingId: record.id };
  },
});
