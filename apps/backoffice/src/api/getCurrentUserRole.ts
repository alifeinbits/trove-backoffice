import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'Returns the current user\'s backoffice role, auto-creating a pending record on first login',
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.object({
    role: z.string().nullable(),
    name: z.string().nullable(),
    backofficeUserId: z.string().nullable(),
    partnerId: z.string().nullable(),
    partnerName: z.string().nullable(),
  }),
  execute: async ({ context }) => {
    const userId = context.user.id;

    const { records } = await zite.backofficeUsers.findAll({
      filters: { user: userId },
      limit: 1,
    });

    let rec = records[0];

    // Auto-create a record with NO role — Super Admin assigns roles manually
    if (!rec) {
      const displayName = [context.user.firstName, context.user.lastName].filter(Boolean).join(' ') || context.user.email;

      // Check if this is the very first user (bootstrap Super Admin)
      const { records: allUsers } = await zite.backofficeUsers.findAll({ limit: 1 });
      const isFirstUser = allUsers.length === 0;

      const created = await zite.backofficeUsers.create({
        record: {
          name: displayName,
          role: isFirstUser ? 'Super Admin' : undefined,
          user: context.user.id,
        },
      });
      rec = created;
    }

    // Resolve partner if linked
    let partnerId: string | null = null;
    let partnerName: string | null = null;
    if (rec.apiPartner) {
      const pid = Array.isArray(rec.apiPartner) ? rec.apiPartner[0] : rec.apiPartner;
      if (pid) {
        const partner = await zite.apiPartners.findOne({ id: pid });
        if (partner) {
          partnerId = partner.id;
          partnerName = partner.partnerName || null;
        }
      }
    }

    return {
      role: rec.role || null,
      name: rec.name || null,
      backofficeUserId: rec.id,
      partnerId,
      partnerName,
    };
  },
});
