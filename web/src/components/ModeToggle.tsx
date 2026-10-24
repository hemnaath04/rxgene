import { Switch } from '@/components/ui/switch';
import type { Mode } from '@/lib/url';

type ModeToggleProps = {
  mode: Mode;
  onChange: (mode: Mode) => void;
};

/** On = EHR mode (the UI calls our CDS Hooks service). Off = Local (engine in the browser). */
export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-base font-medium text-ink">
      <Switch
        checked={mode === 'ehr'}
        onCheckedChange={checked => onChange(checked ? 'ehr' : 'local')}
        aria-label="EHR mode (CDS Hooks)"
      />
      <span aria-hidden="true">EHR mode (CDS Hooks)</span>
    </label>
  );
}
