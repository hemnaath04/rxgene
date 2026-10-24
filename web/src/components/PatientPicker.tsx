import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { PresetPatient } from '@/data/patients';

type PatientPickerProps = {
  patients: PresetPatient[];
  selectedId: string;
  onSelect: (id: string) => void;
};

/** "CYP2D6 *1/*1". Gene results only; the internal demo notes stay hidden. */
function geneSummary(p: PresetPatient): string {
  const genes = [p.cyp2d6 ? `CYP2D6 ${p.cyp2d6}` : null, p.cyp2c19 ? `CYP2C19 ${p.cyp2c19}` : null].filter(Boolean);
  return genes.length ? genes.join(' · ') : 'no gene result';
}

export function PatientPicker({ patients, selectedId, onSelect }: PatientPickerProps) {
  // Trigger shows "Sarah · P01" (DESIGN.md section 1); the list adds the gene result.
  const items = patients.map(p => ({ value: p.id, label: `${p.name} · ${p.id}` }));

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span id="patient-picker-label" className="text-sm font-medium text-ink-muted">
        Patient
      </span>
      <Select
        items={items}
        value={selectedId}
        onValueChange={value => {
          if (typeof value === 'string') onSelect(value);
        }}
      >
        <SelectTrigger
          aria-labelledby="patient-picker-label"
          className="h-11! w-full min-w-0 rounded-lg border-control-border bg-panel-solid px-3 text-base font-semibold text-ink focus-visible:ring-2 focus-visible:ring-marine/60"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {patients.map(p => (
            <SelectItem key={p.id} value={p.id} className="py-2">
              <span className="font-semibold">
                {p.name} · {p.id}
              </span>
              <span className="text-muted-foreground">{geneSummary(p)}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
