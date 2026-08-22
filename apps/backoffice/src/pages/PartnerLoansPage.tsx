import { useEffect, useState } from 'react';
import { Card, CardContent } from '@project/components/ui/card';
import { Badge } from '@project/components/ui/badge';
import { Input } from '@project/components/ui/input';
import { Skeleton } from '@project/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Landmark, Search } from 'lucide-react';
import { useCurrentRole } from '../components/RoleContext';
import { getPartnerLoans } from 'zitejs/api';
import { format } from 'date-fns';

function formatCurrency(v: number) {
  return `KES ${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const statusColor: Record<string, string> = {
  Active: 'bg-emerald-100 text-emerald-700',
  Settled: 'bg-blue-100 text-blue-700',
  Overdue: 'bg-red-100 text-red-700',
  Defaulted: 'bg-red-200 text-red-800',
  'Written Off': 'bg-gray-100 text-gray-700',
};

export default function PartnerLoansPage() {
  const { partnerId } = useCurrentRole();
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (!partnerId) return;
    setLoading(true);
    getPartnerLoans({
      partnerId,
      search: search.trim() || undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
    })
      .then(res => setLoans(res.loans))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [partnerId, search, statusFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Loans</h1>
        <p className="text-sm text-muted-foreground mt-1">Loans for your entities</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search loans..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Settled">Settled</SelectItem>
            <SelectItem value="Overdue">Overdue</SelectItem>
            <SelectItem value="Defaulted">Defaulted</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}</div>
      ) : loans.length === 0 ? (
        <Card><CardContent className="p-12 text-center">
          <Landmark className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">No loans found</p>
          <p className="text-sm text-muted-foreground mt-1">Loans for your entities will appear here.</p>
        </CardContent></Card>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Loan #</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Entity</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Principal</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Outstanding</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Maturity</th>
              </tr>
            </thead>
            <tbody>
              {loans.map(l => (
                <tr key={l.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{l.loanNumber}</td>
                  <td className="px-4 py-3 text-muted-foreground">{l.entityName}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatCurrency(l.principalAmount)}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatCurrency(l.outstandingBalance)}</td>
                  <td className="px-4 py-3">
                    <Badge className={statusColor[l.status] || ''} variant="secondary">{l.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{l.maturityDate ? format(new Date(l.maturityDate), 'dd MMM yyyy') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
