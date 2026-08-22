import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@project/components/ui/button';
import { Skeleton } from '@project/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { toast } from 'sonner';
import { getFiLoans, GetFiLoansOutputType } from 'zitejs/api';
import { Landmark, ArrowRight, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { format } from 'date-fns';

type Loan = GetFiLoansOutputType['loans'][0];

function formatKES(n: number) {
  return `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 0 })}`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    Active: { bg: 'bg-emerald-50 dark:bg-emerald-950', text: 'text-emerald-700 dark:text-emerald-300', icon: <CheckCircle2 className="w-3 h-3" /> },
    Overdue: { bg: 'bg-red-50 dark:bg-red-950', text: 'text-red-700 dark:text-red-300', icon: <AlertTriangle className="w-3 h-3" /> },
    Settled: { bg: 'bg-blue-50 dark:bg-blue-950', text: 'text-blue-700 dark:text-blue-300', icon: <CheckCircle2 className="w-3 h-3" /> },
    'Written Off': { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', icon: <Clock className="w-3 h-3" /> },
  };
  const s = map[status] || map['Active'];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      {s.icon} {status}
    </span>
  );
}

export default function FiLoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    getFiLoans({ status: statusFilter })
      .then((r) => setLoans(r.loans))
      .catch(() => toast.error('Failed to load loans'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [statusFilter]);

  const totalPrincipal = loans.reduce((s, l) => s + l.principal, 0);
  const totalOutstanding = loans.reduce((s, l) => s + l.outstandingBalance, 0);
  const activeCount = loans.filter(l => l.status === 'Active').length;
  const overdueCount = loans.filter(l => l.status === 'Overdue').length;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">FI — Loan Book</h1>
          <p className="text-sm text-muted-foreground mt-0.5">All disbursed loans and their current status</p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Overdue">Overdue</SelectItem>
            <SelectItem value="Settled">Settled</SelectItem>
            <SelectItem value="Written Off">Written Off</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Total Loans</p>
          <p className="text-2xl font-bold text-foreground">{loans.length}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Total Principal</p>
          <p className="text-lg font-bold text-foreground">{formatKES(totalPrincipal)}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Outstanding Balance</p>
          <p className="text-lg font-bold text-foreground">{formatKES(totalOutstanding)}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Active / Overdue</p>
          <p className="text-lg font-bold text-foreground">
            <span className="text-emerald-600">{activeCount}</span> / <span className="text-red-600">{overdueCount}</span>
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
      ) : loans.length === 0 ? (
        <div className="border border-border rounded-lg p-12 text-center bg-card">
          <Landmark className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">No loans found</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-left bg-muted/30">
                <th className="py-2.5 px-4 font-medium">Reference</th>
                <th className="py-2.5 px-4 font-medium">Entity</th>
                <th className="py-2.5 px-4 font-medium">Program</th>
                <th className="py-2.5 px-4 font-medium">Product</th>
                <th className="py-2.5 px-4 font-medium text-right">Principal</th>
                <th className="py-2.5 px-4 font-medium text-right">Outstanding</th>
                <th className="py-2.5 px-4 font-medium">Rate</th>
                <th className="py-2.5 px-4 font-medium">Maturity</th>
                <th className="py-2.5 px-4 font-medium">Status</th>
                <th className="py-2.5 px-4 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {loans.map((loan) => (
                <tr
                  key={loan.id}
                  className="border-b border-border last:border-0 hover:bg-muted/20 cursor-pointer"
                  onClick={() => navigate(`/loans/${loan.id}`)}
                >
                  <td className="py-3 px-4 font-mono text-xs font-medium text-foreground">{loan.loanReference}</td>
                  <td className="py-3 px-4 font-medium text-foreground">{loan.entityName}</td>
                  <td className="py-3 px-4 text-muted-foreground text-xs">{loan.programName}</td>
                  <td className="py-3 px-4 text-muted-foreground text-xs">{loan.productType}</td>
                  <td className="py-3 px-4 text-right">{formatKES(loan.principal)}</td>
                  <td className="py-3 px-4 text-right font-medium">{formatKES(loan.outstandingBalance)}</td>
                  <td className="py-3 px-4 text-muted-foreground">{(loan.interestRate * 100).toFixed(1)}%</td>
                  <td className="py-3 px-4 text-muted-foreground text-xs">
                    {loan.maturityDate ? format(new Date(loan.maturityDate), 'dd MMM yy') : '—'}
                  </td>
                  <td className="py-3 px-4"><StatusBadge status={loan.status} /></td>
                  <td className="py-3 px-4">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
