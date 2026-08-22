import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@project/components/ui/button';
import { Skeleton } from '@project/components/ui/skeleton';
import { toast } from 'sonner';
import { getPrograms, GetProgramsOutputType } from 'zitejs/api';
import { Layers, Users, CreditCard, Banknote, Plus } from 'lucide-react';
import { format } from 'date-fns';
import CreateProgramDialog from '../components/CreateProgramDialog';

type Program = GetProgramsOutputType['programs'][0];

function formatKES(n: number) {
  return `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 0 })}`;
}

export default function ProgramsPage() {
  const navigate = useNavigate();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = () => {
    setLoading(true);
    getPrograms({})
      .then((r) => setPrograms(r.programs))
      .catch(() => toast.error('Failed to load programs'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      Active: 'bg-emerald-500/10 text-emerald-600',
      Suspended: 'bg-yellow-500/10 text-yellow-700',
      Closed: 'bg-muted text-muted-foreground',
    };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-muted text-muted-foreground'}`}>{status}</span>;
  };

  if (loading) {
    return <div className="p-8 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 rounded-lg" /></div>;
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-foreground">Programs</h1>
        <Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-1" /> Create Program</Button>
      </div>

      <CreateProgramDialog open={showCreate} onOpenChange={setShowCreate} onCreated={load} />

      {programs.length === 0 ? (
        <div className="border border-border rounded-lg p-12 text-center bg-card">
          <Layers className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">No programs found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {programs.map((p) => (
            <div key={p.id} className="border border-border rounded-lg bg-card p-5 cursor-pointer hover:border-primary/40 transition-colors" onClick={() => navigate(`/programs/${p.id}`)}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-foreground">{p.name}</h3>
                  <p className="text-xs text-muted-foreground">{p.productType}</p>
                </div>
                {statusBadge(p.status)}
              </div>
              {p.description && <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{p.description}</p>}
              {p.anchorName && (
                <p className="text-xs text-muted-foreground mb-3">Program Owner: <span className="text-foreground font-medium">{p.anchorName}</span></p>
              )}
              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border">
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{p.entityCount} entities</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{p.loanCount} loans</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Banknote className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{formatKES(p.totalDisbursed)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
