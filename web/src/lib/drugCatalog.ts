// Drugs offered in the MedList search box:
// - drugs with a CPIC recommendation snapshot (data/cpic/recommendations)
// - every CYP2D6 inhibitor in data/inhibitors.json
// - a few uncovered drugs, which show a GREY "not assessed" card
import inhibitors from '@/data/inhibitors.json';
import { drugToGene } from '@/engine/data';

export type DrugGroup = 'covered' | 'inhibitor' | 'uncovered';

export type DrugOption = {
  name: string;
  group: DrugGroup;
  detail: string;
};

const UNCOVERED_DRUGS = ['acetaminophen', 'ibuprofen'];

function build(): DrugOption[] {
  const options: DrugOption[] = [];
  const seen = new Set<string>();
  const push = (option: DrugOption) => {
    if (seen.has(option.name)) return;
    seen.add(option.name);
    options.push(option);
  };

  for (const [drug, gene] of Object.entries(drugToGene)) {
    if (gene) push({ name: drug, group: 'covered', detail: `${gene} · CPIC guideline` });
  }

  const strengths = ['strong', 'moderate', 'weak'] as const;
  for (const strength of strengths) {
    for (const drug of inhibitors.CYP2D6[strength]) {
      push({ name: drug.toLowerCase(), group: 'inhibitor', detail: `CYP2D6 inhibitor (${strength}, FDA)` });
    }
  }

  for (const drug of UNCOVERED_DRUGS) {
    push({ name: drug, group: 'uncovered', detail: 'No PGx guideline in RxGene' });
  }

  return options;
}

export const drugCatalog: DrugOption[] = build();

/** True when the engine has a CPIC recommendation for this drug. */
export function isCoveredDrug(drug: string): boolean {
  return Boolean(drugToGene[drug.toLowerCase()]);
}
