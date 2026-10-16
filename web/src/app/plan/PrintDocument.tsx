/**
 * Print / Save as PDF (DESIGN.md "Plan → Print"): landscape sheets at a true architectural scale, on A3 or A4.
 * - Cover: the chosen concept, a site plan, the area schedule and the title block.
 * - One sheet per floor at the largest standard scale that fits (1:100 on A3 for most plots), with the scale bar,
 *   north arrow, room schedule and title block. The roof sheet schedules the stair tower, the tank and the solar area.
 * - The compliance report, paginated by measured height: it continues onto further sheets (A-901, A-902…), each with
 *   its own title block, so nothing is ever cut off.
 * Every sheet keeps its contents inside the 10 mm margin: the side column (schedule and title block) shrinks to fit
 * when a plan has many rooms; the drawing itself stays at true scale. All vector SVG; window.print() makes the PDF.
 */
import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Project, Version } from "@contracts/api-types";
import type { BuildingPlan, ComplianceCheck, Level } from "@contracts/plan";
import { assetUrl } from "@/api/client";
import { FACING_LABEL, plotLabel } from "@/api/domain";
import { feetInches, num } from "@/app/lib/utils";
import { PlanDefs, PlanSheet, sheetBounds } from "./FloorPlan";
import { layoutLabels } from "./labels";
import { area, coveredArea, isRoofLevel, levelName, levelsOf, roomsOn, SITE_TYPES, sentenceCase } from "./model";
import { categoryOf, summarize, tallyLine, valueLine } from "./compliance";

export type Paper = "a3" | "a4";
export const PAPER: Record<Paper, { w: number; h: number; label: string }> = {
  a3: { w: 420, h: 297, label: "A3" },
  a4: { w: 297, h: 210, label: "A4" },
};
const MARGIN_MM = 10;
const HEADER_MM = 10;
const GAP_MM = 8;
/** Per paper: the side column's width and the type scale (A4 sets everything a little smaller). */
const LAYOUT: Record<Paper, { sidebar: number; fs: number; columns: number }> = {
  a3: { sidebar: 96, fs: 1, columns: 3 },
  a4: { sidebar: 80, fs: 0.84, columns: 2 },
};
const SCALES = [50, 75, 100, 125, 150, 200, 250, 300, 400];
const PX_PER_MM = 96 / 25.4;

export interface PrintOptions { paper: Paper; levels: string[]; cover: boolean; compliance: boolean }

/** Type sizes in mm, scaled for the paper. */
const Fs = createContext(1);
function useMm() {
  const k = useContext(Fs);
  return (n: number) => `${(n * k).toFixed(2)}mm`;
}

/** Largest standard scale (smallest S in 1:S) at which the floor drawing fits the drawing area. */
export function pickScale(plan: BuildingPlan, paper: Paper): number {
  const B = sheetBounds(plan);
  const p = PAPER[paper];
  const areaW = p.w - 2 * MARGIN_MM - LAYOUT[paper].sidebar - GAP_MM;
  const areaH = p.h - 2 * MARGIN_MM - HEADER_MM;
  for (const s of SCALES) {
    const mmPerFt = 304.8 / s;
    if (B.w * mmPerFt <= areaW && B.h * mmPerFt <= areaH) return s;
  }
  return SCALES[SCALES.length - 1];
}

/** Where the home is, from the brief (the plan's own scheme can be a model's guess, e.g. "DHA / Johar Town"). */
function location(project: Project, plan: BuildingPlan): string {
  const b = project.brief;
  const scheme = b?.scheme && !b.scheme.includes("/") ? b.scheme : null;
  const city = b?.city || plan.site.city || "Lahore";
  return [scheme, city].filter(Boolean).join(", ");
}

