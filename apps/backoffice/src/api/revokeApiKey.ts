import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'Revokes an API key',
  authenticated: true,
  inputSchema: z.object({ keyId: z.string() }),
  outputSchema: z.object({ success: z.boolean() }),
  execute: async ({ input, context }) => {
    const key = await zite.apiKeys.findOne({ id: input.keyId });
    if (!key) throw new ZiteError({ code: 'NOT_FOUND', message: 'Key not found' });
    if (key.status === 'Revoked') throw new ZiteError({ code: 'BAD_REQUEST', message: 'Key already revoked' });

    await zite.apiKeys.update({
      id: input.keyId,
      record: {
        status: 'Revoked',
        revokedAt: new Date().toISOString(),
        revokedBy: context.user.id,
      },
    });

    return { success: true };
  },
});
