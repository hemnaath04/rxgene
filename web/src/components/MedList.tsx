import { useState } from 'react';
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

type MedListProps = {
  meds: string[];
  onAdd: (drug: string) => void;
  onRemove: (drug: string) => void;
};

const GROUP_HEADINGS: Record<DrugGroup, string> = {
  covered: 'Covered by a CPIC guideline',
  inhibitor: 'CYP2D6 inhibitors (FDA list)',
  uncovered: 'Not covered by RxGene',
};

const GROUP_ORDER: DrugGroup[] = ['covered', 'inhibitor', 'uncovered'];

export function MedList({ meds, onAdd, onRemove }: MedListProps) {
  const [open, setOpen] = useState(false);
  const onList = new Set(meds.map(m => m.toLowerCase()));

  const handleSelect = (drug: string) => {
    setOpen(false);
    onAdd(drug);
  };

  return (
    <section aria-labelledby="medlist-heading">
      <h2 id="medlist-heading">Current medications</h2>

      {meds.length === 0 ? (
        <p>No current medications.</p>
      ) : (
        <ul>
          {meds.map(med => (
            <li key={med}>
              <span>{med}</span>{' '}
              <Button
                variant="outline"
                size="xs"
                onClick={() => onRemove(med)}
                aria-label={`Remove ${med}`}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={<Button variant="outline" />}>Add medication</PopoverTrigger>
        <PopoverContent align="start">
          <Command label="Search medications">
            <CommandInput placeholder="Search medications…" aria-label="Search medications" />
            <CommandList>
              <CommandEmpty>No matching medication.</CommandEmpty>
              {GROUP_ORDER.map(group => (
                <CommandGroup key={group} heading={GROUP_HEADINGS[group]}>
                  {drugCatalog
                    .filter(d => d.group === group)
                    .map(d => (
                      <CommandItem
                        key={d.name}
                        value={d.name}
                        keywords={[d.detail]}
                        disabled={onList.has(d.name)}
                        onSelect={() => handleSelect(d.name)}
                      >
                        <span>{d.name}</span>
                        <span>
                          {onList.has(d.name) ? '(already on list)' : d.detail}
                        </span>
                      </CommandItem>
                    ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </section>
  );
}
