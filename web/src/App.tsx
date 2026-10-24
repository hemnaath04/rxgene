import { useState } from 'react';
import { AlertCard, NotCoveredCard } from '@/components/AlertCard';
import { MedList } from '@/components/MedList';
import { PatientPicker } from '@/components/PatientPicker';
import { patients, findPatient, type PresetPatient } from '@/data/patients';
import { checkOrder, type DrugAssessment } from '@/engine';
import { getActivityScore } from '@/engine/activityScore';
import { activityScoreToPhenotype, cyp2c19DiplotypeToPhenotype } from '@/engine/phenotype';
import { isCoveredDrug } from '@/lib/drugCatalog';

// One entry per alerted drug. An engine assessment, or a GREY card for an uncovered added drug.
type CardEntry =
  | { kind: 'assessment'; drug: string; assessment: DrugAssessment }
  | { kind: 'uncovered'; drug: string };

/** Gene result in plain words, from the genotype alone (no medicines considered). */
function cyp2d6ByGenes(genotype?: string): string {
  const result = getActivityScore(genotype);
  if (result.activityScore === null) return result.phenotype;
  return activityScoreToPhenotype(result.activityScore);
}

function GeneChart({ patient }: { patient: PresetPatient }) {
  return (
    <section aria-labelledby="chart-heading">
      <h2 id="chart-heading">{patient.name}'s gene results</h2>
      <ul>
        <li>
          CYP2D6: {patient.cyp2d6 ? `${patient.cyp2d6} — ${cyp2d6ByGenes(patient.cyp2d6)}` : 'No result on file'}
        </li>
        <li>
          CYP2C19:{' '}
          {patient.cyp2c19
            ? `${patient.cyp2c19} — ${cyp2c19DiplotypeToPhenotype(patient.cyp2c19)}`
            : 'No result on file'}
        </li>
      </ul>
      <p>Suggested demo: add {patient.demoDrug}.</p>
    </section>
  );
}

function App() {
  const [patientId, setPatientId] = useState(patients[0].id);
  const [meds, setMeds] = useState<string[]>(patients[0].meds);
  const [cards, setCards] = useState<CardEntry[]>([]);

  const patient = findPatient(patientId) ?? patients[0];

  const selectPatient = (id: string) => {
    const next = findPatient(id);
    if (!next) return;
    setPatientId(next.id);
    setMeds([...next.meds]);
    setCards([]);
  };

  const addDrug = (drug: string) => {
    if (meds.some(m => m.toLowerCase() === drug.toLowerCase())) return;

    // Check against the current med list, then add the drug to it.
    const assessments = checkOrder({ ...patient, meds }, drug);
    const fresh: CardEntry[] = assessments.map((a): CardEntry => ({ kind: 'assessment', drug: a.drug, assessment: a }));
    if (!isCoveredDrug(drug) && !assessments.some(a => a.drug === drug)) {
      fresh.unshift({ kind: 'uncovered', drug });
    }

    // A fresh assessment of a drug replaces its older card.
    const freshDrugs = new Set(fresh.map(c => c.drug));
    setCards(prev => [...fresh, ...prev.filter(c => !freshDrugs.has(c.drug))]);
    setMeds(prev => [...prev, drug]);
  };

  const removeDrug = (drug: string) => {
    setMeds(prev => prev.filter(m => m !== drug));
    // Clear the drug's own cards, any card it triggered (e.g. the reverse case),
    // and any card whose phenoconversion depended on it as the inhibitor.
    setCards(prev =>
      prev.filter(
        c =>
          c.drug !== drug &&
          !(
            c.kind === 'assessment' &&
            (c.assessment.triggeredBy === drug || c.assessment.inhibitor?.drug === drug)
          )
      )
    );
  };

  return (
    <main>
      <header>
        <h1>RxGene</h1>
        <p>Pre-prescription pharmacogenomics check. Synthetic data only. Not a medical device.</p>
        <PatientPicker patients={patients} selectedId={patientId} onSelect={selectPatient} />
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <GeneChart patient={patient} />
          <MedList meds={meds} onAdd={addDrug} onRemove={removeDrug} />
        </div>

        <section aria-labelledby="alerts-heading" aria-live="polite">
          <h2 id="alerts-heading">Alerts</h2>
          {cards.length === 0 ? (
            <p>Add a medication to run the check.</p>
          ) : (
            cards.map(c =>
              c.kind === 'assessment' ? (
                <AlertCard key={c.drug} assessment={c.assessment} />
              ) : (
                <NotCoveredCard key={c.drug} drug={c.drug} />
              )
            )
          )}
        </section>
      </div>
    </main>
  );
}

export default App;
