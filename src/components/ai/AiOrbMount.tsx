import { lazy, Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";

// Lazy-import the R3F module so its browser-only three.js imports never
// enter the SSR graph. Rendered only inside <ClientOnly>.
const AiOrb = lazy(() => import("./AiOrb"));

/**
 * Empty-state hero for the AI Assistant. Renders the animated particle orb
 * plus the TransCore AI label and suggestion copy. Fades/scales via the
 * `visible` prop so callers can smoothly hide it once a conversation starts.
 */
export function AiOrbEmptyState({ visible = true }: { visible?: boolean }) {
  return (
    <div
      className={`tc-ai-orb-empty-state pointer-events-none flex h-full flex-col items-center justify-center gap-6 px-6 py-6 text-center transition-all duration-700 ease-out ${
        visible ? "opacity-100 scale-100" : "opacity-0 scale-90"
      }`}
      aria-hidden={!visible}
    >
      <div
        className="tc-ai-orb-stage relative h-56 w-56 sm:h-64 sm:w-64"
      >
        <ClientOnly fallback={<OrbFallback />}>
          <Suspense fallback={<OrbFallback />}>
            <AiOrb />
          </Suspense>
        </ClientOnly>
      </div>
      <div className="space-y-1.5">
        <div className="text-xl font-semibold tracking-tight sm:text-2xl">TransCore AI</div>
        <p className="max-w-xs text-xs leading-relaxed text-muted-foreground sm:text-sm">
          Ask anything about your fleet, trips, fuel, maintenance, or logistics.
        </p>
      </div>
    </div>
  );
}

function OrbFallback() {
  return (
    <div className="tc-ai-orb-fallback absolute inset-0" aria-hidden="true" />
  );
}