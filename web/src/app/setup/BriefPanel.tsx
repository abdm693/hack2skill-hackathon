import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Sparkles } from "lucide-react";
import type { Brief, Envelope } from "@contracts/api-types";
import { BUDGET_LABEL, FACING_LABEL, STYLE_OPTIONS, plotLabel, spaceLabel } from "@/api/domain";
import { cn, feetInches, num } from "@/app/lib/utils";
import { Pill } from "@/app/ui/primitives";
import { EnvelopeDiagram } from "./EnvelopeDiagram";
import { useSetupUI } from "./store";

type RowKey = "location" | "plot" | "facing" | "storeys" | "rooms" | "spaces" | "style" | "budget" | "pin";

/** Which brief rows the question currently being asked is about. */
export function rowsForField(field?: string | null): RowKey[] {
  switch (field) {
    case "authority":
    case "scheme":
    case "city":
    case "location":
      return ["location"];
    case "plot":
      return ["plot"];
    case "facing":
      return ["facing"];
    case "storeys":
    case "floors":
    case "basement":
      return ["storeys"];
    case "rooms":
    case "bedrooms":
    case "bathrooms":
      return ["rooms", "spaces", "storeys"];
    case "spaces":
      return ["spaces"];
    case "style":
      return ["style"];
    case "budget":
      return ["budget"];
    case "coordinates":
    case "map":
      return ["pin"];
    default:
      return [];
  }
}

