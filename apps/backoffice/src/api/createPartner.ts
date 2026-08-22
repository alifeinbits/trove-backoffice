import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'Creates a new API partner',
  authenticated: true,
  inputSchema: z.object({
    partnerName: z.string().min(1),
    partnerType: z.enum(['FI', 'Master Anchor', 'Fintech']),
    contactName: z.string().min(1),
    contactEmail: z.string().email(),
    contactPhone: z.string().optional(),
    companyRegistration: z.string().optional(),
    country: z.string().optional(),
    website: z.string().optional(),
    enabledProducts: z.array(z.string()).optional(),
    notes: z.string().optional(),
  }),
  outputSchema: z.object({ id: z.string(), success: z.boolean() }),
  execute: async ({ input }) => {
    const partner = await zite.apiPartners.create({
      record: {
        partnerName: input.partnerName,
        partnerType: input.partnerType,
        status: 'Pending Approval',
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone || null,
        companyRegistration: input.companyRegistration || null,
        country: input.country || null,
        website: input.website || null,
        enabledProducts: input.enabledProducts || null,
        sandboxEnabled: true,
        productionEnabled: false,
        notes: input.notes || null,
        approvedBy: null,
        approvedAt: null,
      },
    });
    return { id: partner.id, success: true };
  },
});