export function PrintDocument({ project, version, options, conceptUrl }: { project: Project; version: Version; options: PrintOptions; conceptUrl?: string }) {
  const plan = version.plan;
  const paper = PAPER[options.paper];
  const lay = LAYOUT[options.paper];
  const scale = useMemo(() => pickScale(plan, options.paper), [plan, options.paper]);
  const levels = levelsOf(plan).filter((l) => options.levels.includes(l.id));
  const date = new Date(version.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const [compliancePages, setCompliancePages] = useState(1);
  const pages = (options.cover ? 1 : 0) + levels.length + (options.compliance ? compliancePages : 0);
  let page = 0;
  const block = (title: string, sheetNo: string, scaled = false) => (
    <TitleBlock project={project} version={version} date={date} title={title} sheet={sheetNo} scale={scaled ? `1:${scale} at ${paper.label}` : undefined} page={++page} pages={pages} />
  );
  const mm = (n: number) => `${(n * lay.fs).toFixed(2)}mm`;
  return (
    <Fs.Provider value={lay.fs}>
      <div className="nq-print">
        <style>{`
          .nq-print { font-family: Geist, ui-sans-serif, system-ui, sans-serif; color: #111113; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .nq-print .page { width: ${paper.w}mm; height: ${paper.h}mm; padding: ${MARGIN_MM}mm; box-sizing: border-box; background: #fff; position: relative; overflow: hidden; break-after: page; page-break-after: always; display: flex; flex-direction: column; }
          .nq-print .page:last-child { break-after: auto; page-break-after: auto; }
          .nq-print .mono { font-family: 'Geist Mono', ui-monospace, monospace; font-variant-numeric: tabular-nums; }
          .nq-print table { border-collapse: collapse; width: 100%; }
          .nq-print td, .nq-print th { padding: ${mm(1.1)} 0; border-bottom: 0.2mm solid #E4E4DF; text-align: left; font-weight: 400; vertical-align: top; }
          .nq-print th { color: #6E6E73; font-size: ${mm(2.6)}; font-weight: 500; }
          @media print { .nq-print .nq-measure { display: none !important; } }
        `}</style>

        {options.cover && (
          <section className="page">
            <Header project={project} title="Cover" />
            <div style={{ display: "flex", gap: `${GAP_MM}mm`, flex: 1, minHeight: 0 }}>
              <div style={{ flex: 1.45, display: "flex", flexDirection: "column", gap: "3mm", minWidth: 0, minHeight: 0 }}>
                {conceptUrl ? (
                  <img src={assetUrl(conceptUrl)} alt="" style={{ width: "100%", flex: 1, minHeight: 0, objectFit: "cover", borderRadius: "3mm" }} />
                ) : (
                  <div style={{ flex: 1, minHeight: 0, background: "#F6F6F3", borderRadius: "3mm" }} />
                )}
                <p style={{ fontSize: mm(3), color: "#46464B", margin: 0, flexShrink: 0 }}>The chosen exterior concept. Materials and colour are indicative.</p>
              </div>
              <FitColumn width={lay.sidebar + 24}>
                <div>
                  <p style={{ fontSize: mm(6.4), fontWeight: 600, letterSpacing: "-0.02em", margin: 0, lineHeight: 1.1 }}>{project.name}</p>
                  <p style={{ fontSize: mm(3.2), color: "#46464B", margin: "1.5mm 0 0" }}>
                    {[project.brief?.plot?.area_marla ? plotLabel(project.brief.plot.area_marla) : null, location(project, plan)].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <SitePlan plan={plan} widthMm={lay.sidebar + 24} heightMm={paper.h * (options.paper === "a4" ? 0.26 : 0.3)} />
                <AreaSchedule plan={plan} report={version.compliance} />
                <div style={{ marginTop: "auto" }}>{block("Cover and area schedule", "A-000")}</div>
              </FitColumn>
            </div>
          </section>
        )}

        {levels.map((l, i) => (
          <FloorSheet key={l.id} plan={plan} level={l} scale={scale} project={project} sidebar={lay.sidebar}>
            {block(`${levelName(l)} plan`, `A-${101 + i}`, true)}
          </FloorSheet>
        ))}

        {options.compliance && (
          <ComplianceSheets
            project={project}
            version={version}
            paper={options.paper}
            onPages={setCompliancePages}
            block={(n) => block(n === 0 ? "Compliance report" : `Compliance report, continued`, `A-${900 + n}`)}
          />
        )}
      </div>
    </Fs.Provider>
  );
}

/**
 * A side column that always fits its sheet: when its contents are taller than the space (a plan with many rooms on
 * A4), it zooms them down until they fit, so the title block never crosses the margin.
 */
function FitColumn({ width, children }: { width: number; children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    // Visual heights (both inside any preview zoom), so the ratio is the real overflow.
    const oh = o.getBoundingClientRect().height;
    const ih = i.getBoundingClientRect().height;
    if (!oh || !ih || ih <= oh + 0.5) return;
    const next = Math.max(0.5, ((zoom * oh) / ih) * 0.995);
    if (Math.abs(next - zoom) > 0.004) setZoom(next);
  });
  return (
    <div ref={outer} style={{ width: `${width}mm`, flexShrink: 0, minHeight: 0, height: "100%", overflow: "hidden" }}>
      <div ref={inner} style={{ zoom, display: "flex", flexDirection: "column", gap: "4mm", minHeight: zoom < 1 ? undefined : "100%", width: zoom < 1 ? `${100 / zoom}%` : "100%" }}>
        {children}
      </div>
    </div>
  );
}

function Header({ project, title }: { project: Project; title: string }) {
  const mm = useMm();
  return (
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", height: `${HEADER_MM - 4}mm`, marginBottom: "4mm", borderBottom: "0.3mm solid #111113", flexShrink: 0 }}>
      <span style={{ fontSize: mm(4), fontWeight: 600, letterSpacing: "-0.01em" }}>
        Naqsha <span style={{ fontFamily: "'Noto Nastaliq Urdu', serif", fontWeight: 500, opacity: 0.7, marginLeft: "1.5mm" }}>نقشہ</span>
      </span>
      <span style={{ fontSize: mm(3.2), color: "#46464B" }}>
        {project.name} · {title}
      </span>
    </header>
  );
}

type ScheduleRow = { id: string; name: string; size: string; area: number; key?: number };

function FloorSheet({ plan, level, scale, project, sidebar, children }: { plan: BuildingPlan; level: Level; scale: number; project: Project; sidebar: number; children: ReactNode }) {
  const mm = useMm();
  const B = sheetBounds(plan);
  const mmPerFt = 304.8 / scale;
  const wMm = B.w * mmPerFt;
  const hMm = B.h * mmPerFt;
  const ppf = mmPerFt * PX_PER_MM;
  const roof = isRoofLevel(plan, level);
  const labels = useMemo(() => {
    const isGround = level.index === 0;
    const site = isGround ? plan.rooms.filter((r) => r.level === level.id && SITE_TYPES.has(r.type)) : [];
    return layoutLabels([...site, ...plan.rooms.filter((r) => r.level === level.id && !SITE_TYPES.has(r.type))], ppf, { site: new Set(site.map((r) => r.id)) });
  }, [plan, level, ppf]);
  const keys = labels.filter((l) => l.kind === "key");
  const rows: ScheduleRow[] = roomsOn(plan, level.id)
    .sort((a, b) => area(b) - area(a))
    .map((r) => {
      const key = keys.find((k) => k.room.id === r.id);
      return { id: r.id, name: sentenceCase(r.name), size: `${feetInches(r.rect.w)} × ${feetInches(r.rect.d)}`, area: area(r), key: key && key.kind === "key" ? key.n : undefined };
    });
  // The roof: what stands on it (the stair tower is its covered area), the tank and the solar area.
  if (roof) {
    const m = plan.roof.mumty;
    const t = plan.roof.water_tank;
    const s = plan.roof.solar;
    if (m) rows.unshift({ id: "mumty", name: `Stair tower (mumty), ${feetInches(m.height_ft)} high`, size: `${feetInches(m.rect.w)} × ${feetInches(m.rect.d)}`, area: m.rect.w * m.rect.d });
    if (t) rows.push({ id: "tank", name: t.material === "plastic" ? "Water tank, plastic" : t.material === "concrete" ? "Water tank, concrete" : "Water tank", size: `${feetInches(t.rect.w)} × ${feetInches(t.rect.d)}`, area: t.rect.w * t.rect.d });
    if (s?.rect) rows.push({ id: "solar", name: s.mode === "panels" ? "Solar panels" : "Kept clear for solar", size: `${feetInches(s.rect.w)} × ${feetInches(s.rect.d)}`, area: s.rect.w * s.rect.d });
  }
  const covered = roof && plan.roof.mumty ? plan.roof.mumty.rect.w * plan.roof.mumty.rect.d : coveredArea(plan, level.id);
  return (
    <section className="page">
      <Header project={project} title={`${levelName(level)} plan`} />
      <div style={{ display: "flex", gap: `${GAP_MM}mm`, flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minWidth: 0 }}>
          <svg width={`${wMm}mm`} height={`${hMm}mm`} viewBox={`${B.x} ${B.y} ${B.w} ${B.h}`} style={{ display: "block" }}>
            <PlanDefs ppf={ppf} />
            <PlanSheet plan={plan} levelId={level.id} ppf={ppf} print labels={labels} />
            <PrintScaleBar plan={plan} />
          </svg>
        </div>
        <FitColumn width={sidebar}>
          <div>
            <p style={{ fontSize: mm(5), fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>{levelName(level)}</p>
            <p className="mono" style={{ fontSize: mm(2.9), color: "#46464B", margin: "1mm 0 0" }}>
              {num(covered)} sq ft covered{roof ? " (stair tower)" : ""} · scale 1:{scale}
            </p>
          </div>
          <table style={{ fontSize: mm(2.8) }}>
            <thead>
              <tr>
                <th>{roof ? "On the roof" : "Room"}</th>
                <th style={{ textAlign: "right" }}>Size</th>
                <th style={{ textAlign: "right" }}>sq ft</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.key ? <span style={{ display: "inline-block", width: mm(3.6), height: mm(3.6), lineHeight: mm(3.6), textAlign: "center", border: "0.2mm solid #46464B", borderRadius: "50%", fontSize: mm(2.2), marginRight: "1.2mm" }}>{r.key}</span> : null}
                    {r.name}
                  </td>
                  <td className="mono" style={{ textAlign: "right", whiteSpace: "nowrap", paddingLeft: "2mm" }}>{r.size}</td>
                  <td className="mono" style={{ textAlign: "right", paddingLeft: "2mm" }}>{num(r.area)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: mm(2.6), color: "#6E6E73", display: "flex", alignItems: "center", gap: "2mm" }}>
            <span style={{ width: "6mm", borderTop: "0.3mm dashed #2747F5" }} /> Setback (building line)
          </div>
          <div style={{ marginTop: "auto" }}>{children}</div>
        </FitColumn>
      </div>
    </section>
  );
}

/** A scale bar under the drawing, in plan feet (so it is true to scale). */
function PrintScaleBar({ plan }: { plan: BuildingPlan }) {
  const D = plan.site.plot.depth_ft;
  const x = -7;
  const y = D + 9.6;
  const segs = [0, 5, 10, 20];
  const h = 0.55;
  return (
    <g transform={`translate(${x} ${y})`}>
      {segs.slice(0, -1).map((s, i) => (
        <rect key={s} x={s} y={0} width={segs[i + 1] - s} height={h} fill={i % 2 ? "#fff" : "#111113"} stroke="#111113" strokeWidth={0.08} />
      ))}
      {segs.map((s) => (
        <text key={s} x={s} y={h + 1.6} textAnchor="middle" fontSize={1.1} fill="#46464B" style={{ fontFamily: "'Geist Mono', monospace" }}>
          {s}
        </text>
      ))}
      <text x={21.2} y={h + 1.6} fontSize={1.1} fill="#46464B" style={{ fontFamily: "'Geist Mono', monospace" }}>
        ft
      </text>
    </g>
  );
}

function SitePlan({ plan, widthMm, heightMm }: { plan: BuildingPlan; widthMm: number; heightMm: number }) {
  const mm = useMm();
  const B = sheetBounds(plan);
  const ground = levelsOf(plan).find((l) => l.index === 0) ?? levelsOf(plan)[0];
  const k = Math.min(widthMm / B.w, heightMm / B.h);
  const ppf = k * PX_PER_MM;
  const labels = useMemo(() => layoutLabels([], ppf), [ppf]);
  return (
    <div>
      <p style={{ fontSize: mm(2.9), fontWeight: 500, margin: "0 0 1.5mm" }}>Site plan</p>
      <svg width={`${B.w * k}mm`} height={`${B.h * k}mm`} viewBox={`${B.x} ${B.y} ${B.w} ${B.h}`}>
        <PlanDefs ppf={ppf} />
        <PlanSheet plan={plan} levelId={ground.id} ppf={ppf} print labels={labels} />
      </svg>
    </div>
  );
}

function AreaSchedule({ plan, report }: { plan: BuildingPlan; report: Version["compliance"] }) {
  const mm = useMm();
  const lv = levelsOf(plan).filter((l) => l.index >= 0);
  const rows = lv.map((l) => ({ l, a: isRoofLevel(plan, l) ? (plan.roof.mumty ? plan.roof.mumty.rect.w * plan.roof.mumty.rect.d : 0) : coveredArea(plan, l.id) })).filter((r) => r.a > 0);
  const total = rows.reduce((s, r) => s + r.a, 0);
  const m = report.metrics;
  return (
    <table style={{ fontSize: mm(2.9) }}>
      <thead>
        <tr>
          <th>Area schedule</th>
          <th style={{ textAlign: "right" }}>sq ft</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ l, a }) => (
          <tr key={l.id}>
            <td>{isRoofLevel(plan, l) ? "Roof (stair tower)" : levelName(l)}</td>
            <td className="mono" style={{ textAlign: "right" }}>{num(a)}</td>
          </tr>
        ))}
        <tr>
          <td style={{ fontWeight: 600 }}>Total covered</td>
          <td className="mono" style={{ textAlign: "right", fontWeight: 600 }}>{num(total)}</td>
        </tr>
        <tr>
          <td>Plot</td>
          <td className="mono" style={{ textAlign: "right" }}>{num(m.plot_area_sqft)}</td>
        </tr>
        <tr>
          <td>Ground coverage</td>
          <td className="mono" style={{ textAlign: "right" }}>{num(m.coverage_pct, 1)}%</td>
        </tr>
        <tr>
          <td>Floor area ratio</td>
          <td className="mono" style={{ textAlign: "right" }}>1:{num(m.far, 2)}</td>
        </tr>
        <tr>
          <td>Height to parapet</td>
          <td className="mono" style={{ textAlign: "right" }}>{feetInches(m.height_ft)}</td>
        </tr>
      </tbody>
    </table>
  );
}

