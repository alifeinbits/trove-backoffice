import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'Toggles the Allow Self-Invoicing flag on an entity',
  inputSchema: z.object({
    entityId: z.string(),
    allow: z.boolean(),
  }),
  outputSchema: z.object({ success: z.boolean(), allowSelfInvoicing: z.boolean() }),
  execute: async ({ input }) => {
    const entity = await zite.entities.findOne({ id: input.entityId });
    if (!entity) throw new ZiteError({ code: 'NOT_FOUND', message: 'Entity not found' });

    await zite.entities.update({
      id: input.entityId,
      record: { allowSelfInvoicing: input.allow },
    });

    return { success: true, allowSelfInvoicing: input.allow };
  },
});
