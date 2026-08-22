import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'Updates the role of a backoffice user (Super Admin only). For Partner Admin, also links to an API partner.',
  authenticated: true,
  inputSchema: z.object({
    id: z.string(),
    role: z.string(),
    partnerId: z.string().optional(),
  }),
  outputSchema: z.object({ success: z.boolean() }),
  execute: async ({ input, context }) => {
    // Verify caller is Super Admin
    const { records: callerRecords } = await zite.backofficeUsers.findAll({
      filters: { user: context.user.id },
      limit: 1,
    });
    if (!callerRecords[0] || callerRecords[0].role !== 'Super Admin') {
      throw new ZiteError({ code: 'FORBIDDEN', message: 'Only Super Admin can assign roles' });
    }

    const user = await zite.backofficeUsers.findOne({ id: input.id });
    if (!user) {
      throw new ZiteError({ code: 'NOT_FOUND', message: 'User not found' });
    }

    // Prevent changing another Super Admin's role (protect the bootstrap admin)
    if (user.role === 'Super Admin' && user.id !== callerRecords[0].id) {
      throw new ZiteError({ code: 'FORBIDDEN', message: "Cannot change another Super Admin's role" });
    }

    // If Partner Admin, require partnerId and validate it
    if (input.role === 'Partner Admin') {
      if (!input.partnerId) {
        throw new ZiteError({ code: 'BAD_REQUEST', message: 'Partner Admin role requires a linked partner' });
      }
      const partner = await zite.apiPartners.findOne({ id: input.partnerId });
      if (!partner) {
        throw new ZiteError({ code: 'NOT_FOUND', message: 'Partner not found' });
      }
      await zite.backofficeUsers.update({
        id: input.id,
        record: { role: input.role, apiPartner: input.partnerId },
      });
    } else {
      await zite.backofficeUsers.update({
        id: input.id,
        record: { role: input.role, apiPartner: null },
      });
    }

    return { success: true };
  },
});
