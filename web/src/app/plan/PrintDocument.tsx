/**
 * Print / Save as PDF (DESIGN.md "Plan → Print"): landscape sheets at a true architectural scale.
 * - Cover: the chosen concept, a site plan, the area schedule and the title block.
 * - One sheet per floor at the largest standard scale that fits (1:100 on A3 for most plots), with the scale bar,
 *   north arrow, room schedule and title block.
 * - The compliance report: LDA rules and Livable home.
 * All vector SVG sized in millimetres; window.print() turns it into a PDF.
 */
import { useMemo } from "react";
import type { Project, Version } from "@contracts/api-types";
import type { BuildingPlan, Level } from "@contracts/plan";
import { assetUrl } from "@/api/client";
import { FACING_LABEL, plotLabel } from "@/api/domain";
import { feetInches, num } from "@/app/lib/utils";
import { PlanDefs, PlanSheet, sheetBounds } from "./FloorPlan";
import { layoutLabels } from "./labels";
import { area, coveredArea, levelName, levelsOf, roomsOn, SITE_TYPES, sentenceCase } from "./model";
import { categoryOf, summarize, valueLine } from "./compliance";

export type Paper = "a3" | "a4";
export const PAPER: Record<Paper, { w: number; h: number; label: string }> = {
  a3: { w: 420, h: 297, label: "A3" },
  a4: { w: 297, h: 210, label: "A4" },
};
const MARGIN_MM = 10;
const SIDEBAR_MM = 96;
const HEADER_MM = 10;
const SCALES = [50, 75, 100, 125, 150, 200, 250, 300, 400];
const PX_PER_MM = 96 / 25.4;

export interface PrintOptions { paper: Paper; levels: string[]; cover: boolean; compliance: boolean }

/** Largest standard scale (smallest S in 1:S) at which the floor drawing fits the drawing area. */
export function pickScale(plan: BuildingPlan, paper: Paper): number {
  const B = sheetBounds(plan);
  const p = PAPER[paper];
  const areaW = p.w - 2 * MARGIN_MM - SIDEBAR_MM - 8;
  const areaH = p.h - 2 * MARGIN_MM - HEADER_MM;
  for (const s of SCALES) {
    const mmPerFt = 304.8 / s;
    if (B.w * mmPerFt <= areaW && B.h * mmPerFt <= areaH) return s;
  }
  return SCALES[SCALES.length - 1];
}

