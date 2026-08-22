import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPartnersList, createPartner } from 'zitejs/api';
import type { GetPartnersListOutputType } from 'zitejs/api';
import { Input } from '@project/components/ui/input';
import { Button } from '@project/components/ui/button';
import { Badge } from '@project/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { Label } from '@project/components/ui/label';
import { Skeleton } from '@project/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Search, Plus, Globe, Building2, Cpu, Landmark,
} from 'lucide-react';
import {
  useReactTable, getCoreRowModel, getFilteredRowModel, getSortedRowModel,
  getPaginationRowModel, flexRender, createColumnHelper,
} from '@tanstack/react-table';

type Partner = GetPartnersListOutputType['partners'][0];

const statusColors: Record<string, string> = {
  'Pending Approval': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  Active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  Suspended: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  Revoked: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

const typeIcons: Record<string, React.ElementType> = {
  FI: Landmark,
  'Master Anchor': Building2,
  Fintech: Cpu,
};

const col = createColumnHelper<Partner>();

function CreatePartnerDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ partnerName: '', partnerType: '' as string, contactName: '', contactEmail: '', contactPhone: '', companyRegistration: '', country: '', website: '' });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.partnerName || !form.partnerType || !form.contactName || !form.contactEmail) {
      toast.error('Please fill in all required fields');
      return;
    }
    setSaving(true);
    try {
      await createPartner({
        partnerName: form.partnerName,
        partnerType: form.partnerType as 'FI' | 'Master Anchor' | 'Fintech',
        contactName: form.contactName,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone || undefined,
        companyRegistration: form.companyRegistration || undefined,
        country: form.country || undefined,
        website: form.website || undefined,
      });
      toast.success('Partner created');
      setForm({ partnerName: '', partnerType: '', contactName: '', contactEmail: '', contactPhone: '', companyRegistration: '', country: '', website: '' });
      onCreated();
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Failed to create partner');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add API Partner</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Partner Name *</Label>
              <Input value={form.partnerName} onChange={(e) => setForm({ ...form, partnerName: e.target.value })} placeholder="Company name" />
            </div>
            <div>
              <Label>Partner Type *</Label>
              <Select value={form.partnerType} onValueChange={(v) => setForm({ ...form, partnerType: v })}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FI">FI</SelectItem>
                  <SelectItem value="Master Anchor">Program Owner</SelectItem>
                  <SelectItem value="Fintech">Fintech</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Contact Name *</Label>
              <Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} placeholder="John Doe" />
            </div>
            <div>
              <Label>Contact Email *</Label>
              <Input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} placeholder="john@company.com" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Phone</Label>
              <Input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} placeholder="+254..." />
            </div>
            <div>
              <Label>Country</Label>
              <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="Kenya" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Company Registration</Label>
              <Input value={form.companyRegistration} onChange={(e) => setForm({ ...form, companyRegistration: e.target.value })} />
            </div>
            <div>
              <Label>Website</Label>
              <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://..." />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Creating…' : 'Create Partner'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();

  const fetchPartners = async () => {
    setLoading(true);
    try {
      const res = await getPartnersList({
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      setPartners(res.partners);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPartners(); }, [statusFilter]);

  const columns = useMemo(() => [
    col.accessor('partnerName', {
      header: 'Partner',
      cell: ({ row }) => {
        const Icon = typeIcons[row.original.partnerType] || Globe;
        return (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <div className="font-medium text-sm">{row.original.partnerName}</div>
              <div className="text-xs text-muted-foreground">{row.original.partnerType}</div>
            </div>
          </div>
        );
      },
    }),
    col.accessor('status', {
      header: 'Status',
      cell: ({ getValue }) => (
        <Badge variant="secondary" className={statusColors[getValue()] || ''}>
          {getValue()}
        </Badge>
      ),
    }),
    col.accessor('enabledProducts', {
      header: 'Products',
      cell: ({ getValue }) => {
        const products = getValue() as string[];
        if (!products?.length) return <span className="text-muted-foreground text-xs">None</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {products.slice(0, 2).map((p) => (
              <Badge key={p} variant="outline" className="text-[10px] py-0 px-1.5">{p}</Badge>
            ))}
            {products.length > 2 && (
              <Badge variant="outline" className="text-[10px] py-0 px-1.5">+{products.length - 2}</Badge>
            )}
          </div>
        );
      },
    }),
    col.accessor('sandboxKeys', {
      header: 'Sandbox Keys',
      cell: ({ getValue }) => <span className="text-sm tabular-nums">{getValue()}</span>,
    }),
    col.accessor('prodKeys', {
      header: 'Prod Keys',
      cell: ({ getValue }) => <span className="text-sm tabular-nums">{getValue()}</span>,
    }),
    col.accessor('contactEmail', {
      header: 'Contact',
      cell: ({ row }) => (
        <div>
          <div className="text-sm">{row.original.contactName}</div>
          <div className="text-xs text-muted-foreground">{row.original.contactEmail}</div>
        </div>
      ),
    }),
    col.accessor('createdAt', {
      header: 'Created',
      cell: ({ getValue }) => {
        const d = getValue();
        if (!d) return '-';
        return <span className="text-sm text-muted-foreground">{new Date(d).toLocaleDateString()}</span>;
      },
    }),
  ], []);

  const filtered = useMemo(() => {
    if (!search) return partners;
    const s = search.toLowerCase();
    return partners.filter((p) =>
      p.partnerName.toLowerCase().includes(s) ||
      p.contactEmail.toLowerCase().includes(s) ||
      p.partnerType.toLowerCase().includes(s)
    );
  }, [partners, search]);

  const table = useReactTable({
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Partners</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage B2B partners who use the Trove API</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" />
          Add Partner
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search partners..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Pending Approval">Pending Approval</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Suspended">Suspended</SelectItem>
            <SelectItem value="Revoked">Revoked</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border border-border rounded-xl overflow-hidden bg-card">
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Globe className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">No partners found</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-border">
                  {hg.headers.map((h) => (
                    <th key={h.id} className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => navigate(`/partners/${row.original.id}`)}
                  className="border-b border-border last:border-0 hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}–
            {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, filtered.length)} of {filtered.length}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Previous</Button>
            <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Next</Button>
          </div>
        </div>
      )}

      <CreatePartnerDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={fetchPartners} />
    </div>
  );
}
