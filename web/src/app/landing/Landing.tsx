/**
 * The landing page (/): what Naqsha does for a family or a builder, in plain business language, with the
 * house-under-construction animation, and a separate Portal button into the app (/app).
 */
import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/app/lib/utils";
import { openSampleHome } from "@/app/lib/samples";
import { AccountMenu } from "@/app/auth/AccountMenu";
import { Button, buttonClass } from "@/app/ui/Button";
import { Wordmark } from "@/app/ui/brand";
import { ease } from "@/app/ui/motion";
import { Construction } from "./Construction";

const BENEFITS: { title: string; line: string }[] = [
  { title: "Plot to approval-ready plan in minutes", line: "Tell Naqsha the plot and the family. Get dimensioned floor plans the same afternoon, not after weeks of back and forth." },
  { title: "Checked against LDA, every time", line: "42 bylaw checks and 5 livability rules on every plan: setbacks, coverage, height, stairs to the roof, railings at every drop." },
  { title: "Walk your home before you build it", line: "Room by room, on any laptop or phone. Find the cramped bedroom while it costs nothing to fix." },
  { title: "Share with family and your architect", line: "Invite your team to design, or send your client a link. Everyone comments in one place, with their name on it." },
  { title: "Revisions in minutes, not weeks", line: "Pin a note on a wall. Naqsha returns the next version, still compliant, and answers every note in its thread." },
  { title: "Drawings your contractor can use", line: "Print every floor at 1:100 with a title block, area schedule and compliance sheet, or save it as a PDF." },
];

const STEPS: { label: string; time: string; title: string; line: string }[] = [
  { label: "Brief", time: "2 minutes", title: "Tell Naqsha about the plot", line: "Size, which way it faces, who will live there. One message is enough; Naqsha asks only what it still needs." },
  { label: "Concepts", time: "1 minute", title: "Choose a direction", line: "Four exteriors by day and by night. Pick the one that feels like home and Naqsha plans the floors around it." },
  { label: "House", time: "5 minutes", title: "Walk it, change it, share it", line: "Walk through in 3D, pin notes for changes, and bring in your family, your architect or your client." },
];

const SAMPLES: { img: string; title: string; caption: string }[] = [
  { img: "/mock/concept-1.jpg", title: "10 marla family home", caption: "Johar Town · Stone and teak" },
  { img: "/landing/home-day.jpg", title: "Courtyard frame house", caption: "Mid-row · Solar-ready roof" },
  { img: "/mock/concept-2.jpg", title: "Corner home", caption: "1 kanal · Stone and glass" },
];

