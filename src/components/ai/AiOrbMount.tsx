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
      className={`tc-ai-orb-empty-state pointer-events-none flex h-full flex-col items-center justify-center gap-3 px-6 py-2 text-center transition-all duration-700 ease-out ${
        visible ? "opacity-100 scale-100" : "opacity-0 scale-90"
      }`}
      aria-hidden={!visible}
    >
      <div
        className="tc-ai-orb-stage relative h-32 w-32 sm:h-40 sm:w-40"
      >
        <ClientOnly fallback={<OrbFallback />}>
          <Suspense fallback={<OrbFallback />}>
            <AiOrb />
          </Suspense>
        </ClientOnly>
      </div>
      <div className="space-y-1">
        <div className="text-base font-semibold tracking-tight sm:text-lg">TransCore AI</div>
        <p className="max-w-[16rem] text-[12px] leading-snug text-muted-foreground">
          Ask anything about your fleet.
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