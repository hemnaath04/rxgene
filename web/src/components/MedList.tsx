import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { drugCatalog, type DrugGroup } from '@/lib/drugCatalog';
import { capitalize } from '@/lib/verdict';

type MedListProps = {
  /** Current medications (without the prescription being checked). */
  meds: string[];
  /** The prescription being checked; can't also be added as a current medication. */
  checking: string | null;
  onAdd: (drug: string) => void;
  onRemove: (drug: string) => void;
};

const GROUP_HEADINGS: Record<DrugGroup, string> = {
  covered: 'Covered by a CPIC guideline',
  inhibitor: 'CYP2D6 inhibitors (FDA list)',
  uncovered: 'Not covered by RxGene',
};

const GROUP_ORDER: DrugGroup[] = ['covered', 'inhibitor', 'uncovered'];

/** Medication chips. Removing a chip has no animation (high-frequency, DESIGN.md section 4). */
export function MedList({ meds, checking, onAdd, onRemove }: MedListProps) {
  const [open, setOpen] = useState(false);
  const onList = new Set(meds.map(m => m.toLowerCase()));

  const handleSelect = (drug: string) => {
    setOpen(false);
    onAdd(drug);
  };

  return (
    <div role="group" aria-labelledby="medlist-heading" className="flex min-w-0 flex-col gap-1.5">
      <span id="medlist-heading" className="text-sm font-medium text-ink-muted">
        Current medications
      </span>

      <div className="flex min-h-12 flex-wrap items-center gap-2">
        {meds.length === 0 ? (
          <span className="text-base text-ink-muted">None</span>
        ) : (
          <ul className="contents">
            {meds.map(med => (
              <li
                key={med}
                className="flex h-12 items-center gap-1 rounded-lg border border-ink/20 bg-panel-solid pr-1 pl-3 text-lg font-semibold text-ink"
              >
                {capitalize(med)}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="press text-ink"
                  onClick={() => onRemove(med)}
                  aria-label={`Remove ${med}`}
                >
                  <X aria-hidden="true" strokeWidth={2} />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                className="press h-12 rounded-lg border-dashed border-ink/30 bg-transparent px-3 text-base font-medium text-ink"
              />
            }
          >
            <Plus aria-hidden="true" strokeWidth={2} />
            Add
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80">
            <Command label="Search medications">
              <CommandInput placeholder="Search medications…" aria-label="Search medications" />
              <CommandList>
                <CommandEmpty>No matching medication.</CommandEmpty>
                {GROUP_ORDER.map(group => (
                  <CommandGroup key={group} heading={GROUP_HEADINGS[group]}>
                    {drugCatalog
                      .filter(d => d.group === group)
                      .map(d => {
                        const taken = onList.has(d.name) || d.name === checking;
                        return (
                          <CommandItem
                            key={d.name}
                            value={d.name}
                            keywords={[d.detail]}
                            disabled={taken}
                            onSelect={() => handleSelect(d.name)}
                          >
                            <span>{d.name}</span>
                            <span className="ml-auto text-xs text-muted-foreground">
                              {onList.has(d.name) ? '(already on list)' : d.name === checking ? '(being checked)' : d.detail}
                            </span>
                          </CommandItem>
                        );
                      })}
                  </CommandGroup>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
