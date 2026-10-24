import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PresetPatient } from '@/data/patients';

type PatientPickerProps = {
  patients: PresetPatient[];
  selectedId: string;
  onSelect: (id: string) => void;
};

/** "Sarah · CYP2D6 *1/*1". Name and gene results only; the internal demo notes stay hidden. */
function patientLabel(p: PresetPatient): string {
  const genes = [
    p.cyp2d6 ? `CYP2D6 ${p.cyp2d6}` : null,
    p.cyp2c19 ? `CYP2C19 ${p.cyp2c19}` : null,
  ].filter(Boolean);
  return [p.name, ...(genes.length ? genes : ['no gene result'])].join(' · ');
}

export function PatientPicker({ patients, selectedId, onSelect }: PatientPickerProps) {
  const items = patients.map(p => ({ value: p.id, label: patientLabel(p) }));

  return (
    <div>
      <label id="patient-picker-label">Patient (synthetic preset)</label>
      <Select
        items={items}
        value={selectedId}
        onValueChange={value => {
          if (typeof value === 'string') onSelect(value);
        }}
      >
        <SelectTrigger aria-labelledby="patient-picker-label">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map(item => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