export function PrintDocument({ project, version, options, conceptUrl }: { project: Project; version: Version; options: PrintOptions; conceptUrl?: string }) {
  const plan = version.plan;
  const paper = PAPER[options.paper];
  const scale = useMemo(() => pickScale(plan, options.paper), [plan, options.paper]);
  const levels = levelsOf(plan).filter((l) => options.levels.includes(l.id));
  const date = new Date(version.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const total = options.cover ? 1 : 0;
  const pages = total + levels.length + (options.compliance ? 1 : 0);
  let page = 0;
  const block = (title: string, sheetNo: string) => (
    <TitleBlock project={project} version={version} date={date} title={title} sheet={sheetNo} scale={title.includes("plan") && !title.startsWith("Site") ? `1:${scale} at ${paper.label}` : undefined} page={++page} pages={pages} />
  );
  return (
    <div className="nq-print">
      <style>{`
        .nq-print { font-family: Geist, ui-sans-serif, system-ui, sans-serif; color: #111113; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .nq-print .page { width: ${paper.w}mm; height: ${paper.h}mm; padding: ${MARGIN_MM}mm; box-sizing: border-box; background: #fff; position: relative; overflow: hidden; break-after: page; page-break-after: always; display: flex; flex-direction: column; }
        .nq-print .page:last-child { break-after: auto; page-break-after: auto; }
        .nq-print .mono { font-family: 'Geist Mono', ui-monospace, monospace; font-variant-numeric: tabular-nums; }
        .nq-print table { border-collapse: collapse; width: 100%; }
        .nq-print td, .nq-print th { padding: 1.2mm 0; border-bottom: 0.2mm solid #E4E4DF; text-align: left; font-weight: 400; vertical-align: top; }
        .nq-print th { color: #6E6E73; font-size: 2.6mm; font-weight: 500; }
      `}</style>

      {options.cover && (
        <section className="page">
          <Header project={project} title="Cover" />
          <div style={{ display: "flex", gap: "8mm", flex: 1, minHeight: 0 }}>
            <div style={{ flex: 1.45, display: "flex", flexDirection: "column", gap: "4mm", minWidth: 0 }}>
              {conceptUrl ? (
                <img src={assetUrl(conceptUrl)} alt="" style={{ width: "100%", flex: 1, minHeight: 0, objectFit: "cover", borderRadius: "3mm" }} />
              ) : (
                <div style={{ flex: 1, background: "#F6F6F3", borderRadius: "3mm" }} />
              )}
              <p style={{ fontSize: "3.2mm", color: "#46464B", margin: 0 }}>The chosen exterior concept. Materials and colour are indicative.</p>
            </div>
            <div style={{ width: `${SIDEBAR_MM + 30}mm`, display: "flex", flexDirection: "column", gap: "5mm" }}>
              <div>
                <p style={{ fontSize: "7mm", fontWeight: 600, letterSpacing: "-0.02em", margin: 0, lineHeight: 1.1 }}>{project.name}</p>
                <p style={{ fontSize: "3.4mm", color: "#46464B", margin: "1.5mm 0 0" }}>
                  {[project.brief?.plot?.area_marla ? plotLabel(project.brief.plot.area_marla) : null, plan.site.scheme, plan.site.city].filter(Boolean).join(" · ")}
                </p>
              </div>
              <SitePlan plan={plan} widthMm={SIDEBAR_MM + 30} heightMm={paper.h * 0.33} />
              <AreaSchedule plan={plan} report={version.compliance} />
              <div style={{ marginTop: "auto" }}>{block("Cover and area schedule", "A-000")}</div>
            </div>
          </div>
        </section>
      )}

      {levels.map((l, i) => (
        <FloorSheet key={l.id} plan={plan} level={l} scale={scale} paper={options.paper} project={project} sheetNo={`A-${101 + i}`}>
          {block(`${levelName(l)} plan`, `A-${101 + i}`)}
        </FloorSheet>
      ))}

      {options.compliance && (
        <section className="page">
          <Header project={project} title="Compliance report" />
          <ComplianceSheet project={project} version={version} />
          <div style={{ position: "absolute", right: `${MARGIN_MM}mm`, bottom: `${MARGIN_MM}mm`, width: `${SIDEBAR_MM}mm` }}>{block("Compliance report", "A-900")}</div>
        </section>
      )}
    </div>
  );
}

function Header({ project, title }: { project: Project; title: string }) {
  return (
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", height: `${HEADER_MM - 4}mm`, marginBottom: "4mm", borderBottom: "0.3mm solid #111113" }}>
      <span style={{ fontSize: "4mm", fontWeight: 600, letterSpacing: "-0.01em" }}>
        Naqsha <span style={{ fontFamily: "'Noto Nastaliq Urdu', serif", fontWeight: 500, opacity: 0.7, marginLeft: "1.5mm" }}>نقشہ</span>
      </span>
      <span style={{ fontSize: "3.2mm", color: "#46464B" }}>
        {project.name} · {title}
      </span>
    </header>
  );
}

function FloorSheet({ plan, level, scale, paper, project, sheetNo, children }: { plan: BuildingPlan; level: Level; scale: number; paper: Paper; project: Project; sheetNo: string; children: React.ReactNode }) {
  const B = sheetBounds(plan);
  const mmPerFt = 304.8 / scale;
  const wMm = B.w * mmPerFt;
  const hMm = B.h * mmPerFt;
  const ppf = mmPerFt * PX_PER_MM;
  const rooms = roomsOn(plan, level.id).filter((r) => r.type !== "stair" || area(r) > 30);
  const labels = useMemo(() => {
    const isGround = level.index === 0;
    const site = isGround ? plan.rooms.filter((r) => r.level === level.id && SITE_TYPES.has(r.type)) : [];
    return layoutLabels([...site, ...plan.rooms.filter((r) => r.level === level.id && !SITE_TYPES.has(r.type) && r.type !== "stair")], ppf, { site: new Set(site.map((r) => r.id)) });
  }, [plan, level, ppf]);
  const keys = labels.filter((l) => l.kind === "key");
  const covered = coveredArea(plan, level.id);
  void project;
  void sheetNo;
  return (
    <section className="page">
      <Header project={project} title={`${levelName(level)} plan`} />
      <div style={{ display: "flex", gap: "8mm", flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minWidth: 0 }}>
          <svg width={`${wMm}mm`} height={`${hMm}mm`} viewBox={`${B.x} ${B.y} ${B.w} ${B.h}`} style={{ display: "block" }}>
            <PlanDefs ppf={ppf} />
            <PlanSheet plan={plan} levelId={level.id} ppf={ppf} print labels={labels} />
            <PrintScaleBar plan={plan} />
          </svg>
        </div>
        <div style={{ width: `${SIDEBAR_MM}mm`, display: "flex", flexDirection: "column", gap: "4mm", minHeight: 0 }}>
          <div>
            <p style={{ fontSize: "5mm", fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>{levelName(level)}</p>
            <p className="mono" style={{ fontSize: "3mm", color: "#46464B", margin: "1mm 0 0" }}>
              {num(covered)} sq ft covered · scale 1:{scale}
            </p>
          </div>
          <table style={{ fontSize: "2.9mm" }}>
            <thead>
              <tr>
                <th>Room</th>
                <th style={{ textAlign: "right" }}>Size</th>
                <th style={{ textAlign: "right" }}>Area</th>
              </tr>
            </thead>
            <tbody>
              {rooms
                .sort((a, b) => area(b) - area(a))
                .map((r) => {
                  const key = keys.find((k) => k.room.id === r.id);
                  return (
                    <tr key={r.id}>
                      <td>
                        {key && key.kind === "key" ? <span style={{ display: "inline-block", width: "3.6mm", height: "3.6mm", lineHeight: "3.6mm", textAlign: "center", border: "0.2mm solid #46464B", borderRadius: "50%", fontSize: "2.2mm", marginRight: "1.2mm" }}>{key.n}</span> : null}
                        {sentenceCase(r.name)}
                      </td>
                      <td className="mono" style={{ textAlign: "right" }}>{feetInches(r.rect.w)} × {feetInches(r.rect.d)}</td>
                      <td className="mono" style={{ textAlign: "right" }}>{num(area(r))}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          <div style={{ fontSize: "2.7mm", color: "#6E6E73", display: "flex", alignItems: "center", gap: "2mm" }}>
            <span style={{ width: "6mm", borderTop: "0.3mm dashed #2747F5" }} /> Setback (building line)
          </div>
          <div style={{ marginTop: "auto" }}>{children}</div>
        </div>
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
  const B = sheetBounds(plan);
  const ground = levelsOf(plan).find((l) => l.index === 0) ?? levelsOf(plan)[0];
  const k = Math.min(widthMm / B.w, heightMm / B.h);
  const ppf = k * PX_PER_MM;
  const labels = useMemo(() => layoutLabels([], ppf), [ppf]);
  return (
    <div>
      <p style={{ fontSize: "3mm", fontWeight: 500, margin: "0 0 1.5mm" }}>Site plan</p>
      <svg width={`${B.w * k}mm`} height={`${B.h * k}mm`} viewBox={`${B.x} ${B.y} ${B.w} ${B.h}`}>
        <PlanDefs ppf={ppf} />
        <PlanSheet plan={plan} levelId={ground.id} ppf={ppf} print labels={labels} />
      </svg>
    </div>
  );
}

function AreaSchedule({ plan, report }: { plan: BuildingPlan; report: Version["compliance"] }) {
  const lv = levelsOf(plan).filter((l) => l.index >= 0);
  const rows = lv.map((l) => ({ l, a: coveredArea(plan, l.id) })).filter((r) => r.a > 0);
  const total = rows.reduce((s, r) => s + r.a, 0);
  const m = report.metrics;
  return (
    <table style={{ fontSize: "3mm" }}>
      <thead>
        <tr>
          <th>Area schedule</th>
          <th style={{ textAlign: "right" }}>sq ft</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ l, a }) => (
          <tr key={l.id}>
            <td>{levelName(l)}</td>
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

function ComplianceSheet({ project, version }: { project: Project; version: Version }) {
  const s = summarize(version.compliance, version.plan);
  const groups = [
    { title: `LDA rules · ${s.ldaPass} of ${s.lda.length} pass`, list: s.lda },
    { title: `Livable home · ${s.livablePass} of ${s.livable.length} pass`, list: s.livable },
  ].filter((g) => g.list.length);
  void project;
  return (
    <div style={{ columnCount: 2, columnGap: "10mm", fontSize: "2.8mm", paddingRight: `${SIDEBAR_MM + 8}mm` }}>
      <p style={{ fontSize: "4.4mm", fontWeight: 600, margin: "0 0 3mm" }}>
        {s.fails.length ? `${s.fails.length} rules to fix` : `Passes all ${s.lda.length} LDA checks and ${s.livable.length} livable rules`}
      </p>
      <p style={{ color: "#46464B", margin: "0 0 4mm" }}>
        {version.compliance.authority} Building and Zoning Regulations · {version.compliance.band} · {plan2(version)}
      </p>
      {groups.map((g) => (
        <div key={g.title} style={{ breakInside: "avoid-column" }}>
          <p style={{ fontWeight: 600, fontSize: "3.2mm", margin: "3mm 0 1.5mm" }}>{g.title}</p>
          {g.list.map((c) => (
            <div key={c.id} style={{ display: "flex", gap: "2mm", padding: "1mm 0", borderBottom: "0.2mm solid #E4E4DF", breakInside: "avoid" }}>
              <span style={{ width: "2mm", height: "2mm", borderRadius: "50%", marginTop: "0.8mm", flexShrink: 0, background: c.status === "pass" ? "#0E7A55" : c.status === "warn" ? "#A35A00" : "#C8281E" }} />
              <span style={{ flex: 1 }}>
                <span style={{ display: "block" }}>{c.title}</span>
                <span className="mono" style={{ display: "block", color: "#46464B" }}>{valueLine(c) ?? c.message}</span>
                {categoryOf(c) === "livable" && <span style={{ display: "block", color: "#6E6E73" }}>{c.message}</span>}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function plan2(v: Version) {
  const p = v.plan.site;
  return `${feetInches(p.plot.width_ft)} × ${feetInches(p.plot.depth_ft)} plot, front faces ${(FACING_LABEL[p.facing] ?? p.facing).toLowerCase()}`;
}

function TitleBlock({ project, version, date, title, sheet, scale, page, pages }: { project: Project; version: Version; date: string; title: string; sheet: string; scale?: string; page: number; pages: number }) {
  const b = project.brief;
  const cell = (k: string, v: React.ReactNode, mono = false) => (
    <div style={{ padding: "1.4mm 2mm", borderTop: "0.2mm solid #CFCFC8" }}>
      <div style={{ fontSize: "2.3mm", color: "#6E6E73" }}>{k}</div>
      <div className={mono ? "mono" : undefined} style={{ fontSize: "3mm", marginTop: "0.3mm" }}>
        {v}
      </div>
    </div>
  );
  return (
    <div style={{ border: "0.35mm solid #111113", borderRadius: "1.5mm", overflow: "hidden" }}>
      <div style={{ padding: "2mm", background: "#111113", color: "#fff" }}>
        <div style={{ fontSize: "3.6mm", fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: "2.6mm", opacity: 0.75 }}>{project.name}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
        {cell("Plot", b?.plot?.area_marla ? `${plotLabel(b.plot.area_marla)} · ${feetInches(version.plan.site.plot.width_ft)} × ${feetInches(version.plan.site.plot.depth_ft)}` : `${feetInches(version.plan.site.plot.width_ft)} × ${feetInches(version.plan.site.plot.depth_ft)}`)}
        {cell("Location", [version.plan.site.scheme, version.plan.site.city].filter(Boolean).join(", ") || "Lahore")}
        {cell("Version", `Version ${version.n} · ${date}`)}
        {cell("Prepared by", "Naqsha, for the owner")}
        {cell("Sheet", `${sheet} · ${page} of ${pages}`, true)}
        {cell("Scale", scale ?? "Not to scale", true)}
      </div>
      <div style={{ padding: "1.4mm 2mm", borderTop: "0.2mm solid #CFCFC8", fontSize: "2.2mm", color: "#6E6E73" }}>
        Design drawing for discussion and approval. Confirm all dimensions on site.
      </div>
    </div>
  );
}
