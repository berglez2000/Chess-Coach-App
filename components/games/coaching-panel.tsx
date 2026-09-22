import type { ReviewCoachingAnnotation, AnalysisStatus } from "@/types/saved-game";

const CLASSIFICATION_COLORS: Record<string, string> = {
  normal: "bg-[#20382e]/10 text-[#20382e]",
  inaccuracy: "bg-yellow-100 text-yellow-800",
  mistake: "bg-orange-100 text-orange-800",
  blunder: "bg-red-100 text-red-800",
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
  if (status === "ENGINE_RUNNING" || status === "AI_RUNNING") return "Coaching is being generated…";
  if (status === "ENGINE_COMPLETED") return "Engine analysis complete. Run analysis again to generate coaching.";
  if (status === "FAILED") return "Coaching could not be generated. Retry analysis above.";
  return "This move has no coaching annotation. Only selected critical moments receive explanations.";
}

export function CoachingPanel({ coaching, status }: {
  coaching: ReviewCoachingAnnotation | null | undefined;
  status: AnalysisStatus;
}) {
  return (
    <section aria-labelledby="coaching-panel-heading" className="mt-6 rounded-lg border border-[#20382e]/20 bg-white p-5">
      <h3 id="coaching-panel-heading" className="text-lg font-semibold">Coaching</h3>
      {coaching ? (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-block rounded-full px-2.5 py-0.5 text-sm font-medium ${CLASSIFICATION_COLORS[coaching.classification] ?? "bg-gray-100 text-gray-800"}`}>
              {capitalize(coaching.classification)}
            </span>
            <span className="text-sm text-[#465c50]">{formatCategory(coaching.category)}</span>
          </div>
          {coaching.headline && <p className="font-semibold">{coaching.headline}</p>}
          <div>
            <p className="text-sm font-semibold text-[#465c50]">Why this matters</p>
            <p className="mt-1 text-sm">{coaching.explanation}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#465c50]">Lesson</p>
            <p className="mt-1 text-sm">{coaching.lesson}</p>
          </div>
          <p className="mt-2 text-xs text-[#465c50]">
            Note: explanations refer to the position before the played move. The board shows the position after.
          </p>
          <p className="text-xs text-[#465c50]">Coach model: {coaching.model}</p>
        </div>
      ) : (
        <p className="mt-4 text-sm">{unavailableMessage(status)}</p>
      )}
    </section>
  );
}
