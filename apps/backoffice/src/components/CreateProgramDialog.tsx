import { useState, useEffect } from 'react';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { Switch } from '@project/components/ui/switch';
import { toast } from 'sonner';
import { createProgram, getFinancialInstitutions } from 'zitejs/api';
import { Plus, Trash2, Building2 } from 'lucide-react';

const PRODUCT_TYPES = [
  'Invoice Finance',
  'Reverse Factoring',
  'Invoice Discounting',
  'Blended Finance',
  'Leasing',
  'Warehouse Receipt',
];

type FiOption = { id: string; legalName: string };

type FiPricingEntry = {
  fiId: string;
  minLimit: string;
  maxLimit: string;
  transactionFeeRate: string;
  processingFeeFixed: string;
  penaltyFeeRate: string;
  autoDisburse: boolean;
};

const emptyPricing = (): FiPricingEntry => ({
  fiId: '', minLimit: '', maxLimit: '',
  transactionFeeRate: '', processingFeeFixed: '', penaltyFeeRate: '',
  autoDisburse: false,
});

export default function CreateProgramDialog({
  open, onOpenChange, partnerId, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  partnerId?: string;
  onCreated: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [saving, setSaving] = useState(false);
  const [fiList, setFiList] = useState<FiOption[]>([]);
  const [fiLoading, setFiLoading] = useState(false);

  // Step 1 fields
  const [name, setName] = useState('');
  const [productType, setProductType] = useState('');
  const [description, setDescription] = useState('');
  const [programSize, setProgramSize] = useState('');
  const [creditPeriodDays, setCreditPeriodDays] = useState('');
  const [financePercentage, setFinancePercentage] = useState('');
  const [minParticipantLimit, setMinParticipantLimit] = useState('');
  const [maxParticipantLimit, setMaxParticipantLimit] = useState('');

  // Step 2 fields
  const [pricings, setPricings] = useState<FiPricingEntry[]>([emptyPricing()]);

  useEffect(() => {
    if (open) {
      resetForm();
      setFiLoading(true);
      getFinancialInstitutions({})
        .then(r => setFiList(r.institutions.map((fi: any) => ({ id: fi.id, legalName: fi.legalName }))))
        .catch(() => toast.error('Failed to load financial institutions'))
        .finally(() => setFiLoading(false));
    }
  }, [open]);

  function resetForm() {
    setStep(1);
    setName(''); setProductType(''); setDescription('');
    setProgramSize(''); setCreditPeriodDays(''); setFinancePercentage('');
    setMinParticipantLimit(''); setMaxParticipantLimit('');
    setPricings([emptyPricing()]);
  }

  function addPricing() {
    setPricings(prev => [...prev, emptyPricing()]);
  }

  function removePricing(i: number) {
    setPricings(prev => prev.filter((_, idx) => idx !== i));
  }

  function updatePricing(i: number, field: keyof FiPricingEntry, value: any) {
    setPricings(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p));
  }

  const step1Valid = name.trim() && productType;

  async function handleCreate() {
    const validPricings = pricings.filter(p => p.fiId && p.minLimit && p.maxLimit);
    setSaving(true);
    try {
      await createProgram({
        name: name.trim(),
        productType,
        description: description.trim() || undefined,
        programSize: programSize ? Number(programSize) : undefined,
        creditPeriodDays: creditPeriodDays ? Number(creditPeriodDays) : undefined,
        financePercentage: financePercentage ? Number(financePercentage) / 100 : undefined,
        minParticipantLimit: minParticipantLimit ? Number(minParticipantLimit) : undefined,
        maxParticipantLimit: maxParticipantLimit ? Number(maxParticipantLimit) : undefined,
        partnerId,
        fiPricings: validPricings.length > 0 ? validPricings.map(p => ({
          fiId: p.fiId,
          minLimit: Number(p.minLimit),
          maxLimit: Number(p.maxLimit),
          transactionFeeRate: Number(p.transactionFeeRate) || 0,
          processingFeeFixed: Number(p.processingFeeFixed) || 0,
          penaltyFeeRate: Number(p.penaltyFeeRate) || 0,
          autoDisburse: p.autoDisburse,
        })) : undefined,
      });
      toast.success('Program created successfully');
      onOpenChange(false);
      onCreated();
    } catch {
      toast.error('Failed to create program');
    } finally {
      setSaving(false);
    }
  }

  // Collect used FI IDs to prevent duplicates
  const usedFiIds = new Set(pricings.map(p => p.fiId).filter(Boolean));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{step === 1 ? 'Create Program — Details' : 'Create Program — FI Pricing'}</DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-2">
          <div className={`flex-1 h-1 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-muted'}`} />
          <div className={`flex-1 h-1 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Program Name *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Maize Supply Chain 2026" />
            </div>
            <div>
              <Label className="text-xs">Product Type *</Label>
              <Select value={productType} onValueChange={setProductType}>
                <SelectTrigger><SelectValue placeholder="Select product type" /></SelectTrigger>
                <SelectContent>
                  {PRODUCT_TYPES.map(pt => <SelectItem key={pt} value={pt}>{pt}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Program Size (KES)</Label>
                <Input type="number" value={programSize} onChange={e => setProgramSize(e.target.value)} placeholder="0" />
              </div>
              <div>
                <Label className="text-xs">Credit Period (days)</Label>
                <Input type="number" value={creditPeriodDays} onChange={e => setCreditPeriodDays(e.target.value)} placeholder="90" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Finance %</Label>
                <Input type="number" step="0.1" value={financePercentage} onChange={e => setFinancePercentage(e.target.value)} placeholder="80" />
              </div>
              <div>
                <Label className="text-xs">Min Limit (KES)</Label>
                <Input type="number" value={minParticipantLimit} onChange={e => setMinParticipantLimit(e.target.value)} placeholder="0" />
              </div>
              <div>
                <Label className="text-xs">Max Limit (KES)</Label>
                <Input type="number" value={maxParticipantLimit} onChange={e => setMaxParticipantLimit(e.target.value)} placeholder="0" />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">Attach one or more Financial Institutions and set pricing for each. You can skip this and add pricing later.</p>
            {pricings.map((p, i) => (
              <div key={i} className="border border-border rounded-lg p-4 space-y-3 bg-muted/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">FI #{i + 1}</span>
                  </div>
                  {pricings.length > 1 && (
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => removePricing(i)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
                <div>
                  <Label className="text-xs">Financial Institution *</Label>
                  <Select value={p.fiId} onValueChange={v => updatePricing(i, 'fiId', v)}>
                    <SelectTrigger><SelectValue placeholder={fiLoading ? 'Loading…' : 'Select FI'} /></SelectTrigger>
                    <SelectContent>
                      {fiList
                        .filter(fi => fi.id === p.fiId || !usedFiIds.has(fi.id))
                        .map(fi => <SelectItem key={fi.id} value={fi.id}>{fi.legalName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Min Limit (KES) *</Label>
                    <Input type="number" value={p.minLimit} onChange={e => updatePricing(i, 'minLimit', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Max Limit (KES) *</Label>
                    <Input type="number" value={p.maxLimit} onChange={e => updatePricing(i, 'maxLimit', e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Txn Fee %</Label>
                    <Input type="number" step="0.1" value={p.transactionFeeRate} onChange={e => updatePricing(i, 'transactionFeeRate', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Processing Fee</Label>
                    <Input type="number" value={p.processingFeeFixed} onChange={e => updatePricing(i, 'processingFeeFixed', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Penalty %</Label>
                    <Input type="number" step="0.1" value={p.penaltyFeeRate} onChange={e => updatePricing(i, 'penaltyFeeRate', e.target.value)} />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-muted-foreground">Auto-Disburse</span>
                  <Switch checked={p.autoDisburse} onCheckedChange={v => updatePricing(i, 'autoDisburse', v)} />
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addPricing} className="w-full">
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Another FI
            </Button>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 2 && (
            <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
          )}
          {step === 1 ? (
            <Button onClick={() => setStep(2)} disabled={!step1Valid}>
              Next — FI Pricing
            </Button>
          ) : (
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? 'Creating…' : 'Create Program'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