// ── Compliance, paginated ───────────────────────────────────────────────────────────────────────────

type Item = { key: string; kind: "group"; title: string } | { key: string; kind: "row"; c: ComplianceCheck };

/**
 * The compliance report across as many sheets as it needs. Every row is measured once (off to the side, at the
 * column width), then packed into columns of the page's height, so no row is ever cut and the title block keeps its
 * own column.
 */
function ComplianceSheets({ project, version, paper, onPages, block }: { project: Project; version: Version; paper: Paper; onPages: (n: number) => void; block: (n: number) => ReactNode }) {
  const mm = useMm();
  const lay = LAYOUT[paper];
  const p = PAPER[paper];
  const s = useMemo(() => summarize(version.compliance, version.plan), [version]);
  const items: Item[] = useMemo(() => {
    const out: Item[] = [];
    const groups = [
      { title: `LDA rules · ${tallyLine(s.ldaTally)}`, list: s.lda },
      { title: `Livable home · ${tallyLine(s.livableTally)}`, list: s.livable },
    ].filter((g) => g.list.length);
    for (const g of groups) {
      out.push({ key: `g-${g.title}`, kind: "group", title: g.title });
      for (const c of g.list) out.push({ key: c.id, kind: "row", c });
    }
    return out;
  }, [s]);
  const colGap = 6;
  const contentW = p.w - 2 * MARGIN_MM - lay.sidebar - GAP_MM;
  const colW = (contentW - (lay.columns - 1) * colGap) / lay.columns;
  const colH = p.h - 2 * MARGIN_MM - HEADER_MM;

  // Measure every item at the column width, then pack.
  const measure = useRef<HTMLDivElement>(null);
  const [pagesOf, setPagesOf] = useState<Item[][][] | null>(null);
  useLayoutEffect(() => {
    const box = measure.current;
    if (!box) return;
    const unit = box.querySelector<HTMLElement>("[data-unit]");
    const pxPerMm = unit ? unit.offsetHeight / 100 : PX_PER_MM;
    const heights = new Map<string, number>();
    for (const el of box.querySelectorAll<HTMLElement>("[data-item]")) heights.set(el.dataset.item!, el.offsetHeight / pxPerMm);
    const pages: Item[][][] = [];
    let cols: Item[][] = [[]];
    let used = 0;
    const limit = colH - 1;
    items.forEach((it, i) => {
      const h = heights.get(it.key) ?? 6;
      // A group title never ends a column: it moves with its first row.
      const next = items[i + 1];
      const need = it.kind === "group" && next ? h + (heights.get(next.key) ?? 6) : h;
      if (used + need > limit && cols[cols.length - 1].length) {
        if (cols.length === lay.columns) {
          pages.push(cols);
          cols = [[]];
        } else cols.push([]);
        used = 0;
      }
      cols[cols.length - 1].push(it);
      used += h;
    });
    pages.push(cols);
    const sig = JSON.stringify(pages.map((pg) => pg.map((c) => c.map((x) => x.key))));
    setPagesOf((prev) => (prev && JSON.stringify(prev.map((pg) => pg.map((c) => c.map((x) => x.key)))) === sig ? prev : pages));
  }, [items, colH, lay.columns, colW]);
  useLayoutEffect(() => {
    onPages(pagesOf?.length ?? 1);
  }, [pagesOf, onPages]);

  const verdict = s.fails.length
    ? `${s.fails.length} ${s.fails.length === 1 ? "rule" : "rules"} to fix`
    : s.approvalReady && !s.livableIssues
      ? `Passes all ${s.lda.length} LDA checks and ${s.livable.length} livable rules`
      : s.approvalReady
        ? `Passes all ${s.lda.length} LDA checks; ${s.livableIssues} livable ${s.livableIssues === 1 ? "point" : "points"} to check`
        : `${s.ldaTally.pass} of ${s.ldaTally.total} LDA checks pass; ${s.warns.length} to check`;

  return (
    <>
      {/* Measuring stand: same width and type as a column, never printed. */}
      <div ref={measure} aria-hidden style={{ position: "absolute", left: "-10000px", top: 0, width: `${colW}mm`, visibility: "hidden", fontSize: mm(2.6) }} className="nq-measure">
        <div data-unit style={{ height: "100mm" }} />
        {items.map((it) => (
          <div key={it.key} data-item={it.key}>
            <ItemView it={it} />
          </div>
        ))}
      </div>
      {(pagesOf ?? [[items]]).map((cols, n) => (
        <section className="page" key={n}>
          <Header project={project} title={n === 0 ? "Compliance report" : `Compliance report, continued (${n + 1})`} />
          <div style={{ display: "flex", gap: `${GAP_MM}mm`, flex: 1, minHeight: 0 }}>
            <div style={{ flex: 1, display: "flex", gap: `${colGap}mm`, minWidth: 0, fontSize: mm(2.6) }}>
              {Array.from({ length: lay.columns }, (_, k) => (
                <div key={k} style={{ width: `${colW}mm`, flexShrink: 0, overflow: "hidden" }}>
                  {(cols[k] ?? []).map((it) => (
                    <ItemView key={it.key} it={it} />
                  ))}
                </div>
              ))}
            </div>
            <FitColumn width={lay.sidebar}>
              {n === 0 ? (
                <div>
                  <p style={{ fontSize: mm(4.2), fontWeight: 600, margin: "0 0 2mm", lineHeight: 1.2 }}>{verdict}</p>
                  <p style={{ color: "#46464B", margin: 0, fontSize: mm(2.8) }}>
                    {version.compliance.authority} Building and Zoning Regulations · {version.compliance.band} · {plotLine(version)}
                  </p>
                  <Legend />
                </div>
              ) : (
                <Legend />
              )}
              <div style={{ marginTop: "auto" }}>{block(n)}</div>
            </FitColumn>
          </div>
        </section>
      ))}
    </>
  );
}