function Row({
  label,
  children,
  empty,
  ai,
  asking,
}: {
  label: string;
  children?: ReactNode;
  empty?: boolean;
  ai?: boolean;
  asking?: boolean;
}) {
  return (
    <div className={cn("relative grid grid-cols-[92px_1fr] gap-3 py-2.5 transition-colors duration-500", asking && "bg-brick-soft/60")}>
      {asking && <span className="absolute -left-5 bottom-1 top-1 w-[2px] rounded-full bg-brick sm:-left-6" />}
      <span className="pt-px text-[12.5px] text-pencil">{label}</span>
      <div className="min-w-0 text-[13.5px] leading-snug text-ink">
        {empty ? (
          <span className={cn("text-pencil", asking && "font-medium text-brick")}>{asking ? "Asking now…" : "Not yet"}</span>
        ) : (
          <motion.div initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {children}
            {ai && (
              <span className="inline-flex h-5 items-center gap-1 rounded-full bg-brick-soft px-2 text-[10.5px] font-semibold text-brick" title="You skipped this, so the AI architect chose it">
                <Sparkles className="size-3" strokeWidth={2} />
                AI-chosen
              </span>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}

export function BriefPanel({
  brief,
  envelope,
  askingField,
  askingFacing,
  className,
}: {
  brief: Brief | null;
  envelope: Envelope | null;
  askingField?: string | null;
  /** The pin question can also carry "which way does the front face" chips. */
  askingFacing?: boolean;
  className?: string;
}) {
  const preview = useSetupUI((s) => s.preview);
  const asking = new Set<RowKey>([...rowsForField(askingField), ...(askingFacing ? (["facing"] as RowKey[]) : [])]);
  const auto = new Set(brief?.auto_filled ?? []);
  const plot = brief?.plot;
  const hasPlot = !!plot?.width_ft && !!plot?.depth_ft;
  const style = STYLE_OPTIONS.find((s) => s.name === brief?.style);
  const spaces = (brief?.spaces ?? []).filter((s) => s !== "kitchen" && s !== "dining");

  const env = preview?.envelope ?? envelope;
  const w = preview?.width ?? plot?.width_ft ?? 0;
  const d = preview?.depth ?? plot?.depth_ft ?? 0;
  const corner = preview?.corner ?? plot?.corner ?? false;
  const perFloor = env ? Math.min(env.buildable_rect.w * env.buildable_rect.d, env.max_ground_coverage_sqft) : 0;

  return (
    <div className={cn("px-5 py-6 sm:px-6", className)}>
      <div className="flex items-center justify-between">
        <h2 className="font-display-text text-[20px] font-medium text-ink">Brief</h2>
        <span className="inline-flex items-center gap-1.5 text-[12px] text-pencil">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pass/50" />
            <span className="relative inline-flex size-2 rounded-full bg-pass" />
          </span>
          Updates as you answer
        </span>
      </div>

      <div className="mt-3 divide-y divide-line border-y border-line">
        <Row label="Location" empty={!brief?.authority && !brief?.scheme} ai={auto.has("authority") || auto.has("scheme")} asking={asking.has("location")}>
          <span>{[brief?.scheme, brief?.city].filter(Boolean).join(", ") || brief?.city}</span>
          {brief?.authority && (
            <Pill tone={brief.authority === "LDA" ? "pass" : "warn"} dot={false}>
              {brief.authority === "LDA" ? "LDA rules" : `${brief.authority}: own bylaws`}
            </Pill>
          )}
        </Row>
        <Row label="Plot" empty={!hasPlot} ai={auto.has("plot")} asking={asking.has("plot")}>
          {hasPlot && (
            <>
              <span className="font-medium">{plotLabel(plot!.area_marla || (plot!.width_ft * plot!.depth_ft) / 225)}</span>
              <span className="text-graphite tabular">
                {feetInches(plot!.width_ft)} × {feetInches(plot!.depth_ft)}
              </span>
              {plot!.corner && <Pill dot={false}>Corner</Pill>}
            </>
          )}
        </Row>
        <Row label="Facing" empty={!brief?.facing} ai={auto.has("facing")} asking={asking.has("facing")}>
          {brief?.facing && <span>{FACING_LABEL[brief.facing] ?? brief.facing}</span>}
        </Row>
        <Row label="Storeys" empty={!brief?.storeys} ai={auto.has("storeys")} asking={asking.has("storeys")}>
          {!!brief?.storeys && (
            <span>
              {brief.storeys} {brief.storeys === 1 ? "storey" : "storeys"}
              {brief.basement ? " + basement" : ""}
            </span>
          )}
        </Row>
        <Row label="Rooms" empty={!brief?.bedrooms} ai={auto.has("bedrooms") || auto.has("bathrooms")} asking={asking.has("rooms")}>
          {!!brief?.bedrooms && (
            <span>
              {brief.bedrooms} bedrooms{brief.bathrooms ? `, ${brief.bathrooms} baths` : ""}
            </span>
          )}
        </Row>
        <Row label="Spaces" empty={!spaces.length} ai={auto.has("spaces")} asking={asking.has("spaces")}>
          {spaces.map((s) => (
            <span key={s} className="rounded-full bg-wash px-2 py-0.5 text-[12px] text-ink-2">
              {spaceLabel(s)}
            </span>
          ))}
        </Row>
        <Row label="Style" empty={!brief?.style} ai={auto.has("style")} asking={asking.has("style")}>
          <span>{brief?.style}</span>
          {style && (
            <span className="flex -space-x-1">
              {style.palette.map((c) => (
                <span key={c} className="size-3.5 rounded-full ring-2 ring-sheet" style={{ background: c }} />
              ))}
            </span>
          )}
        </Row>
        <Row label="Budget" empty={!brief?.budget} ai={auto.has("budget")} asking={asking.has("budget")}>
          {brief?.budget && <span>{BUDGET_LABEL[brief.budget] ?? brief.budget}</span>}
        </Row>
        <Row label="Map pin" empty={false} asking={asking.has("pin")}>
          {brief?.coordinates ? (
            <span className="tabular">
              {brief.coordinates.lat.toFixed(4)}, {brief.coordinates.lng.toFixed(4)}
            </span>
          ) : (
            <span className={cn(asking.has("pin") ? "font-medium text-brick" : "text-pencil")}>{asking.has("pin") ? "Asking now (optional)" : "Optional"}</span>
          )}
        </Row>
      </div>

      {/* LDA envelope */}
      <div className="mt-7">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-display-text text-[18px] font-medium text-ink">What LDA lets you build</h3>
          <AnimatePresence>
            {preview && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[11.5px] font-medium text-brick">
                Preview
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        {env && <p className="mt-0.5 text-[12.5px] text-graphite">{env.band} band, {env.authority} Building & Zoning Regulations</p>}

        <div className="relative mt-3 overflow-hidden rounded-[18px] bg-plaster ring-1 ring-line">
          <div className="bg-drafting-faint">
            {w && d ? (
              <EnvelopeDiagram width={w} depth={d} envelope={env} corner={corner} facing={brief?.facing} className="h-auto w-full" />
            ) : (
              <div className="grid aspect-[320/330] place-items-center px-8 text-center">
                <div>
                  <svg viewBox="0 0 120 150" className="mx-auto h-28 w-auto" aria-hidden>
                    <rect x="20" y="10" width="80" height="120" fill="none" stroke="rgb(30 27 23 / 0.3)" strokeDasharray="4 4" />
                    <path d="M8 140H112" stroke="rgb(30 27 23 / 0.25)" />
                  </svg>
                  <p className="mt-3 text-[13px] leading-relaxed text-graphite">Pick a plot size and the buildable envelope appears here instantly.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {env && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="mt-3 flex flex-wrap gap-2">
              <EnvChip>Max coverage {num(env.max_coverage_pct)}%</EnvChip>
              <EnvChip>Max height {num(env.max_height_ft)} ft</EnvChip>
              <EnvChip>{env.max_storeys} storeys</EnvChip>
              <EnvChip>FAR 1:{env.max_far}</EnvChip>
            </div>
            <p className="mt-4 font-display-text text-[19px] leading-snug text-ink">
              Build up to <span className="tabular">{num(perFloor)}</span> sq ft a floor, {env.max_storeys} floors high.
            </p>
            <ul className="mt-3 space-y-1.5">
              {env.notes.slice(0, 4).map((n) => (
                <li key={n} className="flex gap-2 text-[12.5px] leading-relaxed text-graphite">
                  <span className="mt-[7px] size-1 shrink-0 rounded-full bg-brick/60" />
                  {n}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function EnvChip({ children }: { children: ReactNode }) {
  return <span className="inline-flex h-7 items-center rounded-full bg-ink px-3 text-[12px] font-medium text-sheet tabular">{children}</span>;
}
