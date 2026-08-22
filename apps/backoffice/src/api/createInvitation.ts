import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { addDays } from 'date-fns';

const ALLOWED_ENTITY_TYPES_BY_PRODUCT: Record<string, string[]> = {
  'Invoice Finance': ['Anchor', 'Dealer'],
  'Reverse Factoring': ['Supplier'],
  'Invoice Discounting': ['Supplier'],
  'Blended Finance': ['Supplier'],
  'Leasing': ['Dealer', 'Supplier', 'Anchor', 'Anchor Buyer'],
  'Warehouse Receipt': ['Supplier', 'Dealer', 'Anchor', 'Anchor Buyer'],
};

function generateCode(entityType: string): string {
  const prefix: Record<string, string> = {
    'Dealer': 'IF',
    'Supplier': 'RF',
    'Anchor Buyer': 'AB',
    'Anchor': 'AN',
    'Master Anchor': 'MA',
    'FI': 'FI',
  };
  const p = prefix[entityType] || 'XX';
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `RH-${p}-${code}`;
}

export default createEndpoint({
  description: 'Creates a new invitation with proposed limit, links to program, and auto-creates user signup link',
  inputSchema: z.object({
    entityName: z.string().min(1),
    entityType: z.string(),
    contactEmail: z.string().email(),
    contactPhone: z.string().optional(),
    productType: z.string().optional(),
    programId: z.string().optional(),
    proposedLimit: z.number().optional(),
    notes: z.string().optional(),
  }),
  outputSchema: z.object({
    id: z.string(),
    code: z.string(),
    signupUrl: z.string(),
    alreadyOnboarded: z.boolean(),
  }),
  execute: async ({ input }) => {
    // Validate entity-product compatibility
    if (input.productType) {
      const allowed = ALLOWED_ENTITY_TYPES_BY_PRODUCT[input.productType];
      if (allowed && !allowed.includes(input.entityType)) {
        throw new ZiteError(`Entity type "${input.entityType}" is not compatible with product "${input.productType}". Allowed types: ${allowed.join(', ')}`);
      }
    }

    // Check if entity already exists by email
    const { records: existingEntities } = await zite.entities.findAll({
      filters: { contactEmail: input.contactEmail },
      limit: 1,
    });

    const alreadyOnboarded = existingEntities.length > 0 &&
      (existingEntities[0].onboardingStatus === 'Active' || existingEntities[0].kycStatus === 'Approved');

    const code = generateCode(input.entityType);
    const now = new Date();
    const expiresAt = addDays(now, 14);

    const sentVia: string[] = ['Email'];
    if (input.contactPhone) sentVia.push('SMS');

    const recordData: Record<string, any> = {
      code,
      entityName: input.entityName,
      entityType: input.entityType,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone || null,
      status: 'Pending Sign-up',
      sentVia,
      sentAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    if (input.productType) recordData.productType = input.productType;
    if (input.programId) recordData.program = input.programId;
    if (input.proposedLimit != null) recordData.proposedLimit = input.proposedLimit;
    if (input.notes) recordData.notes = input.notes;

    // If already onboarded, link existing entity
    if (alreadyOnboarded && existingEntities[0]) {
      recordData.entities = existingEntities[0].id;
    }

    const record = await zite.invitations.create({ record: recordData });

    // Build signup URL — points to the Customer Portal where the code is validated
    const portalBase = process.env.ZITE_CUSTOMER_PORTAL_URL?.replace(/\/+$/, '') || '';
    const signupUrl = `${portalBase}/verify?code=${code}`;

    return {
      id: record.id,
      code,
      signupUrl,
      alreadyOnboarded,
    };
  },
});