function Legend() {
  const mm = useMm();
  return (
    <div style={{ marginTop: "3mm", display: "flex", gap: "3mm", flexWrap: "wrap", fontSize: mm(2.5), color: "#46464B" }}>
      <Mark status="pass" /> Pass
      <Mark status="warn" /> Check
      <Mark status="fail" /> Fix
    </div>
  );
}

function Mark({ status }: { status: ComplianceCheck["status"] }) {
  return <span style={{ width: "2mm", height: "2mm", borderRadius: "50%", marginTop: "0.7mm", flexShrink: 0, display: "inline-block", background: status === "pass" ? "#0E7A55" : status === "warn" ? "#A35A00" : "#C8281E" }} />;
}

function ItemView({ it }: { it: Item }) {
  const mm = useMm();
  if (it.kind === "group") return <p style={{ fontWeight: 600, fontSize: mm(3.1), margin: "2.5mm 0 1.2mm" }}>{it.title}</p>;
  const c = it.c;
  const v = valueLine(c);
  // Each rule's words print once: the value (or, without one, the message), then the message only when it adds
  // something (a problem, or a livable rule's reason).
  const extra = v && (c.status !== "pass" || categoryOf(c) === "livable") ? c.message : null;
  return (
    <div style={{ display: "flex", gap: "2mm", padding: "0.9mm 0", borderBottom: "0.2mm solid #E4E4DF", breakInside: "avoid" }}>
      <Mark status={c.status} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "flex", justifyContent: "space-between", gap: "2mm" }}>
          <span>{c.title}</span>
          {c.status !== "pass" && (
            <span style={{ flexShrink: 0, fontWeight: 600, color: c.status === "warn" ? "#A35A00" : "#C8281E" }}>{c.status === "warn" ? "Check" : "Fix"}</span>
          )}
        </span>
        <span className={v ? "mono" : undefined} style={{ display: "block", color: "#46464B" }}>{v ?? c.message}</span>
        {extra && <span style={{ display: "block", color: "#6E6E73" }}>{extra}</span>}
      </span>
    </div>
  );
}

