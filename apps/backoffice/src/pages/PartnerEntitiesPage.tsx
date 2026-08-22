import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@project/components/ui/card';
import { Badge } from '@project/components/ui/badge';
import { Input } from '@project/components/ui/input';
import { Skeleton } from '@project/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { useCurrentRole } from '../components/RoleContext';
import { getPartnerEntities } from 'zitejs/api';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { format } from 'date-fns';
import { useDebouncedCallback } from 'use-debounce';

export default function PartnerEntitiesPage() {
  const { partnerId } = useCurrentRole();
  const [entities, setEntities] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [entityType, setEntityType] = useState('');
  const [kycStatus, setKycStatus] = useState('');
  const navigate = useNavigate();

  const fetchData = useDebouncedCallback(() => {
    if (!partnerId) return;
    setLoading(true);
    getPartnerEntities({
      partnerId,
      search: search || undefined,
      entityType: entityType || undefined,
      kycStatus: kycStatus || undefined,
      limit: 50,
    })
      .then((r) => {
        setEntities(r.entities);
        setTotal(r.total);
      })
      .finally(() => setLoading(false));
  }, 300);

  useEffect(() => {
    fetchData();
  }, [partnerId, search, entityType, kycStatus]);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Entities</h1>
        <p className="text-sm text-muted-foreground mt-1">Entities created via your API integration · {total} total</p>
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search entities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={entityType} onValueChange={(v) => setEntityType(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Entity type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="Dealer">Seller</SelectItem>
            <SelectItem value="Supplier">Supplier</SelectItem>
            <SelectItem value="Anchor Buyer">Buyer</SelectItem>
            <SelectItem value="Anchor">Program Owner</SelectItem>
          </SelectContent>
        </Select>
        <Select value={kycStatus} onValueChange={(v) => setKycStatus(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="KYC status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="In Review">In Review</SelectItem>
            <SelectItem value="Approved">Approved</SelectItem>
            <SelectItem value="Rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : entities.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">No entities found. Use the API to create entities.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">KYC Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Onboarding</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Limit</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {entities.map((e) => (
                  <tr
                    key={e.id}
                    className="hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/entities/${e.id}`)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium">{e.name}</p>
                      <p className="text-xs text-muted-foreground">{e.contactEmail}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-[10px]">{e.entityType}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={e.kycStatus === 'Approved' ? 'default' : e.kycStatus === 'Rejected' ? 'destructive' : 'secondary'}
                        className="text-[10px]"
                      >
                        {e.kycStatus}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{e.onboardingStatus}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {e.approvedLimit ? `KES ${Number(e.approvedLimit).toLocaleString()}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {e.createdAt ? format(new Date(e.createdAt), 'MMM d, yyyy') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
