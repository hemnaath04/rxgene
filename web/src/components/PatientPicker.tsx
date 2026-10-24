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

export function PatientPicker({ patients, selectedId, onSelect }: PatientPickerProps) {
  const items = patients.map(p => ({ value: p.id, label: `${p.name} — ${p.demoRole}` }));

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