function plotLine(v: Version) {
  const p = v.plan.site;
  return `${feetInches(p.plot.width_ft)} × ${feetInches(p.plot.depth_ft)} plot, front faces ${(FACING_LABEL[p.facing] ?? p.facing).toLowerCase()}`;
}

function TitleBlock({ project, version, date, title, sheet, scale, page, pages }: { project: Project; version: Version; date: string; title: string; sheet: string; scale?: string; page: number; pages: number }) {
  const mm = useMm();
  const b = project.brief;
  const cell = (k: string, v: ReactNode, mono = false) => (
    <div style={{ padding: `${mm(1.2)} 2mm`, borderTop: "0.2mm solid #CFCFC8" }}>
      <div style={{ fontSize: mm(2.2), color: "#6E6E73" }}>{k}</div>
      <div className={mono ? "mono" : undefined} style={{ fontSize: mm(2.8), marginTop: "0.3mm" }}>
        {v}
      </div>
    </div>
  );
  const dims = `${feetInches(version.plan.site.plot.width_ft)} × ${feetInches(version.plan.site.plot.depth_ft)}`;
  return (
    <div style={{ border: "0.35mm solid #111113", borderRadius: "1.5mm", overflow: "hidden" }}>
      <div style={{ padding: "2mm", background: "#111113", color: "#fff" }}>
        <div style={{ fontSize: mm(3.4), fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: mm(2.5), opacity: 0.75 }}>{project.name}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
        {cell("Plot", b?.plot?.area_marla ? `${plotLabel(b.plot.area_marla)} · ${dims}` : dims)}
        {cell("Location", location(project, version.plan))}
        {cell("Version", `Version ${version.n} · ${date}`)}
        {cell("Prepared by", "Naqsha, for the owner")}
        {cell("Sheet", `${sheet} · ${page} of ${pages}`, true)}
        {cell("Scale", scale ?? "Not to scale", true)}
      </div>
      <div style={{ padding: `${mm(1.2)} 2mm`, borderTop: "0.2mm solid #CFCFC8", fontSize: mm(2.1), color: "#6E6E73" }}>
        Design drawing for discussion and approval. Confirm all dimensions on site.
      </div>
    </div>
  );
}
