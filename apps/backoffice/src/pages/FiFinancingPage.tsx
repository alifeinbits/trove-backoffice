import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@project/components/ui/button';
import { Skeleton } from '@project/components/ui/skeleton';
import { Textarea } from '@project/components/ui/textarea';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { toast } from 'sonner';
import {
  getFinancingRequestsList, approveFinancingRequest, disburseFinancingRequest,
  getEntityBankAccounts, GetFinancingRequestsListOutputType, GetEntityBankAccountsOutputType
} from 'zitejs/api';
import { CheckCircle2, XCircle, Landmark, Banknote, Building2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

type Request = GetFinancingRequestsListOutputType['requests'][0];
type BankAccount = GetEntityBankAccountsOutputType['bankAccounts'][0];

const MPESA_DAILY_LIMIT = 500000;

function formatKES(n: number) {
  return `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 0 })}`;
}

export default function FiFinancingPage() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionDialog, setActionDialog] = useState<{ request: Request; type: 'approve' | 'reject' } | null>(null);
  const [disburseDialog, setDisburseDialog] = useState<Request | null>(null);
  const [notes, setNotes] = useState('');
  const [acting, setActing] = useState(false);
  const [disbMethod, setDisbMethod] = useState<'Bank Transfer' | 'M-Pesa'>('Bank Transfer');
  const [disbPhone, setDisbPhone] = useState('');
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankId, setSelectedBankId] = useState('');
  const [loadingBanks, setLoadingBanks] = useState(false);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    Promise.all([
      getFinancingRequestsList({ status: 'Pending Approval' }),
      getFinancingRequestsList({ status: 'Approved' }),
    ])
      .then(([pending, approved]) => setRequests([...pending.requests, ...approved.requests]))
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openDisburseDialog = async (r: Request) => {
    setDisburseDialog(r);
    setNotes('');
    setDisbMethod('Bank Transfer');
    setDisbPhone('');
    setBankAccounts([]);
    setSelectedBankId('');
    // Fetch entity bank accounts
    if (r.entityId) {
      setLoadingBanks(true);
      try {
        const res = await getEntityBankAccounts({ entityId: r.entityId });
        setBankAccounts(res.bankAccounts);
        // Auto-select the primary bank account
        const primary = res.bankAccounts.find(b => b.isPrimary) || res.bankAccounts[0];
        if (primary) setSelectedBankId(primary.id);
        // If there's a mobile money account, pre-fill phone
        const mobile = res.bankAccounts.find(b => b.accountType === 'Mobile Money');
        if (mobile?.mobileMoneyNumber) setDisbPhone(mobile.mobileMoneyNumber);
      } catch { /* ignore */ }
      finally { setLoadingBanks(false); }
    }
  };

  const handleAction = async () => {
    if (!actionDialog) return;
    setActing(true);
    try {
      const decision = actionDialog.type === 'approve' ? 'Approved' as const : 'Rejected' as const;
      const result = await approveFinancingRequest({ requestId: actionDialog.request.id, decision, comments: notes || undefined });
      if (result.autoDisbursed) {
        toast.success(`Approved & auto-disbursed — Loan ${result.loanReference}`);
      } else {
        toast.success(`Financing ${decision.toLowerCase()}`);
      }
      setActionDialog(null); setNotes('');
      load();
    } catch (e: any) { toast.error(e?.message || 'Action failed'); }
    finally { setActing(false); }
  };

  const handleDisburse = async () => {
    if (!disburseDialog) return;
    // Client-side M-Pesa limit check
    if (disbMethod === 'M-Pesa' && disburseDialog.requestedAmount > MPESA_DAILY_LIMIT) {
      toast.error(`Amount exceeds M-Pesa daily limit of ${formatKES(MPESA_DAILY_LIMIT)}. Use Bank Transfer.`);
      return;
    }
    setActing(true);
    try {
      const result = await disburseFinancingRequest({
        requestId: disburseDialog.id,
        disbursementMethod: disbMethod,
        amount: disburseDialog.requestedAmount,
        bankAccountId: disbMethod === 'Bank Transfer' ? (selectedBankId || 'default') : undefined,
        mpesaPhoneNumber: disbMethod === 'M-Pesa' ? disbPhone : undefined,
        comments: notes || undefined,
      });
      toast.success(`Disbursed — Loan ${result.loanReference}, Txn ${result.transactionReference}`);
      setDisburseDialog(null); setNotes(''); setDisbPhone('');
      load();
    } catch (e: any) { toast.error(e?.message || 'Disbursement failed'); }
    finally { setActing(false); }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      'Pending Approval': 'bg-yellow-500/10 text-yellow-700',
      Approved: 'bg-emerald-500/10 text-emerald-600',
    };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-muted text-muted-foreground'}`}>{status}</span>;
  };

  const pendingRequests = requests.filter(r => r.status === 'Pending Approval');
  const approvedRequests = requests.filter(r => r.status === 'Approved');
  const selectedBank = bankAccounts.find(b => b.id === selectedBankId);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">FI — Financing</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Approve pending requests and disburse approved ones</p>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
      ) : requests.length === 0 ? (
        <div className="border border-border rounded-lg p-12 text-center bg-card">
          <Landmark className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">No financing requests pending action</p>
        </div>
      ) : (
        <div className="space-y-8">
          {pendingRequests.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Pending Approval ({pendingRequests.length})</h2>
              <RequestTable requests={pendingRequests} statusBadge={statusBadge}
                actions={(r) => (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-emerald-600" onClick={() => { setActionDialog({ request: r, type: 'approve' }); setNotes(''); }}>
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-red-600" onClick={() => { setActionDialog({ request: r, type: 'reject' }); setNotes(''); }}>
                      <XCircle className="w-3 h-3 mr-1" /> Reject
                    </Button>
                  </div>
                )}
                onRowClick={(r) => navigate(`/financing/${r.id}`)}
              />
            </div>
          )}

          {approvedRequests.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Approved — Awaiting Disbursement ({approvedRequests.length})</h2>
              <RequestTable requests={approvedRequests} statusBadge={statusBadge}
                actions={(r) => (
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-600" onClick={() => openDisburseDialog(r)}>
                    <Banknote className="w-3 h-3 mr-1" /> Disburse
                  </Button>
                )}
                onRowClick={(r) => navigate(`/financing/${r.id}`)}
              />
            </div>
          )}
        </div>
      )}

      {/* Approve/Reject Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={o => !o && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{actionDialog?.type === 'approve' ? 'Approve Financing' : 'Reject Financing'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {actionDialog?.type === 'approve'
                ? `Approve financing of ${formatKES(actionDialog?.request.requestedAmount || 0)} for ${actionDialog?.request.entityName}.`
                : `Reject financing for ${actionDialog?.request.entityName}.`}
            </p>
            <Textarea placeholder="FI notes..." value={notes} onChange={e => setNotes(e.target.value)} className="min-h-[80px]" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
            <Button onClick={handleAction} disabled={acting}>{acting ? 'Processing...' : actionDialog?.type === 'approve' ? 'Approve' : 'Reject'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disburse Dialog */}
      <Dialog open={!!disburseDialog} onOpenChange={o => !o && setDisburseDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Disburse Financing</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* Summary */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
              <p className="text-sm font-medium text-foreground">{disburseDialog?.entityName} — #{disburseDialog?.requestNumber}</p>
              <p className="text-lg font-bold text-foreground">{formatKES(disburseDialog?.requestedAmount || 0)}</p>
              <p className="text-xs text-muted-foreground">{disburseDialog?.productType} · {disburseDialog?.programName}</p>
            </div>

            {/* Disbursement Method */}
            <div className="space-y-2">
              <Label>Disbursement Method</Label>
              <Select value={disbMethod} onValueChange={v => setDisbMethod(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                  <SelectItem value="M-Pesa">M-Pesa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Bank Transfer — auto-filled from onboarding */}
            {disbMethod === 'Bank Transfer' && (
              <div className="space-y-3">
                {loadingBanks ? (
                  <Skeleton className="h-16 rounded-lg" />
                ) : bankAccounts.filter(b => b.accountType !== 'Mobile Money').length > 0 ? (
                  <>
                    <Label>Recipient Bank Account</Label>
                    <Select value={selectedBankId} onValueChange={setSelectedBankId}>
                      <SelectTrigger><SelectValue placeholder="Select bank account" /></SelectTrigger>
                      <SelectContent>
                        {bankAccounts.filter(b => b.accountType !== 'Mobile Money').map(ba => (
                          <SelectItem key={ba.id} value={ba.id}>
                            {ba.bankName} — {ba.accountNumber} {ba.isPrimary ? '(Primary)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedBank && (
                      <div className="bg-muted/30 rounded-lg p-3 text-xs space-y-1 border border-border">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="font-medium text-foreground">{selectedBank.bankName}</span>
                          {selectedBank.isVerified && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                        </div>
                        <p className="text-muted-foreground">Account: <span className="font-mono text-foreground">{selectedBank.accountNumber}</span></p>
                        <p className="text-muted-foreground">Name: {selectedBank.accountName}</p>
                        {selectedBank.branchName && <p className="text-muted-foreground">Branch: {selectedBank.branchName}</p>}
                        {selectedBank.bankCode && <p className="text-muted-foreground">Bank Code: {selectedBank.bankCode}</p>}
                        {selectedBank.swiftCode && <p className="text-muted-foreground">SWIFT: {selectedBank.swiftCode}</p>}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-yellow-700 dark:text-yellow-300">No bank accounts found for this entity. Bank details should be captured during onboarding.</p>
                  </div>
                )}
              </div>
            )}

            {/* M-Pesa */}
            {disbMethod === 'M-Pesa' && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>M-Pesa Phone Number</Label>
                  <Input placeholder="e.g. 0712345678" value={disbPhone} onChange={e => setDisbPhone(e.target.value)} />
                </div>
                {(disburseDialog?.requestedAmount || 0) > MPESA_DAILY_LIMIT && (
                  <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-red-700 dark:text-red-300">
                      Amount of {formatKES(disburseDialog?.requestedAmount || 0)} exceeds the M-Pesa daily limit of {formatKES(MPESA_DAILY_LIMIT)}. Please use Bank Transfer.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea placeholder="Disbursement notes..." value={notes} onChange={e => setNotes(e.target.value)} className="min-h-[60px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisburseDialog(null)}>Cancel</Button>
            <Button
              onClick={handleDisburse}
              disabled={
                acting ||
                (disbMethod === 'M-Pesa' && (!disbPhone || (disburseDialog?.requestedAmount || 0) > MPESA_DAILY_LIMIT)) ||
                (disbMethod === 'Bank Transfer' && !selectedBankId && bankAccounts.filter(b => b.accountType !== 'Mobile Money').length > 0)
              }
            >
              {acting ? 'Processing...' : 'Confirm Disbursement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RequestTable({ requests, statusBadge, actions, onRowClick }: {
  requests: Request[];
  statusBadge: (s: string) => React.ReactNode;
  actions: (r: Request) => React.ReactNode;
  onRowClick: (r: Request) => void;
}) {
  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground text-left bg-muted/30">
            <th className="py-2.5 px-4 font-medium">#</th>
            <th className="py-2.5 px-4 font-medium">Entity</th>
            <th className="py-2.5 px-4 font-medium">Program</th>
            <th className="py-2.5 px-4 font-medium">Product</th>
            <th className="py-2.5 px-4 font-medium">Amount</th>
            <th className="py-2.5 px-4 font-medium">Status</th>
            <th className="py-2.5 px-4 font-medium">Date</th>
            <th className="py-2.5 px-4 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/20 cursor-pointer" onClick={() => onRowClick(r)}>
              <td className="py-3 px-4 font-mono text-xs">#{r.requestNumber}</td>
              <td className="py-3 px-4 font-medium text-foreground">{r.entityName}</td>
              <td className="py-3 px-4 text-muted-foreground text-xs">{r.programName}</td>
              <td className="py-3 px-4 text-muted-foreground text-xs">{r.productType}</td>
              <td className="py-3 px-4">{formatKES(r.requestedAmount)}</td>
              <td className="py-3 px-4">{statusBadge(r.status)}</td>
              <td className="py-3 px-4 text-muted-foreground text-xs">{r.createdAt ? format(new Date(r.createdAt), 'dd MMM yy') : ''}</td>
              <td className="py-3 px-4" onClick={e => e.stopPropagation()}>{actions(r)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
