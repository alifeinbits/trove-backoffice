/**
 * Dynamic role labels based on product type.
 *
 * The underlying DB values (Dealer, Supplier, Anchor Buyer, etc.) stay unchanged.
 * This utility maps them to user-facing labels that make sense in the context
 * of the program's product type.
 */

export type ProductType =
  | 'Invoice Finance'
  | 'Reverse Factoring'
  | 'Invoice Discounting'
  | 'Blended Finance'
  | 'Leasing'
  | 'Warehouse Receipt';

export interface RoleLabels {
  /** The entity that owns / initiated the program */
  ownerLabel: string;
  /** The counterparty entities in the program */
  counterpartyLabel: string;
  /** Plural form of owner */
  ownerLabelPlural: string;
  /** Plural form of counterparty */
  counterpartyLabelPlural: string;
  /** Short flow description, e.g. "Buyer → Seller" */
  flowDescription: string;
}

const ROLE_MAP: Record<string, RoleLabels> = {
  'Invoice Finance': {
    ownerLabel: 'Buyer',
    counterpartyLabel: 'Seller',
    ownerLabelPlural: 'Buyers',
    counterpartyLabelPlural: 'Sellers',
    flowDescription: 'Buyer → Seller',
  },
  'Reverse Factoring': {
    ownerLabel: 'Buyer',
    counterpartyLabel: 'Supplier',
    ownerLabelPlural: 'Buyers',
    counterpartyLabelPlural: 'Suppliers',
    flowDescription: 'Buyer → Supplier',
  },
  'Invoice Discounting': {
    ownerLabel: 'Buyer',
    counterpartyLabel: 'Seller',
    ownerLabelPlural: 'Buyers',
    counterpartyLabelPlural: 'Sellers',
    flowDescription: 'Seller → FI',
  },
  'Blended Finance': {
    ownerLabel: 'Buyer',
    counterpartyLabel: 'Supplier',
    ownerLabelPlural: 'Buyers',
    counterpartyLabelPlural: 'Suppliers',
    flowDescription: 'FI + DFI → Supplier',
  },
  'Leasing': {
    ownerLabel: 'Lessor',
    counterpartyLabel: 'Lessee',
    ownerLabelPlural: 'Lessors',
    counterpartyLabelPlural: 'Lessees',
    flowDescription: 'Lessor → Lessee',
  },
  'Warehouse Receipt': {
    ownerLabel: 'Off-taker',
    counterpartyLabel: 'Depositor',
    ownerLabelPlural: 'Off-takers',
    counterpartyLabelPlural: 'Depositors',
    flowDescription: 'Depositor → Warehouse',
  },
};

const DEFAULT_LABELS: RoleLabels = {
  ownerLabel: 'Program Owner',
  counterpartyLabel: 'Counterparty',
  ownerLabelPlural: 'Program Owners',
  counterpartyLabelPlural: 'Counterparties',
  flowDescription: 'Owner → Counterparty',
};

/**
 * Get contextual role labels for a product type.
 */
export function getRoleLabels(productType?: string | null): RoleLabels {
  if (!productType) return DEFAULT_LABELS;
  return ROLE_MAP[productType] || DEFAULT_LABELS;
}

/**
 * Map a DB entity type to a user-facing display label in the context of a product type.
 * Falls back to the raw DB value if no mapping exists.
 */
export function getEntityDisplayLabel(
  entityType: string | null | undefined,
  productType?: string | null,
): string {
  if (!entityType) return 'Entity';
  const labels = getRoleLabels(productType);

  // Map DB entity types to contextual labels
  switch (entityType) {
    case 'Anchor Buyer':
    case 'Anchor':
    case 'Master Anchor':
      return labels.ownerLabel;
    case 'Dealer':
    case 'Supplier':
      return labels.counterpartyLabel;
    case 'FI':
      return 'Financial Institution';
    default:
      return entityType;
  }
}

/**
 * Entity types available for inviting into a program (by product type).
 * Returns the contextual display labels mapped to DB values.
 */
export function getInvitableEntityTypes(productType?: string | null): { value: string; label: string }[] {
  const labels = getRoleLabels(productType);
  switch (productType) {
    case 'Invoice Finance':
      return [
        { value: 'Dealer', label: labels.counterpartyLabel },
      ];
    case 'Reverse Factoring':
    case 'Invoice Discounting':
    case 'Blended Finance':
      return [
        { value: 'Supplier', label: labels.counterpartyLabel },
      ];
    case 'Leasing':
    case 'Warehouse Receipt':
      return [
        { value: 'Dealer', label: 'Dealer' },
        { value: 'Supplier', label: 'Supplier' },
        { value: 'Anchor', label: labels.ownerLabel },
        { value: 'Anchor Buyer', label: labels.ownerLabel },
      ];
    default:
      return [
        { value: 'Dealer', label: labels.counterpartyLabel },
        { value: 'Supplier', label: labels.counterpartyLabel },
        { value: 'Anchor Buyer', label: labels.ownerLabel },
        { value: 'Anchor', label: labels.ownerLabel },
      ];
  }
}

/**
 * Map the legacy "programOwnerType" DB value to a display label.
 */
export function getProgramOwnerLabel(ownerType?: string | null): string {
  switch (ownerType) {
    case 'Master Anchor': return 'Program Owner';
    case 'Anchor Buyer': return 'Program Owner';
    case 'FI': return 'Financial Institution';
    default: return ownerType || 'Program Owner';
  }
}

/**
 * Map legacy "Master Anchor Admin" role to display label.
 */
export function getRoleDisplayLabel(role?: string | null): string {
  switch (role) {
    case 'Master Anchor Admin': return 'Program Owner Admin';
    case 'Super Admin': return 'Super Admin';
    case 'Maker': return 'Maker';
    case 'Checker': return 'Checker';
    case 'FI Admin': return 'FI Admin';
    case 'FI Checker': return 'FI Checker';
    case 'Partner Admin': return 'Partner Admin';
    default: return role || 'Pending';
  }
}

/**
 * Map partner types to display labels.
 */
export function getPartnerTypeLabel(partnerType?: string | null): string {
  switch (partnerType) {
    case 'Master Anchor': return 'Program Owner';
    case 'FI': return 'Financial Institution';
    case 'Fintech': return 'Fintech';
    default: return partnerType || 'Partner';
  }
}
