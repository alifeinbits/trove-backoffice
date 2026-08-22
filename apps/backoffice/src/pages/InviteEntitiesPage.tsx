import { useState, useEffect, useMemo } from 'react';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@project/components/ui/dialog';
import { toast } from 'sonner';
import { getInvitations, createInvitation, resendInvitation, getPrograms, GetInvitationsOutputType } from 'zitejs/api';
import { Plus, RefreshCw, Search, Copy, Check, ExternalLink, UserPlus, Shield } from 'lucide-react';
import { cn } from '@project/components/lib/utils';
import { format } from 'date-fns';
import { getInvitableEntityTypes } from '../lib/roleLabels';

type Invitation = GetInvitationsOutputType['invitations'][0];

const PRODUCT_TYPES = ['Invoice Finance', 'Reverse Factoring', 'Invoice Discounting', 'Blended Finance', 'Leasing', 'Warehouse Receipt'];

const ENTITY_TYPES_BY_PRODUCT: Record<string, string[]> = {
  'Invoice Finance': ['Dealer'],
  'Reverse Factoring': ['Supplier'],
  'Invoice Discounting': ['Supplier'],
  'Blended Finance': ['Supplier'],
  'Leasing': ['Dealer', 'Supplier', 'Anchor', 'Anchor Buyer'],
  'Warehouse Receipt': ['Dealer', 'Supplier', 'Anchor', 'Anchor Buyer'],
};

function formatKES(n: number) {
  return `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 0 })}`;
}

