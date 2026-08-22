import { useEffect, useState } from 'react';
import { Card, CardContent } from '@project/components/ui/card';
import { Badge } from '@project/components/ui/badge';
import { Input } from '@project/components/ui/input';
import { Skeleton } from '@project/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { FileText, Search } from 'lucide-react';
import { useCurrentRole } from '../components/RoleContext';
import { getPartnerFinancing } from 'zitejs/api';
import { format } from 'date-fns';

function formatCurrency(v: number) {
  return `KES ${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const statusColor: Record<string, string> = {
  Pending: 'bg-amber-100 text-amber-700',
  'Under Review': 'bg-sky-100 text-sky-700',
  Assessed: 'bg-blue-100 text-blue-700',
  Approved: 'bg-emerald-100 text-emerald-700',
  Disbursed: 'bg-teal-100 text-teal-700',
  Rejected: 'bg-red-100 text-red-700',
};

export default function PartnerFinancingPage() {
  const { partnerId } = useCurrentRole();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (!partnerId) return;
    setLoading(true);
    getPartnerFinancing({
      partnerId,
      search: search.trim() || undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
    })
      .then(res => setRequests(res.requests))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [partnerId, search, statusFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Financing Requests</h1>
        <p className="text-sm text-muted-foreground mt-1">Financing requests from your entities</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search requests..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="Assessed">Assessed</SelectItem>
            <SelectItem value="Approved">Approved</SelectItem>
            <SelectItem value="Disbursed">Disbursed</SelectItem>
            <SelectItem value="Rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}</div>
      ) : requests.length === 0 ? (
        <Card><CardContent className="p-12 text-center">
          <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">No financing requests found</p>
          <p className="text-sm text-muted-foreground mt-1">Financing requests from your entities will appear here.</p>
        </CardContent></Card>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Request #</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Entity</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Tenor</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Created</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(r => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{r.requestNumber}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.entityName}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatCurrency(r.amount)}</td>
                  <td className="px-4 py-3">
                    <Badge className={statusColor[r.status] || ''} variant="secondary">{r.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">{r.tenor ? `${r.tenor} days` : '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.createdAt ? format(new Date(r.createdAt), 'dd MMM yyyy') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
