import { Switch } from '@/components/ui/switch';
import type { Mode } from '@/lib/url';

type ModeToggleProps = {
  mode: Mode;
  onChange: (mode: Mode) => void;
};

/** On = EHR mode (the UI calls our CDS Hooks service). Off = Local (engine in the browser). */
export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <span aria-hidden="true">Local</span>
      <Switch
        checked={mode === 'ehr'}
        onCheckedChange={checked => onChange(checked ? 'ehr' : 'local')}
        aria-label="EHR mode (CDS Hooks)"
      />
      <span aria-hidden="true">EHR mode (CDS Hooks)</span>
    </div>
  );
}
