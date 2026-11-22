import type { ReviewCoachingAnnotation, AnalysisStatus } from "@/types/saved-game";

const CLASSIFICATION_COLORS: Record<string, string> = {
  normal: "bg-[var(--green-subtle)] text-[var(--fg)]",
  inaccuracy: "bg-[var(--quality-inaccuracy-bg)] text-[var(--quality-inaccuracy)]",
  mistake: "bg-[var(--quality-mistake-bg)] text-[var(--quality-mistake)]",
  blunder: "bg-[var(--quality-blunder-bg)] text-[var(--quality-blunder)]",
};

function formatCategory(category: string): string {
  const [group, name] = category.split(".");
  return name ? `${capitalize(group)}: ${name.replace(/_/g, " ")}` : capitalize(group);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function unavailableMessage(status: AnalysisStatus): string {
  if (status === "PENDING") return "Run analysis to generate coaching annotations.";
  if (status === "ENGINE_RUNNING") return "Engine analysis is running. Coaching follows after engine results are saved.";
  if (status === "AI_RUNNING") return "Coaching is being generated…";
  if (status === "ENGINE_COMPLETED") return "Engine analysis complete. Use Retry coaching above to generate coaching.";
  if (status === "FAILED") return "Coaching could not be generated. Retry analysis above.";
  return "This move has no coaching annotation. Only selected critical moments receive explanations.";
}

export function CoachingPanel({ coaching, status }: {
  coaching: ReviewCoachingAnnotation | null | undefined;
  status: AnalysisStatus;
}) {
  return (
    <section aria-labelledby="coaching-panel-heading" className="mt-3">
      <h3 id="coaching-panel-heading" className="text-lg font-semibold">Coaching</h3>
      {coaching ? (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-block rounded-full px-2.5 py-0.5 text-sm font-medium ${CLASSIFICATION_COLORS[coaching.classification] ?? "bg-[var(--quality-unknown-bg)] text-[var(--quality-unknown)]"}`}>
              {capitalize(coaching.classification)}
            </span>
            <span className="text-sm text-[var(--fg-2)]">{formatCategory(coaching.category)}</span>
          </div>
          {coaching.headline && <p className="font-semibold">{coaching.headline}</p>}
          <div>
            <p className="text-sm font-semibold text-[var(--fg-2)]">Why this matters</p>
            <p className="mt-1 text-sm">{coaching.explanation}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--fg-2)]">Lesson</p>
            <p className="mt-1 text-sm">{coaching.lesson}</p>
          </div>
          <p className="mt-2 text-xs text-[var(--fg-2)]">
            Note: explanations refer to the position before the played move. The board shows the position after.
          </p>

        </div>
      ) : (
        <p className="mt-4 text-sm">{unavailableMessage(status)}</p>
      )}
    </section>
  );
}
