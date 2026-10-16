/** /app/signin and /app/signup: the same form on a calm page, then back to where you were (?next=…). */
import { useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import { useAuth, type AuthMode } from "@/app/store/auth";
import { Wordmark } from "@/app/ui/brand";
import { ease } from "@/app/ui/motion";
import { AuthForm } from "./AuthForm";

export function AuthPage({ mode }: { mode: AuthMode }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const user = useAuth((s) => s.user);
  const next = safeNext(params.get("next"));

  useEffect(() => {
    document.title = mode === "signup" ? "Create your account · Naqsha" : "Sign in · Naqsha";
  }, [mode]);

  // Already signed in: nothing to do here.
  useEffect(() => {
    if (user) navigate(next, { replace: true });
  }, [user, next, navigate]);

  const go = (m: AuthMode) => {
    if (m === "reset") return navigate(`/app/signin?reset=1${next !== "/app" ? `&next=${encodeURIComponent(next)}` : ""}`, { replace: true });
    navigate(`/app/${m}${next !== "/app" ? `?next=${encodeURIComponent(next)}` : ""}`, { replace: true });
  };
  const formMode: AuthMode = params.get("reset") ? "reset" : mode;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-canvas">
      <header className="flex items-center justify-between px-4 py-4 sm:px-8 sm:py-6">
        <Link to="/" aria-label="Naqsha home" className="rounded-[8px] outline-none focus-visible:shadow-focus">
          <Wordmark />
        </Link>
        <Link to="/app" className="rounded-full px-3 py-2 text-[14px] font-medium text-ink-2 outline-none transition-colors hover:bg-surface-2 hover:text-ink focus-visible:shadow-focus">
          Continue as a guest
        </Link>
      </header>
      <main className="grid flex-1 place-items-center px-4 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: ease.out }}
          className="w-full max-w-[440px] rounded-panel bg-surface p-6 shadow-e3 sm:p-8"
        >
          <AuthForm mode={formMode} onModeChange={go} headingLevel="h1" onDone={() => navigate(next, { replace: true })} />
        </motion.div>
      </main>
    </div>
  );
}

/** Only same-site paths are allowed as ?next= targets. */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/app";
  return raw;
}
