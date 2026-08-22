import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@project/components/ui/button';
import { Skeleton } from '@project/components/ui/skeleton';
import { Textarea } from '@project/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@project/components/ui/alert-dialog';
import { Switch } from '@project/components/ui/switch';
import { toast } from 'sonner';
import { getEntityDetail, reviewOnboarding, verifyDocument, toggleSelfInvoicing } from 'zitejs/api';
import { ArrowLeft, CheckCircle2, XCircle, FileText, Users, CreditCard, Building2, Shield, Layers, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { DocumentPreviewButton, DocumentPreviewModal } from '../components/DocumentPreview';
import type { PreviewableDoc } from '../components/DocumentPreview';
import { MoneyFlowBadge } from '../components/MoneyFlow';

function formatKES(n: number) {
  return `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 0 })}`;
}

function Badge({ status, map }: { status: string; map: Record<string, string> }) {
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-muted text-muted-foreground'}`}>{status}</span>;
}

const kycMap: Record<string, string> = {
  Approved: 'bg-emerald-500/10 text-emerald-600',
  'In Review': 'bg-blue-500/10 text-blue-600',
  Pending: 'bg-yellow-500/10 text-yellow-700',
  Rejected: 'bg-red-500/10 text-red-600',
};

const onbMap: Record<string, string> = {
  Completed: 'bg-emerald-500/10 text-emerald-600',
  'Awaiting Review': 'bg-yellow-500/10 text-yellow-700',
  'In Progress': 'bg-blue-500/10 text-blue-600',
  Approved: 'bg-emerald-500/10 text-emerald-600',
  Rejected: 'bg-red-500/10 text-red-600',
  'Sent to FI': 'bg-purple-500/10 text-purple-600',
  'Offer Received': 'bg-indigo-500/10 text-indigo-600',
};

export default function EntityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [reviewDialog, setReviewDialog] = useState<{ onboardingId: string; role: 'Maker' | 'Checker'; decision: 'Approved' | 'Rejected' } | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [docAction, setDocAction] = useState<{ docId: string; decision: 'Verified' | 'Rejected' } | null>(null);

  const load = () => {
    if (!id) return;
    setLoading(true);
    getEntityDetail({ entityId: id })
      .then(r => setData(r.entity))
      .catch(() => toast.error('Failed to load entity'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  if (loading) return <div className="p-8"><Skeleton className="h-8 w-64 mb-4" /><Skeleton className="h-64" /></div>;
  if (!data) return <div className="p-8 text-muted-foreground">Entity not found</div>;

  const tabs = [
    { key: 'overview', label: 'Overview', icon: Building2 },
    { key: 'onboarding', label: 'Onboarding', icon: Shield },
    { key: 'programs', label: 'Programs', icon: Layers },
    { key: 'financing', label: 'Financing', icon: FileText },
    { key: 'people', label: 'People', icon: Users },
  ];

  const handleReview = async () => {
    if (!reviewDialog) return;
    try {
      await reviewOnboarding({
        onboardingId: reviewDialog.onboardingId,
        reviewerRole: reviewDialog.role,
        decision: reviewDialog.decision,
        notes: reviewNotes || undefined,
      });
      toast.success(`Onboarding ${reviewDialog.decision.toLowerCase()}`);
      setReviewDialog(null);
      setReviewNotes('');
      load();
    } catch { toast.error('Failed to update'); }
  };

  const handleDocAction = async () => {
    if (!docAction) return;
    try {
      await verifyDocument({ documentId: docAction.docId, decision: docAction.decision });
      toast.success(`Document ${docAction.decision.toLowerCase()}`);
      setDocAction(null);
      load();
    } catch { toast.error('Failed to update'); }
  };

  return (
    <div className="p-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">{data.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm text-muted-foreground">{data.entityType}</span>
            <Badge status={data.kycStatus || 'Pending'} map={kycMap} />
            {data.onboardingStatus && <Badge status={data.onboardingStatus} map={onbMap} />}
          </div>
        </div>
        <div className="text-right text-sm text-muted-foreground space-y-1">
          {data.contactEmail && <p>{data.contactEmail}</p>}
          {data.contactPhone && <p>{data.contactPhone}</p>}
          {data.registrationNumber && <p>Reg: {data.registrationNumber}</p>}
          {(data.entityType === 'Dealer' || data.entityType === 'Supplier') && (
            <div className="flex items-center justify-end gap-2 pt-1">
              <span className="text-xs font-medium text-foreground">Self-Invoicing</span>
              <Switch
                checked={!!data.allowSelfInvoicing}
                onCheckedChange={async (checked) => {
                  try {
                    await toggleSelfInvoicing({ entityId: data.id, allow: checked });
                    setData((prev: any) => ({ ...prev, allowSelfInvoicing: checked }));
                    toast.success(checked ? 'Self-invoicing enabled' : 'Self-invoicing disabled');
                  } catch { toast.error('Failed to update'); }
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <StatCard label="Approved Limit" value={data.approvedLimit ? formatKES(data.approvedLimit) : '—'} />
        <StatCard label="Programs" value={String(data.programs?.length || 0)} />
        <StatCard label="Active Loans" value={String(data.loans?.filter((l: any) => l.status === 'Active').length || 0)} />
        <StatCard label="Invoices" value={String(data.invoices?.length || 0)} />
        <StatCard label="Offer Letters" value={String(data.offerLetters?.length || 0)} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-6">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm transition-colors border-b-2 -mb-px ${tab === t.key ? 'border-primary text-foreground font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && <OverviewTab data={data} />}
      {tab === 'onboarding' && <OnboardingTab data={data} onReview={setReviewDialog} onDocAction={setDocAction} />}
      {tab === 'programs' && <ProgramsTab data={data} navigate={navigate} />}
      {tab === 'financing' && <FinancingTab data={data} />}
      {tab === 'people' && <PeopleTab data={data} />}

      {/* Review dialog */}
      <AlertDialog open={!!reviewDialog} onOpenChange={o => !o && setReviewDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{reviewDialog?.role} Review — {reviewDialog?.decision}</AlertDialogTitle>
            <AlertDialogDescription>Add notes for this {reviewDialog?.decision === 'Approved' ? 'approval' : 'rejection'}.</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea placeholder="Notes..." value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} className="min-h-[80px]" />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReview}>{reviewDialog?.decision === 'Approved' ? 'Approve' : 'Reject'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Doc action dialog */}
      <AlertDialog open={!!docAction} onOpenChange={o => !o && setDocAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{docAction?.decision === 'Verified' ? 'Verify Document' : 'Reject Document'}</AlertDialogTitle>
            <AlertDialogDescription>Are you sure?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDocAction}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border rounded-lg p-3 bg-card">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold text-foreground">{value}</p>
    </div>
  );
}

function OverviewTab({ data }: { data: any }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Section title="Business Details">
        <Detail label="Name" value={data.name} />
        <Detail label="Entity Type" value={data.entityType} />
        <Detail label="Registration #" value={data.registrationNumber} />
        <Detail label="KRA PIN" value={data.kraPin} />
        <Detail label="Business Sector" value={data.businessSector} />
        <Detail label="Physical Address" value={data.physicalAddress} />
        <Detail label="Email" value={data.contactEmail} />
        <Detail label="Phone" value={data.contactPhone} />
      </Section>
      <Section title="Limits & Offers">
        <Detail label="Approved Limit" value={data.approvedLimit ? formatKES(data.approvedLimit) : '—'} />
        {(data.limitProposals || []).map((lp: any) => (
          <div key={lp.id} className="border border-border rounded p-2 mt-2 text-xs">
            <div className="flex justify-between">
              <span>#{lp.proposalNumber} — {lp.programName}</span>
              <Badge status={lp.status} map={{ Pending: 'bg-yellow-500/10 text-yellow-700', Approved: 'bg-emerald-500/10 text-emerald-600', Rejected: 'bg-red-500/10 text-red-600', Assessed: 'bg-blue-500/10 text-blue-600' }} />
            </div>
            <p className="text-muted-foreground mt-1">Proposed: {formatKES(Number(lp.proposedAmount || 0))} {lp.approvedAmount ? ` → Approved: ${formatKES(Number(lp.approvedAmount))}` : ''}</p>
          </div>
        ))}
      </Section>
    </div>
  );
}

function OnboardingTab({ data, onReview, onDocAction }: { data: any; onReview: (r: any) => void; onDocAction: (d: any) => void }) {
  return (
    <div className="space-y-6">
      {(data.onboardings || []).length === 0 ? (
        <p className="text-muted-foreground text-sm">No onboarding records</p>
      ) : (data.onboardings || []).map((o: any) => (
        <div key={o.id} className="border border-border rounded-lg bg-card">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">{o.programName || 'Unknown Program'}</p>
              <div className="flex gap-2 mt-1">
                <span className="text-xs text-muted-foreground">{o.productType}</span>
                <Badge status={o.overallStatus || ''} map={onbMap} />
                <span className="text-xs text-muted-foreground">Stage: {o.currentStage}</span>
              </div>
            </div>
            <div className="flex gap-2">
              {(o.currentStage === 'Maker Review' || o.currentStage === 'Submitted for Review') && !o.makerReviewedAt && (
                <>
                  <Button size="sm" variant="outline" className="text-emerald-600 h-7 text-xs" onClick={() => onReview({ onboardingId: o.id, role: 'Maker', decision: 'Approved' })}>
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Maker Approve
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-600 h-7 text-xs" onClick={() => onReview({ onboardingId: o.id, role: 'Maker', decision: 'Rejected' })}>
                    <XCircle className="w-3 h-3 mr-1" /> Reject
                  </Button>
                </>
              )}
              {o.currentStage === 'Checker Review' && !o.checkerReviewedAt && (
                <>
                  <Button size="sm" variant="outline" className="text-emerald-600 h-7 text-xs" onClick={() => onReview({ onboardingId: o.id, role: 'Checker', decision: 'Approved' })}>
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Checker Approve
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-600 h-7 text-xs" onClick={() => onReview({ onboardingId: o.id, role: 'Checker', decision: 'Rejected' })}>
                    <XCircle className="w-3 h-3 mr-1" /> Reject
                  </Button>
                </>
              )}
            </div>
          </div>
          {/* Review trail */}
          <div className="p-4 space-y-2">
            {o.makerReviewedAt && (
              <div className="text-xs"><span className="font-medium text-foreground">Maker:</span> {o.makerReviewedBy} — {format(new Date(o.makerReviewedAt), 'dd MMM yy HH:mm')}{o.makerNotes ? ` — "${o.makerNotes}"` : ''}</div>
            )}
            {o.checkerReviewedAt && (
              <div className="text-xs"><span className="font-medium text-foreground">Checker:</span> {o.checkerReviewedBy} — {format(new Date(o.checkerReviewedAt), 'dd MMM yy HH:mm')}{o.checkerNotes ? ` — "${o.checkerNotes}"` : ''}</div>
            )}
          </div>
        </div>
      ))}

      {/* Documents */}
      {(data.documents || []).length > 0 && (
        <div className="border border-border rounded-lg bg-card">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-foreground text-sm">KYC Documents</h3>
          </div>
          <div className="divide-y divide-border">
            {data.documents.map((d: any) => (
              <div key={d.id} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <p className="text-sm font-medium text-foreground">{d.documentName || d.documentType}</p>
                  <p className="text-xs text-muted-foreground">{d.documentType} {d.uploadedAt ? `• ${format(new Date(d.uploadedAt), 'dd MMM yy')}` : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  {d.fileUrl && (
                    <DocumentPreviewButton doc={{ url: d.fileUrl, name: d.documentName || d.documentType, mimeType: d.fileMimeType }} />
                  )}
                  <Badge status={d.verificationStatus || 'Pending Verification'} map={{
                    'Pending Verification': 'bg-yellow-500/10 text-yellow-700',
                    Verified: 'bg-emerald-500/10 text-emerald-600',
                    Rejected: 'bg-red-500/10 text-red-600',
                  }} />
                  {d.verificationStatus === 'Pending Verification' && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-6 text-xs text-emerald-600" onClick={() => onDocAction({ docId: d.id, decision: 'Verified' })}>✓</Button>
                      <Button variant="ghost" size="sm" className="h-6 text-xs text-red-600" onClick={() => onDocAction({ docId: d.id, decision: 'Rejected' })}>✗</Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProgramsTab({ data, navigate }: { data: any; navigate: any }) {
  return (
    <div className="space-y-3">
      {(data.programs || []).length === 0 ? (
        <p className="text-muted-foreground text-sm">Not enrolled in any programs</p>
      ) : (data.programs || []).map((p: any) => (
        <button key={p.id} onClick={() => navigate(`/programs/${p.id}`)} className="w-full border border-border rounded-lg p-4 bg-card text-left hover:border-primary/40 transition-colors">
          <div className="flex justify-between">
            <div>
              <p className="font-medium text-foreground">{p.name}</p>
              <p className="text-xs text-muted-foreground">{p.productType}</p>
            </div>
            <Badge status={p.status || 'Active'} map={{ Active: 'bg-emerald-500/10 text-emerald-600', Suspended: 'bg-yellow-500/10 text-yellow-700', Closed: 'bg-muted text-muted-foreground' }} />
          </div>
        </button>
      ))}
    </div>
  );
}

function FinancingTab({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      {/* Loans */}
      <Section title={`Loans (${data.loans?.length || 0})`}>
        {(data.loans || []).length === 0 ? <p className="text-sm text-muted-foreground">No loans</p> : (
          <div className="space-y-2">
            {data.loans.map((l: any) => (
              <div key={l.id} className="border border-border rounded p-3 flex justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{l.loanReference}</p>
                  <p className="text-xs text-muted-foreground">{l.productType} • {l.programName}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{formatKES(Number(l.outstandingBalance || 0))}</p>
                  <Badge status={l.status} map={{ Active: 'bg-emerald-500/10 text-emerald-600', Overdue: 'bg-red-500/10 text-red-600', Settled: 'bg-muted text-muted-foreground' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Invoices */}
      <Section title={`Invoices (${data.invoices?.length || 0})`}>
        {(data.invoices || []).length === 0 ? <p className="text-sm text-muted-foreground">No invoices</p> : (
          <div className="space-y-2">
            {data.invoices.map((i: any) => (
              <div key={i.id} className="border border-border rounded p-3 flex justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{i.invoiceNumber}</p>
                  <p className="text-xs text-muted-foreground">{i.productType} • {i.programName}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{formatKES(Number(i.amount || 0))}</p>
                  <Badge status={i.status} map={{ Uploaded: 'bg-muted text-muted-foreground', Verified: 'bg-emerald-500/10 text-emerald-600', 'Fully Financed': 'bg-blue-500/10 text-blue-600', 'Early Paid': 'bg-blue-500/10 text-blue-600', Paid: 'bg-emerald-500/10 text-emerald-600' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function PeopleTab({ data }: { data: any }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Section title={`Owners (${data.owners?.length || 0})`}>
        {(data.owners || []).map((o: any) => (
          <div key={o.id} className="border border-border rounded p-3 mb-2">
            <p className="text-sm font-medium text-foreground">{o.fullName} {o.isPrimaryContact ? '(Primary)' : ''}</p>
            <p className="text-xs text-muted-foreground">{o.idType}: {o.idNumber} • {o.ownershipPercentage}%</p>
            <p className="text-xs text-muted-foreground">{o.email} • {o.phone}</p>
          </div>
        ))}
        {(data.owners || []).length === 0 && <p className="text-sm text-muted-foreground">No owners recorded</p>}
      </Section>
      <Section title={`Operators (${data.operators?.length || 0})`}>
        {(data.operators || []).map((o: any) => (
          <div key={o.id} className="border border-border rounded p-3 mb-2">
            <p className="text-sm font-medium text-foreground">{o.fullName} {o.isAuthorizedSignatory ? '(Signatory)' : ''}</p>
            <p className="text-xs text-muted-foreground">{o.role}</p>
            <p className="text-xs text-muted-foreground">{o.email} • {o.phone}</p>
          </div>
        ))}
        {(data.operators || []).length === 0 && <p className="text-sm text-muted-foreground">No operators recorded</p>}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-lg bg-card">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="font-semibold text-foreground text-sm">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value || '—'}</span>
    </div>
  );
}
