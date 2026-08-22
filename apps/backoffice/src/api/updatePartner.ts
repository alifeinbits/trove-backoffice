import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'Updates an API partner (details, products, status)',
  authenticated: true,
  inputSchema: z.object({
    id: z.string(),
    partnerName: z.string().optional(),
    partnerType: z.string().optional(),
    contactName: z.string().optional(),
    contactEmail: z.string().optional(),
    contactPhone: z.string().optional(),
    companyRegistration: z.string().optional(),
    country: z.string().optional(),
    website: z.string().optional(),
    enabledProducts: z.array(z.string()).optional(),
    notes: z.string().optional(),
    status: z.string().optional(),
    sandboxEnabled: z.boolean().optional(),
    productionEnabled: z.boolean().optional(),
  }),
  outputSchema: z.object({ success: z.boolean() }),
  execute: async ({ input, context }) => {
    const existing = await zite.apiPartners.findOne({ id: input.id });
    if (!existing) throw new ZiteError({ code: 'NOT_FOUND', message: 'Partner not found' });

    const record: Record<string, unknown> = {};
    if (input.partnerName !== undefined) record.partnerName = input.partnerName;
    if (input.partnerType !== undefined) record.partnerType = input.partnerType;
    if (input.contactName !== undefined) record.contactName = input.contactName;
    if (input.contactEmail !== undefined) record.contactEmail = input.contactEmail;
    if (input.contactPhone !== undefined) record.contactPhone = input.contactPhone;
    if (input.companyRegistration !== undefined) record.companyRegistration = input.companyRegistration;
    if (input.country !== undefined) record.country = input.country;
    if (input.website !== undefined) record.website = input.website;
    if (input.enabledProducts !== undefined) record.enabledProducts = input.enabledProducts;
    if (input.notes !== undefined) record.notes = input.notes;
    if (input.sandboxEnabled !== undefined) record.sandboxEnabled = input.sandboxEnabled;

    // Production access approval
    if (input.productionEnabled !== undefined) {
      record.productionEnabled = input.productionEnabled;
      if (input.productionEnabled && !existing.productionEnabled) {
        record.approvedBy = context.user.id;
        record.approvedAt = new Date().toISOString();
      }
    }

    // Status change: suspending revokes all active keys
    if (input.status !== undefined) {
      record.status = input.status;
      if (input.status === 'Suspended' || input.status === 'Revoked') {
        const { records: activeKeys } = await zite.apiKeys.findAll({
          filters: { apiPartner: input.id, status: 'Active' },
          limit: 200,
        });
        for (const key of activeKeys) {
          await zite.apiKeys.update({
            id: key.id,
            record: { status: 'Revoked', revokedAt: new Date().toISOString(), revokedBy: context.user.id },
          });
        }
      }
    }

    await zite.apiPartners.update({ id: input.id, record: record as any });
    return { success: true };
  },
});
