import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'Returns bank accounts for an entity, used to auto-fill disbursement details',
  inputSchema: z.object({ entityId: z.string() }),
  outputSchema: z.object({
    bankAccounts: z.array(z.object({
      id: z.string(),
      accountName: z.string(),
      bankName: z.string(),
      branchName: z.string(),
      accountNumber: z.string(),
      bankCode: z.string(),
      swiftCode: z.string(),
      accountType: z.string(),
      mobileMoneyNumber: z.string(),
      isPrimary: z.boolean(),
      isVerified: z.boolean(),
    })),
  }),
  execute: async ({ input }) => {
    const result = await zite.sql({
      query: `
        SELECT ba.* FROM "BankAccounts" ba
        JOIN "BankAccountsEntities" bae ON bae."bankAccountsId" = ba.id
        WHERE bae."entitiesId" = $1 AND ba."status" = 'Active'
        ORDER BY ba."isPrimary" DESC NULLS LAST, ba.created_at DESC
      `,
      params: [input.entityId],
    });

    const bankAccounts = (result.rows as any[]).map(r => ({
      id: String(r.id),
      accountName: String(r.accountName || ''),
      bankName: String(r.bankName || ''),
      branchName: String(r.branchName || ''),
      accountNumber: String(r.accountNumber || ''),
      bankCode: String(r.bankCode || ''),
      swiftCode: String(r.swiftCode || ''),
      accountType: String(r.accountType || ''),
      mobileMoneyNumber: String(r.mobileMoneyNumber || ''),
      isPrimary: !!r.isPrimary,
      isVerified: !!r.isVerified,
    }));

    return { bankAccounts };
  },
});
