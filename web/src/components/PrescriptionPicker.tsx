import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { drugCatalog, type DrugGroup } from '@/lib/drugCatalog';
import { capitalize } from '@/lib/verdict';

type PrescriptionPickerProps = {
  value: string;
  onChange: (drug: string) => void;
};

const GROUPS: Array<{ group: DrugGroup; heading: string }> = [
  { group: 'covered', heading: 'Covered by a CPIC guideline' },
  { group: 'inhibitor', heading: 'CYP2D6 inhibitors (FDA list)' },
  { group: 'uncovered', heading: 'Not covered by RxGene' },
];

const items = drugCatalog.map(d => ({ value: d.name, label: capitalize(d.name) }));

/** The drug to check. Choosing one doesn't run anything; the Check prescription button does. */
export function PrescriptionPicker({ value, onChange }: PrescriptionPickerProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span id="prescription-label" className="text-sm font-medium text-ink-muted">
        Check prescription
      </span>
      <Select
        items={items}
        value={value}
        onValueChange={next => {
          if (typeof next === 'string') onChange(next);
        }}
      >
        <SelectTrigger
          aria-labelledby="prescription-label"
          className="h-12! w-full min-w-52 rounded-lg border-ink/20 bg-panel-solid px-3 text-lg font-semibold text-ink"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {GROUPS.map(({ group, heading }) => (
            <SelectGroup key={group}>
              <SelectLabel>{heading}</SelectLabel>
              {drugCatalog
                .filter(d => d.group === group)
                .map(d => (
                  <SelectItem key={d.name} value={d.name}>
                    {capitalize(d.name)}
                  </SelectItem>
                ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