export function Landing() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    document.title = "Naqsha · Walk through your home before the first brick";
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  const sample = async () => {
    if (opening) return;
    setOpening(true);
    const ok = await openSampleHome(navigate);
    if (!ok) setOpening(false);
  };

  return (
    <div className="min-h-[100dvh] overflow-x-clip bg-canvas text-ink">
      {/* Header */}
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-40 transition-[background-color,box-shadow,backdrop-filter] duration-300",
          scrolled ? "glass-light" : "bg-transparent",
        )}
      >
        <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-3 px-4 sm:px-8">
          <Link to="/" aria-label="Naqsha home" className="shrink-0 rounded-[8px] outline-none focus-visible:shadow-focus">
            <Wordmark />
          </Link>
          <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
            <a href="#how" className="hidden rounded-full px-3 py-2 text-[14px] font-medium text-ink-2 outline-none transition-colors hover:text-ink focus-visible:shadow-focus md:inline-block">
              How it works
            </a>
            <a href="#samples" className="hidden rounded-full px-3 py-2 text-[14px] font-medium text-ink-2 outline-none transition-colors hover:text-ink focus-visible:shadow-focus md:inline-block">
              Samples
            </a>
            <span className="hidden sm:inline-flex">
              <AccountMenu />
            </span>
            <Link to="/app" className={buttonClass("ink", "sm", "px-4")}>
              Open portal
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-[1280px] px-4 pt-28 sm:px-8 sm:pt-36 lg:pt-40" aria-labelledby="hero-title">
          <motion.h1
            id="hero-title"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: ease.out }}
            className="max-w-[12ch] text-[clamp(2.5rem,7.5vw,7rem)] font-semibold leading-[.95] tracking-[-.045em] text-ink"
          >
            Walk through your home before the first brick.
          </motion.h1>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: ease.out, delay: 0.08 }}
            className="mt-6 flex flex-col gap-8 sm:mt-8 lg:flex-row lg:items-end lg:justify-between"
          >
            <p className="max-w-[34rem] text-body-lg text-ink-2 sm:text-[19px] sm:leading-[30px]">
              Naqsha turns your plot and your family's wishes into an LDA-ready design and a 3D home you can walk, share and change, in one sitting.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row lg:shrink-0">
              <Button variant="primary" size="lg" trailing={<ArrowRight className="size-4" strokeWidth={2} />} onClick={() => navigate("/app")}>
                Start your home
              </Button>
              <Button variant="secondary" size="lg" loading={opening} onClick={() => void sample()}>
                Explore a sample home
              </Button>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: ease.out, delay: 0.16 }}
            className="mt-12 sm:mt-16"
          >
            <Construction />
          </motion.div>
        </section>

        {/* Benefits */}
        <section className="mx-auto max-w-[1280px] px-4 pt-28 sm:px-8 sm:pt-36" aria-labelledby="benefits-title">
          <SectionHead
            id="benefits-title"
            title="Everything between the plot and the contractor."
            line="What used to take weeks of sketches and site visits now fits in one sitting with your family."
          />
          <ul className="mt-14 grid grid-cols-1 gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((b, i) => (
              <Reveal key={b.title} delay={(i % 3) * 0.06} as="li">
                <div className="h-px w-10 bg-ink" aria-hidden />
                <h3 className="mt-5 text-heading text-ink">{b.title}</h3>
                <p className="mt-2 text-[15px] leading-[24px] text-ink-2">{b.line}</p>
              </Reveal>
            ))}
          </ul>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto max-w-[1280px] scroll-mt-24 px-4 pt-28 sm:px-8 sm:pt-36" aria-labelledby="how-title">
          <div className="rounded-media bg-surface px-5 py-14 shadow-e1 sm:px-12 sm:py-20">
            <SectionHead id="how-title" title="How it works" line="Three places, one conversation. You can stop at any point and come back." />
            <ol className="mt-14 grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">
              {STEPS.map((s, i) => (
                <Reveal key={s.label} delay={i * 0.08} as="li" className="relative">
                  <div className="flex items-center gap-3">
                    <span className="text-[13px] font-semibold text-accent">{s.label}</span>
                    <span className="h-px flex-1 bg-line" aria-hidden />
                    <span className="tabular text-[12px] font-medium text-ink-3">{s.time}</span>
                  </div>
                  <h3 className="mt-5 text-heading text-ink">{s.title}</h3>
                  <p className="mt-2 text-[15px] leading-[24px] text-ink-2">{s.line}</p>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* Samples */}
        <section id="samples" className="mx-auto max-w-[1280px] scroll-mt-24 px-4 pt-28 sm:px-8 sm:pt-36" aria-labelledby="samples-title">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <SectionHead id="samples-title" title="Sample homes" line="Open a finished home and walk through it. No account needed." />
            <Button variant="secondary" className="self-start sm:self-auto" loading={opening} onClick={() => void sample()} trailing={<ArrowRight className="size-4" strokeWidth={1.75} />}>
              Walk through one
            </Button>
          </div>
          <ul className="mt-12 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {SAMPLES.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.06} as="li">
                <button type="button" onClick={() => void sample()} className="group/s block w-full text-left outline-none" aria-label={`Explore the sample home: ${s.title}`}>
                  <span className="block overflow-hidden rounded-card bg-surface-2 shadow-e1 transition-[box-shadow,transform] duration-[600ms] ease-out group-hover/s:-translate-y-0.5 group-hover/s:shadow-e2 group-focus-visible/s:shadow-focus">
                    <img src={s.img} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover transition-transform duration-[600ms] ease-out group-hover/s:scale-[1.02]" />
                  </span>
                  <span className="mt-3 block px-0.5 text-[15px] font-semibold tracking-[-.01em] text-ink">{s.title}</span>
                  <span className="block px-0.5 text-[13px] text-ink-3">{s.caption}</span>
                </button>
              </Reveal>
            ))}
          </ul>
        </section>

        {/* For builders */}
        <section className="mx-auto max-w-[1280px] px-4 pt-28 sm:px-8 sm:pt-36" aria-labelledby="builders-title">
          <div className="flex flex-col items-start gap-8 rounded-media bg-ink px-6 py-14 text-white sm:px-12 sm:py-20 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-[40rem]">
              <h2 id="builders-title" className="text-[32px]/[38px] font-semibold tracking-[-.03em] sm:text-display">
                For builders and architects: win the client in the first meeting.
              </h2>
              <p className="mt-4 text-body-lg text-white/70">
                Arrive with a laptop. Leave with a walkable design the family has already commented on, and a link they can share with everyone who has a say.
              </p>
            </div>
            <Link to="/app" className={buttonClass("secondary", "lg", "border-transparent bg-white text-ink hover:bg-white/90")}>
              Open the Portal
              <ArrowRight className="size-4" strokeWidth={2} />
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mx-auto mt-28 max-w-[1280px] px-4 pb-12 sm:mt-36 sm:px-8">
        <div className="flex flex-col gap-8 border-t border-line pt-10 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Wordmark />
            <p className="mt-3 max-w-xs text-[14px] leading-[22px] text-ink-3">Homes designed with you, checked against LDA rules, and ready to walk.</p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-12 gap-y-2 text-[14px]">
            <Link to="/app" className="text-ink-2 hover:text-ink">Portal</Link>
            <a href="#how" className="text-ink-2 hover:text-ink">How it works</a>
            <a href="#samples" className="text-ink-2 hover:text-ink">Samples</a>
            <Link to="/app/signin" className="text-ink-2 hover:text-ink">Sign in</Link>
          </nav>
        </div>
        <p className="mt-10 text-[13px] text-ink-3">© 2026 Naqsha · Made in Lahore</p>
      </footer>
    </div>
  );
}

function SectionHead({ id, title, line }: { id: string; title: string; line: string }) {
  return (
    <Reveal className="max-w-[44rem]">
      <h2 id={id} className="text-[32px]/[38px] font-semibold tracking-[-.03em] text-ink sm:text-display">{title}</h2>
      <p className="mt-4 text-body-lg text-ink-2">{line}</p>
    </Reveal>
  );
}

/** Fades content up once as it scrolls into view. */
function Reveal({ children, delay = 0, className, as = "div" }: { children: ReactNode; delay?: number; className?: string; as?: "div" | "li" }) {
  const Comp = as === "li" ? motion.li : motion.div;
  return (
    <Comp
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: ease.out, delay }}
      className={className}
    >
      {children}
    </Comp>
  );
}
