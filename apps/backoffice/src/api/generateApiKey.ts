import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';

function generateRandomKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 40; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default createEndpoint({
  description: 'Generates a new API key for a partner (sandbox or production). Returns the full key only once.',
  authenticated: true,
  inputSchema: z.object({
    partnerId: z.string(),
    environment: z.enum(['Sandbox', 'Production']),
    label: z.string().optional(),
  }),
  outputSchema: z.object({
    keyId: z.string(),
    fullKey: z.string(),
    prefix: z.string(),
    hint: z.string(),
  }),
  execute: async ({ input }) => {
    const partner = await zite.apiPartners.findOne({ id: input.partnerId });
    if (!partner) throw new ZiteError({ code: 'NOT_FOUND', message: 'Partner not found' });

    if (partner.status !== 'Active') {
      throw new ZiteError({ code: 'BAD_REQUEST', message: 'Partner must be Active to generate keys' });
    }

    if (input.environment === 'Production' && !partner.productionEnabled) {
      throw new ZiteError({ code: 'BAD_REQUEST', message: 'Production access not enabled for this partner' });
    }

    const prefix = input.environment === 'Sandbox' ? 'sk_test_' : 'sk_live_';
    const randomPart = generateRandomKey();
    const fullKey = prefix + randomPart;
    const keyHash = await sha256(fullKey);
    const keyHint = randomPart.slice(-4);
    const keyPrefix = prefix + randomPart.slice(0, 8) + '...';

    const keyRecord = await zite.apiKeys.create({
      record: {
        keyPrefix: keyPrefix,
        apiPartner: input.partnerId,
        environment: input.environment,
        keyHash: keyHash,
        keyHint: keyHint,
        label: input.label || `${input.environment} Key`,
        status: 'Active',
        lastUsedAt: null,
        revokedAt: null,
        revokedBy: null,
        expiresAt: null,
        apiActivityLog: null,
      },
    });

    return {
      keyId: keyRecord.id,
      fullKey,
      prefix: keyPrefix,
      hint: keyHint,
    };
  },
});
