import { useState, useEffect } from 'react';
import { Button } from '@project/components/ui/button';
import { Skeleton } from '@project/components/ui/skeleton';
import { Textarea } from '@project/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { toast } from 'sonner';
import { getFinancingRequestsList, approveFinancingRequest, GetFinancingRequestsListOutputType } from 'zitejs/api';
import { FileText, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';

type Request = GetFinancingRequestsListOutputType['requests'][0];

function formatKES(n: number) {
  return `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 0 })}`;
}

export default function CheckerFinancingPage() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionDialog, setActionDialog] = useState<{ request: Request; type: 'approve' | 'reject' } | null>(null);
  const [notes, setNotes] = useState('');
  const [acting, setActing] = useState(false);

  const load = () => {
    setLoading(true);
    getFinancingRequestsList({ status: 'Pending Approval' })
      .then((r) => setRequests(r.requests))
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleAction = async () => {
    if (!actionDialog) return;
    setActing(true);
    try {
      const decision = actionDialog.type === 'approve' ? 'Approved' as const : 'Rejected' as const;
      const result = await approveFinancingRequest({ requestId: actionDialog.request.id, decision, comments: notes || undefined });
      if (result.autoDisbursed) {
        toast.success(`Request approved & auto-disbursed — Loan ${result.loanReference}`);
      } else {
        toast.success(`Request ${decision.toLowerCase()}`);
      }
      setActionDialog(null); setNotes('');
      load();
    } catch (e: any) { toast.error(e?.message || 'Action failed'); }
    finally { setActing(false); }
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">Checker — Financing Approval</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Requests assessed by Maker, ready for approval decision</p>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
      ) : requests.length === 0 ? (
        <div className="border border-border rounded-lg p-12 text-center bg-card">
          <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">No financing requests pending checker approval</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-left bg-muted/30">
                <th className="py-2.5 px-4 font-medium">#</th>
                <th className="py-2.5 px-4 font-medium">Entity</th>
                <th className="py-2.5 px-4 font-medium">Program</th>
                <th className="py-2.5 px-4 font-medium">Product</th>
                <th className="py-2.5 px-4 font-medium">Amount</th>
                <th className="py-2.5 px-4 font-medium">Date</th>
                <th className="py-2.5 px-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="py-3 px-4 font-mono text-xs">#{r.requestNumber}</td>
                  <td className="py-3 px-4 font-medium text-foreground">{r.entityName}</td>
                  <td className="py-3 px-4 text-muted-foreground text-xs">{r.programName}</td>
                  <td className="py-3 px-4 text-muted-foreground text-xs">{r.productType}</td>
                  <td className="py-3 px-4">{formatKES(r.requestedAmount)}</td>
                  <td className="py-3 px-4 text-muted-foreground text-xs">{r.createdAt ? format(new Date(r.createdAt), 'dd MMM yy') : ''}</td>
                  <td className="py-3 px-4">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-emerald-600" onClick={() => { setActionDialog({ request: r, type: 'approve' }); setNotes(''); }}>
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-red-600" onClick={() => { setActionDialog({ request: r, type: 'reject' }); setNotes(''); }}>
                        <XCircle className="w-3 h-3 mr-1" /> Reject
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!actionDialog} onOpenChange={o => !o && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionDialog?.type === 'approve' ? 'Approve Financing' : 'Reject Financing'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {actionDialog?.type === 'approve' ? `Approve financing of ${formatKES(actionDialog?.request.requestedAmount || 0)} for ${actionDialog?.request.entityName}.` : `Reject financing request for ${actionDialog?.request.entityName}.`}
            </p>
            <Textarea placeholder="Checker notes..." value={notes} onChange={e => setNotes(e.target.value)} className="min-h-[80px]" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
            <Button onClick={handleAction} disabled={acting}>{acting ? 'Processing...' : actionDialog?.type === 'approve' ? 'Approve' : 'Reject'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