export default function InviteEntitiesPage() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadInvitations = () => {
    setLoading(true);
    getInvitations({})
      .then((r) => setInvitations(r.invitations))
      .catch(() => toast.error('Failed to load invitations'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadInvitations(); }, []);

  const filtered = useMemo(() => {
    return invitations.filter((i) => {
      if (search && !i.entityName?.toLowerCase().includes(search.toLowerCase()) && !i.contactEmail?.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== 'all' && i.status !== statusFilter) return false;
      return true;
    });
  }, [invitations, search, statusFilter]);

  const handleResend = async (id: string) => {
    try {
      await resendInvitation({ id });
      toast.success('Invitation resent');
      loadInvitations();
    } catch (err: any) { toast.error(err?.message || 'Failed to resend'); }
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Invitations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Invite entities to join programs with proposed limits</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-1.5">
          <UserPlus className="w-4 h-4" /> New Invitation
        </Button>
      </div>

      <div className="flex gap-3 mb-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Pending Sign-up">Pending Sign-up</SelectItem>
            <SelectItem value="Signed Up">Signed Up</SelectItem>
            <SelectItem value="Onboarding">Onboarding</SelectItem>
            <SelectItem value="Expired">Expired</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search entity or email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground text-left bg-muted/30">
              <th className="py-2.5 px-4 font-medium">Entity</th>
              <th className="py-2.5 px-4 font-medium">Product / Program</th>
              <th className="py-2.5 px-4 font-medium">Proposed Limit</th>
              <th className="py-2.5 px-4 font-medium">Code</th>
              <th className="py-2.5 px-4 font-medium">Status</th>
              <th className="py-2.5 px-4 font-medium">Sent</th>
              <th className="py-2.5 px-4 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">No invitations found</td></tr>
            ) : (
              filtered.map((inv) => (
                <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="py-3 px-4">
                    <div>
                      <p className="font-medium text-foreground">{inv.entityName}</p>
                      <p className="text-xs text-muted-foreground">{inv.entityType} · {inv.contactEmail}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div>
                      {inv.productType && <p className="text-xs font-medium text-foreground">{inv.productType}</p>}
                      {inv.programName && <p className="text-xs text-muted-foreground">{inv.programName}</p>}
                      {!inv.productType && !inv.programName && <span className="text-xs text-muted-foreground">—</span>}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    {inv.proposedLimit ? (
                      <span className="text-sm font-medium text-foreground">{formatKES(inv.proposedLimit)}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <CopyableCode code={inv.code || ''} />
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={inv.status || ''} alreadyOnboarded={inv.alreadyOnboarded} />
                  </td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">
                    {inv.sentAt ? format(new Date(inv.sentAt), 'dd MMM yy') : '—'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {inv.status === 'Pending Sign-up' || inv.status === 'Expired' ? (
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleResend(inv.id)}>
                        <RefreshCw className="w-3 h-3 mr-1" /> Resend
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <CreateInvitationDialog open={showCreate} onClose={() => setShowCreate(false)} onCreated={loadInvitations} />
    </div>
  );
}

function CopyableCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  if (!code) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      {code}
      {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

function StatusBadge({ status, alreadyOnboarded }: { status: string; alreadyOnboarded?: boolean }) {
  const map: Record<string, string> = {
    'Pending Sign-up': 'bg-amber-500/10 text-amber-700',
    'Signed Up': 'bg-blue-500/10 text-blue-600',
    'Onboarding': 'bg-primary/10 text-primary',
    'Expired': 'bg-destructive/10 text-destructive',
  };
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', map[status] || 'bg-muted text-muted-foreground')}>
        {status}
      </span>
      {alreadyOnboarded && (
        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 flex items-center gap-0.5">
          <Shield className="w-2.5 h-2.5" /> Onboarded
        </span>
      )}
    </div>
  );
}

function CreateInvitationDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [entityName, setEntityName] = useState('');
  const [entityType, setEntityType] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+254');
  const [productType, setProductType] = useState('');
  const [programId, setProgramId] = useState('');
  const [proposedLimit, setProposedLimit] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ code: string; signupUrl: string; alreadyOnboarded: boolean } | null>(null);
  const [programs, setPrograms] = useState<any[]>([]);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (open) {
      getPrograms({}).then(r => setPrograms(r.programs)).catch(() => {});
    }
  }, [open]);

  const filteredPrograms = useMemo(() => {
    if (!productType) return programs;
    return programs.filter((p: any) => p.productType === productType);
  }, [programs, productType]);

  const entityTypeOptions = getInvitableEntityTypes(productType || null);

  const handleCreate = async () => {
    if (!entityName || !entityType || !email) {
      toast.error('Entity name, type, and email are required');
      return;
    }
    setSaving(true);
    try {
      const res = await createInvitation({
        entityName, entityType, contactEmail: email,
        contactPhone: phone || undefined,
        productType: productType || undefined,
        programId: programId || undefined,
        proposedLimit: proposedLimit ? Number(proposedLimit) : undefined,
        notes: notes || undefined,
      });
      setResult({ code: res.code, signupUrl: res.signupUrl, alreadyOnboarded: res.alreadyOnboarded });
      onCreated();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create invitation');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    setEntityName(''); setEntityType(''); setEmail(''); setPhone('+254');
    setProductType(''); setProgramId(''); setProposedLimit(''); setNotes('');
    onClose();
  };

  const copyLink = () => {
    if (result?.signupUrl) {
      navigator.clipboard.writeText(result.signupUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{result ? 'Invitation Created' : 'New Invitation'}</DialogTitle>
          {!result && <DialogDescription>Invite an entity to join a program. You propose the initial limit.</DialogDescription>}
        </DialogHeader>

        {result ? (
          <div className="space-y-4 py-2">
            {result.alreadyOnboarded && (
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
                <p className="text-sm font-medium text-emerald-700">Entity already onboarded</p>
                <p className="text-xs text-emerald-600 mt-0.5">They can accept this program invitation without re-onboarding.</p>
              </div>
            )}
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Invitation Code</p>
                <p className="font-mono text-lg font-bold text-foreground">{result.code}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Signup Link</p>
                <div className="flex items-center gap-2">
                  <Input value={result.signupUrl} readOnly className="font-mono text-xs flex-1" />
                  <Button variant="outline" size="sm" onClick={copyLink} className="shrink-0 gap-1">
                    {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedLink ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Share this link with the entity operator so they can sign up and start onboarding.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Entity Name <span className="text-destructive">*</span></Label>
                <Input value={entityName} onChange={(e) => setEntityName(e.target.value)} className="mt-1" placeholder="e.g. Acme Trading Ltd" />
              </div>
              <div>
                <Label>Product</Label>
                <Select value={productType} onValueChange={(v) => { setProductType(v); setEntityType(''); setProgramId(''); }}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>
                    {PRODUCT_TYPES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Entity Type <span className="text-destructive">*</span></Label>
                <Select value={entityType} onValueChange={setEntityType}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {entityTypeOptions.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Program</Label>
                <Select value={programId} onValueChange={setProgramId}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select program (optional)" /></SelectTrigger>
                  <SelectContent>
                    {filteredPrograms.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Proposed Limit (KES)</Label>
                <Input type="number" value={proposedLimit} onChange={(e) => setProposedLimit(e.target.value)} className="mt-1" placeholder="e.g. 500000" />
              </div>
              <div>
                <Label>Contact Email <span className="text-destructive">*</span></Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" placeholder="rep@company.co.ke" />
              </div>
              <div>
                <Label>Contact Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" placeholder="+254755777888" />
              </div>
              <div className="col-span-2">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" placeholder="Optional notes about this invitation..." rows={2} />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button onClick={handleClose}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleCreate} disabled={saving}>{saving ? 'Creating...' : 'Send Invitation'}</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
