/**
 * Sample projects so a fresh mock workspace looks lived-in, with stable ids for deep links:
 * - p_demo_johar: ready to walk (the real Argon v1 run: 42/42 LDA checks, 23 sections; its fix loop went 5 → 1 → 0)
 * - p_demo_lake: choosing between four concepts
 * - p_demo_wapda: mid-setup on a corner 1-kanal plot, at the rooms question
 */
import type { Brief, Change, ChatMessage, Comment, Concept, Project, Version } from "@contracts/api-types";
import { db, save, uid } from "./db";
import { ARGON_SECTIONS, CONCEPT_IMAGES, clonePlan, revisedSection } from "./fixtures";
import { demoSetupState } from "./intake";
import { ARGON_REPORT, envelopeFor, recheck } from "./lda";
import { PORCH_REJECTION, deepenBedroom2 } from "./scripts";

const SEED_KEY = "naqsha.mock.seeded";
export const FIX_LOOP_KEY = (vid: string) => `naqsha.fixloop.${vid}`;

function ago(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function brief(partial: Partial<Brief>): Brief {
  return {
    city: "Lahore",
    authority: "LDA",
    scheme: "Johar Town",
    plot: { width_ft: 35, depth_ft: 65, area_marla: 10.1, corner: false },
    facing: "N",
    storeys: 2,
    basement: false,
    bedrooms: 4,
    bathrooms: 5,
    spaces: ["drawing", "tv_lounge", "dining", "kitchen", "dirty_kitchen", "car_porch:1", "lawn", "store", "laundry"],
    style: "Modern Contemporary",
    budget: "standard",
    auto_filled: [],
    ...partial,
  };
}

function concepts(pid: string, when: string, where: string): Concept[] {
  const looks = [
    "white plaster volumes, a full-height grey stone pier, teak soffits and a cantilevered porch canopy",
    "a corner composition with stacked stone, timber cladding and a frameless glass balcony",
    "a deep white frame around the first floor with vertical teak battens and grey stone infill",
    "warm evening light, mirrored massing, teak bands and a stone-clad stair tower",
  ];
  return CONCEPT_IMAGES.map((url, i) => ({
    id: `${pid}_c${i + 1}`,
    url,
    prompt: `Photoreal golden-hour exterior of a 10 marla Modern Contemporary house in ${where}, Lahore: ${looks[i]}, 4 ft front boundary wall with a sliding gate.`,
    model: "gemini-3.1-flash-image",
    created_at: when,
  }));
}

function transcript(answer: string, when: string): ChatMessage[] {
  return [
    { id: uid("msg"), role: "assistant", text: "Assalam-o-alaikum! I'm your AI architect. First: where is the plot?", created_at: when },
    { id: uid("msg"), role: "user", text: answer, created_at: when },
    { id: uid("msg"), role: "assistant", text: "Your brief is ready. Next, I'll sketch four exterior concepts for you to choose from.", created_at: when },
  ];
}

export function seedIfEmpty() {
  let seeded = false;
  try { seeded = localStorage.getItem(SEED_KEY) === "1"; } catch { /* ignore */ }
  const d = db();
  if (seeded || d.projects.length) return;

  // 1. Ready to walk.
  const pid1 = "p_demo_johar";
  const t1 = ago(26 * 60);
  const b1 = brief({ scheme: "Johar Town" });
  const c1 = concepts(pid1, t1, "Johar Town");
  const plan = clonePlan();
  const v1: Version = {
    id: "v_demo_johar_1",
    n: 1,
    created_at: ago(25 * 60),
    plan,
    sections: ARGON_SECTIONS,
    compliance: structuredClone(ARGON_REPORT),
    changes: [],
    status: "ready",
    thumbnail_url: c1[2].url,
  };
  d.versions[v1.id] = v1;

  // v2: the walkthrough revision (one plan change, one facade rewrite, one LDA rejection).
  const plan2 = clonePlan();
  deepenBedroom2(plan2);
  const c = (id: string, text: string, room: string, level: string, label: string, minutesAgo: number, snapshot: string): Comment => ({
    id,
    version_id: v1.id,
    text,
    anchor: { position: [0, 0, 0], normal: [0, 0, -1], room, level, label },
    camera: { position: [5.3, 9, -18], target: [5.3, 4, 6] },
    snapshot_url: snapshot,
    created_at: ago(minutesAgo),
    status: "open",
  });
  const comments: Comment[] = [
    c("cm_demo_porch", "Can we extend the car porch 4 feet forward into the front lawn?", "g_porch", "ground", "Car porch roof", 23 * 60, "/mock/concept-1.jpg"),
    c("cm_demo_bed2", "Bedroom 2 feels cramped, can it be bigger?", "f_bed2", "first", "Bedroom 2", 23 * 60 - 2, "/mock/remix-1.jpg"),
    c("cm_demo_louvers", "Warmer wood on the balcony louvers please", "f_balcony", "first", "Front balcony louvers", 23 * 60 - 4, "/mock/concept-3.jpg"),
  ];
  const changes: Change[] = [
    { id: "ch1", summary: "Deepened Bedroom 2 by 2 ft into the front balcony (110 → 130 sq ft)", kind: "plan", targets: ["f_bed2", "f_bath2", "f_balcony"], comment_ids: ["cm_demo_bed2"] },
    { id: "ch2", summary: "Rewrote the right-bay facade: warmer teak louvers and a full-height stone pier", kind: "section", targets: ["facade_right_bay"], comment_ids: ["cm_demo_louvers"] },
  ];
  const sections2 = ARGON_SECTIONS.map((s) =>
    s.name === "furnish_f_bed2"
      ? revisedSection(s.name, "Bedroom 2 is 2 ft deeper; the bed moves back and a study desk fits by the balcony door.") ?? s
      : s.name === "facade_right_bay"
        ? revisedSection(s.name, "warmer teak louvers wrap the balcony; the stone pier now runs to the parapet.") ?? s
        : s,
  );
  const v2: Version = {
    id: "v_demo_johar_2",
    n: 2,
    created_at: ago(22 * 60),
    parent_id: v1.id,
    plan: plan2,
    sections: sections2,
    compliance: recheck(plan2),
    changes,
    status: "ready",
    thumbnail_url: c1[2].url,
  };
  d.versions[v2.id] = v2;
  const resolutions: Record<string, [Comment["status"], string]> = {
    cm_demo_porch: ["rejected", PORCH_REJECTION],
    cm_demo_bed2: ["resolved", "Bedroom 2 is now 10×13 ft (130 sq ft), up from 110, by taking 2 ft from the front balcony, which stays 3 ft deep. It still passes every LDA room-size and daylight check."],
    cm_demo_louvers: ["resolved", "Updated the facade here: the teak louvers are warmer and wrap the balcony, and the stone pier now runs up to the parapet."],
  };
  for (const cm of comments) {
    const [status, resolution] = resolutions[cm.id];
    Object.assign(cm, { status, resolution, resolved_in_version: v2.id });
  }
  d.comments[pid1] = comments;

  d.projects.push({
    id: pid1,
    name: "Johar Town family home",
    created_at: t1,
    updated_at: ago(22 * 60),
    stage: "ready",
    brief: b1,
    envelope: envelopeFor(35, 65),
    concepts: c1,
    selected_concept_id: c1[2].id,
    versions: [
      { id: v1.id, n: 1, created_at: v1.created_at, status: "ready", summary: `v1: ${plan.rooms.length} spaces, ${v1.sections.length} code sections` },
      { id: v2.id, n: 2, created_at: v2.created_at, status: "ready", summary: changes.map((x) => x.summary).join("; ") },
    ],
    current_version_id: v2.id,
    thumbnail_url: c1[2].url,
  });
  d.messages[pid1] = transcript("10 marla in Johar Town, 4 bedrooms, modern", t1);
  d.intake[pid1] = { step: 99, done: true, brief: b1 };
  try { localStorage.setItem(FIX_LOOP_KEY(v1.id), JSON.stringify([5, 1, 0])); } catch { /* ignore */ }

  // 2. Choosing a concept.
  const pid2 = "p_demo_lake";
  const t2 = ago(190);
  const b2 = brief({ scheme: "Lake City", bedrooms: 5, bathrooms: 6, facing: "E", auto_filled: ["budget"] });
  d.projects.push({
    id: pid2,
    name: "Lake City, for Ammi and Abbu",
    created_at: t2,
    updated_at: ago(170),
    stage: "concepts",
    brief: b2,
    envelope: envelopeFor(35, 65),
    concepts: concepts(pid2, t2, "Lake City"),
    selected_concept_id: null,
    versions: [],
    current_version_id: null,
    thumbnail_url: CONCEPT_IMAGES[1],
  });
  d.messages[pid2] = transcript("Lake City, 10 marla, east facing, 5 bedrooms", t2);
  d.intake[pid2] = { step: 99, done: true, brief: b2 };

  // 3. Mid-setup.
  const pid3 = "p_demo_wapda";
  const t3 = ago(12);
  const setup = demoSetupState();
  const p3: Project = {
    id: pid3,
    name: "1 kanal corner plot, Wapda Town",
    created_at: t3,
    updated_at: ago(9),
    stage: "setup",
    brief: setup.brief,
    envelope: envelopeFor(setup.brief.plot.width_ft, setup.brief.plot.depth_ft, setup.brief.plot.corner),
    concepts: [],
    selected_concept_id: null,
    versions: [],
    current_version_id: null,
    thumbnail_url: null,
  };
  d.projects.push(p3);
  d.messages[pid3] = setup.messages;
  d.intake[pid3] = { step: setup.step, done: false, brief: setup.brief };

  save();
  try { localStorage.setItem(SEED_KEY, "1"); } catch { /* ignore */ }
}
