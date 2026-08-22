import { useEffect, useState } from 'react';
import { Card, CardContent } from '@project/components/ui/card';
import { Badge } from '@project/components/ui/badge';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Skeleton } from '@project/components/ui/skeleton';
import { Layers, Search, Plus, Users, Building2 } from 'lucide-react';
import { useCurrentRole } from '../components/RoleContext';
import { getPartnerPrograms } from 'zitejs/api';
import { format } from 'date-fns';
import CreateProgramDialog from '../components/CreateProgramDialog';

function formatCurrency(v: number) {
  return `KES ${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const statusColor: Record<string, string> = {
  Active: 'bg-emerald-100 text-emerald-700',
  Draft: 'bg-amber-100 text-amber-700',
  Closed: 'bg-gray-100 text-gray-700',
};

export default function PartnerProgramsPage() {
  const { partnerId, partnerName } = useCurrentRole();
  const [programs, setPrograms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const fetchData = async () => {
    if (!partnerId) return;
    setLoading(true);
    try {
      const res = await getPartnerPrograms({ partnerId, search: search.trim() || undefined });
      setPrograms(res.programs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [partnerId, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Programs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Programs created by {partnerName || 'your organisation'}
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="shrink-0">
          <Plus className="w-4 h-4 mr-2" /> Create Program
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search programs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i}><CardContent className="p-5"><Skeleton className="h-24" /></CardContent></Card>
          ))}
        </div>
      ) : programs.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Layers className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium text-foreground">No programs yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create your first program to get started.</p>
            <Button className="mt-4" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-2" /> Create Program
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {programs.map(p => (
            <Card key={p.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Layers className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.productType}</p>
                    </div>
                  </div>
                  <Badge className={statusColor[p.status] || 'bg-gray-100 text-gray-700'} variant="secondary">
                    {p.status}
                  </Badge>
                </div>

                {p.description && (
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{p.description}</p>
                )}

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Users className="w-3 h-3" />
                    <span>{p.entityCount} entities</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Building2 className="w-3 h-3" />
                    <span>{p.fiCount} FIs</span>
                  </div>
                  {p.size && (
                    <div className="col-span-2 text-muted-foreground">
                      Size: {formatCurrency(p.size)}
                    </div>
                  )}
                </div>

                {p.createdAt && (
                  <p className="text-[10px] text-muted-foreground/60 mt-3">
                    Created {format(new Date(p.createdAt), 'dd MMM yyyy')}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateProgramDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={fetchData}
        partnerId={partnerId || undefined}
      />
    </div>
  );
}
