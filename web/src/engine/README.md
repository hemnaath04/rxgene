# RxGene Rule Engine

Pure TypeScript rule engine for pharmacogenomics (PGx) checks.

## Files

- `types.ts` - TypeScript type definitions
- `data.ts` - Data loader for CPIC snapshots and inhibitor tables
- `activityScore.ts` - CYP2D6 activity score calculation
- `phenotype.ts` - Activity score to phenotype mapping
- `phenoconversion.ts` - Inhibitor detection and AS adjustment
- `recommend.ts` - CPIC recommendation lookup and alert level determination
- `checkOrder.ts` - Main orchestration function
- `cdsCard.ts` - CDS Hooks card conversion (`toCdsCard`)
- `index.ts` - Public API exports
- `fixtures.test.ts` - Comprehensive test suite (22 cases)

## Usage

```typescript
import { checkOrder, type Patient } from './engine';

const patient: Patient = {
  id: 'P01',
  name: 'Sarah',
  cyp2d6: '*1/*1',
  meds: ['fluoxetine']
};

const assessments = checkOrder(patient, 'codeine');
// Returns DrugAssessment[] with alerts
```

## Rules

All clinical rules are from `.kiro/steering/clinical-rules.md`:

1. **CYP2D6 Activity Score**: Sum of allele activity values (handle duplications)
2. **Phenotype Mapping**: AS → PM/IM/NM/UM
3. **Phenoconversion**: Strong inhibitor → AS × 0, Moderate → AS × 0.5
4. **Lookup**: By AS for codeine/tramadol/atomoxetine, by phenotype for clopidogrel
5. **Alert Levels**: RED (avoid), YELLOW (titrate), GREEN (standard), GREY (not assessed)

## Testing

```bash
npm test              # Run all tests
npm run test:watch   # Watch mode
```

All 22 fixture cases must pass before feature freeze.
