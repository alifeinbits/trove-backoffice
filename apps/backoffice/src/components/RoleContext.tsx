import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getCurrentUserRole } from 'zitejs/api';

export type BackofficeRole = 'Super Admin' | 'Maker' | 'Checker' | 'FI Admin' | 'FI Checker' | 'Master Anchor Admin' | 'Partner Admin' | null;

/** Display-friendly label for the raw DB role value */
export function roleDisplayLabel(role: string | null): string {
  if (role === 'Master Anchor Admin') return 'Program Owner Admin';
  return role || 'Pending';
}

interface RoleContextType {
  role: BackofficeRole;
  name: string | null;
  loading: boolean;
  /** true when user is logged in but has no assigned role yet */
  pending: boolean;
  /** Partner data — set when role is Partner Admin */
  partnerId: string | null;
  partnerName: string | null;
  isPartner: boolean;
  /** Super Admin can see everything */
  canAccess: (section: 'maker' | 'checker' | 'fi' | 'management' | 'finance' | 'risk' | 'partner') => boolean;
  refetchRole: () => void;
}

const RoleContext = createContext<RoleContextType>({
  role: null,
  name: null,
  loading: true,
  pending: false,
  partnerId: null,
  partnerName: null,
  isPartner: false,
  canAccess: () => false,
  refetchRole: () => {},
});

export function useCurrentRole() {
  return useContext(RoleContext);
}

const ACCESS_MAP: Record<string, string[]> = {
  'Super Admin': ['maker', 'checker', 'fi', 'management', 'finance', 'risk', 'partner'],
  Maker: ['maker', 'management'],
  Checker: ['checker', 'management'],
  'FI Admin': ['fi'],
  'FI Checker': ['fi'],
  'Master Anchor Admin': ['maker', 'management', 'finance', 'risk'],
  'Partner Admin': ['partner'],
};

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<BackofficeRole>(null);
  const [name, setName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState<string | null>(null);

  const fetchRole = () => {
    setLoading(true);
    getCurrentUserRole({})
      .then((r) => {
        const assignedRole = (r.role as BackofficeRole) || null;
        setRole(assignedRole);
        setName(r.name);
        setPartnerId(r.partnerId || null);
        setPartnerName(r.partnerName || null);
        setPending(!assignedRole);
      })
      .catch(() => {
        setRole(null);
        setPending(true);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRole();
  }, []);

  const canAccess = (section: string) => {
    if (!role) return false;
    const allowed = ACCESS_MAP[role];
    if (!allowed) return false;
    return allowed.includes(section);
  };

  const isPartner = role === 'Partner Admin' && !!partnerId;

  return (
    <RoleContext.Provider value={{ role, name, loading, pending, partnerId, partnerName, isPartner, canAccess, refetchRole: fetchRole }}>
      {children}
    </RoleContext.Provider>
  );
}
