import { PatientSummary } from '@/components/PatientSummary';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { SummaryLang } from '@/engine/templates';
import type { DrugAssessment } from '@/engine/types';

type PatientExplanationSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null when there is nothing to explain (no assessment, or a mismatch). */
  assessment: DrugAssessment | null;
  initialLang: SummaryLang;
};

/** Second sheet: the plain-language patient summary with EN/ES tabs and its source tag. */
export function PatientExplanationSheet({ open, onOpenChange, assessment, initialLang }: PatientExplanationSheetProps) {
  return (
    <Sheet open={open} onOpenChange={next => onOpenChange(next)}>
      <SheetContent
        side="right"
        className="overflow-y-auto overscroll-contain bg-panel-solid data-[side=right]:w-[min(480px,100vw)]! data-[side=right]:max-w-none!"
      >
        <SheetHeader className="px-6 pt-6">
          <SheetTitle className="text-xl font-semibold text-ink">Patient explanation</SheetTitle>
          <SheetDescription className="text-base text-ink-muted">
            Rewritten from the rule engine's output. It never decides anything.
          </SheetDescription>
        </SheetHeader>
        <div className="px-6 pb-8">
          {assessment ? (
            <PatientSummary assessment={assessment} initialLang={initialLang} />
          ) : (
            <p className="text-base text-ink">No patient explanation for this result. Ask a pharmacist.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
