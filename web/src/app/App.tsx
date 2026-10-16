/** App shell (track: APP): routes, motion defaults and toasts. */
import { lazy, Suspense } from "react";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { MotionConfig } from "motion/react";
import { Workspace } from "./routes/Workspace";
import { ProjectLayout, StepGate } from "./routes/ProjectLayout";
import { SetupStep } from "./setup/SetupStep";
import { ConceptsStep } from "./concepts/ConceptsStep";
import { DesignStep } from "./design/DesignStep";
import { RevisionsStep } from "./revisions/RevisionsStep";
import { Toaster, Spinner } from "./ui/primitives";

// The 3D viewer pulls in three.js; load it only when the user reaches Explore.
const ExploreStep = lazy(() => import("./explore/ExploreStep").then((m) => ({ default: m.ExploreStep })));

function Loading() {
  return (
    <div className="grid h-full place-items-center bg-night text-sheet/70">
      <div className="flex items-center gap-3 text-[14px]">
        <Spinner className="text-[#e7a58f]" /> Loading the 3D studio…
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-paper p-6 text-center">
      <div>
        <p className="font-display-tight text-[48px] text-ink">Off the plan.</p>
        <p className="mt-2 text-[15px] text-graphite">This page doesn't exist.</p>
        <Link to="/" className="mt-6 inline-block text-[14px] font-medium text-brick underline-offset-4 hover:underline">
          Back to your projects
        </Link>
      </div>
    </div>
  );
}

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Workspace />} />
          <Route path="/p/:id" element={<ProjectLayout />}>
            <Route index element={<StepGate />} />
            <Route path="setup" element={<StepGate step="setup"><SetupStep /></StepGate>} />
            <Route path="concepts" element={<StepGate step="concepts"><ConceptsStep /></StepGate>} />
            <Route path="design" element={<StepGate step="design"><DesignStep /></StepGate>} />
            <Route
              path="explore"
              element={
                <StepGate step="explore">
                  <Suspense fallback={<Loading />}>
                    <ExploreStep />
                  </Suspense>
                </StepGate>
              }
            />
            <Route path="revisions" element={<StepGate step="revisions"><RevisionsStep /></StepGate>} />
            <Route path="*" element={<StepGate />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </MotionConfig>
  );
}
