/**
 * House SDK: the API that Gemini Argon writes Stage-2 `design.js` against.
 * The web engine implements it in web/src/engine/. These comments are ALSO pasted into
 * Argon's prompt as its API reference, so keep them short, precise and example-driven.
 *
 * Coordinates: plan feet (see contracts/plan.ts). x = along the road (left→right), y = into the plot
 * (front→back), h = height in ft above the road crown (ground floor level ≈ plinth, e.g. 1.5).
 * World space is meters with +Y up; x_m = x_ft·0.3048, z_m = y_ft·0.3048, Y_m = h_ft·0.3048.
 * The SDK is forgiving: it clamps items inside rooms, snaps to walls and fills defaults, but never throws on bad
 * numbers. Every object it creates is tagged (layer, level, room, kind, id) for layers, comments and checks.
 *
 * ── design.js format (Argon output) ─────────────────────────────────────────────────────────────────
 * A plain-text file of SECTIONS. Each section is a function body executed as `(s, THREE) => { ... }`
 * where `s` is the HouseSDK below. The delimiters are JS line comments:
 *
 *   // @section structure [structure]
 *   s.structure({ exterior_wall: "plaster_white", floors: { lounge: "marble_white" } });
 *   // @end
 *   // @section facade_front [facade]
 *   s.facade.cladding({ side: "front", from_x_ft: 22, to_x_ft: 30, from_h_ft: 1.5, to_h_ft: 24, material: "stone_cladding" });
 *   // @end
 *
 * Section names and order: structure (exactly one, first), facade_*, interior_*, furnish_<room_id> (one per room),
 * landscape, lighting, custom_*. The layer in [brackets] is one of: structure | facade | interior | furniture |
 * landscape | lighting | custom. Revisions replace whole sections by name, so keep each one self-contained.
 * Forbidden in section code: fetch, XMLHttpRequest, WebSocket, import(), eval, Function, document, window,
 * localStorage, setTimeout loops. Pure geometry and SDK calls only.
 */

import type * as THREE_NS from "three";
import type { BuildingPlan, Pt, Rect, RoomType } from "./plan";

export type Side = "front" | "back" | "left" | "right";
export type Layer = "structure" | "facade" | "interior" | "furniture" | "landscape" | "lighting" | "custom";

export type MaterialPreset =
  // plaster/paint (pass color for paint)
  | "plaster_white" | "plaster_warm" | "plaster_grey" | "paint"
  // facade cladding
  | "stone_cladding" | "slate_cladding" | "travertine" | "brick_red" | "brick_exposed" | "concrete" | "wood_cladding"
  // floors
  | "marble_white" | "marble_beige" | "marble_black" | "terrazzo" | "porcelain_tile" | "ceramic_tile" | "wood_floor_oak" | "wood_floor_walnut"
  // joinery
  | "wood_teak" | "wood_walnut" | "wood_oak" | "wood_white_oak" | "lacquer"
  // metal and glass
  | "metal_black" | "metal_brushed" | "metal_gold" | "metal_bronze" | "glass_clear" | "glass_tinted" | "glass_frosted" | "mirror"
  // soft
  | "fabric" | "velvet" | "leather" | "linen"
  // misc
  | "ceramic_white" | "plastic"
  // outdoor
  | "grass" | "paving" | "gravel" | "soil" | "water" | "asphalt";

/** A preset name, a preset with overrides, or a ready THREE material. */
export type MaterialSpec =
  | MaterialPreset
  | { preset: MaterialPreset; color?: string; scale_ft?: number; roughness?: number; metalness?: number; emissive?: string; emissive_intensity?: number }
  | THREE_NS.Material;

export interface Tags {
  layer: Layer;
  level?: string;
  room?: string;
  kind?: string; // "wall" | "slab" | "window" | "door" | "stair" | "railing" | "furniture:<type>" | "facade:<what>" | ...
  label?: string; // human label shown on hover/comment, e.g. "Front stone cladding"
  id?: string; // stable id; auto-generated if omitted
}

export type FurnitureType =
  // bedroom
  | "bed_king" | "bed_queen" | "bed_single" | "side_table" | "wardrobe" | "dresser" | "dressing_table" | "study_desk" | "desk_chair" | "bookshelf"
  // living / drawing
  | "sofa_3" | "sofa_2" | "sofa_l" | "armchair" | "ottoman" | "coffee_table" | "console_table" | "tv_unit" | "tv" | "rug"
  | "floor_lamp" | "table_lamp" | "pendant" | "chandelier" | "curtains" | "plant_floor" | "plant_small" | "painting" | "mirror_wall"
  // dining / kitchen
  | "dining_table_4" | "dining_table_6" | "dining_table_8" | "dining_chair" | "sideboard"
  | "kitchen_counter" // straight run of base + wall cabinets; size.w_ft = run length
  | "kitchen_island" | "fridge" | "hob" | "oven" | "sink_kitchen" | "microwave"
  // bath
  | "wc" | "vanity" | "shower" | "bathtub" | "towel_rail"
  // Pakistani home details
  | "ceiling_fan" | "ac_split" | "water_dispenser" | "prayer_mat" | "washing_machine"
  // outdoor / porch
  | "car_sedan" | "car_suv" | "motorbike" | "outdoor_chair" | "outdoor_table" | "swing";

export interface FurnishOptions {
  room: string; // room id
  /** Back of the item against this wall of the room. along_ft = distance of the item's CENTER from the wall's left end (seen from inside the room). */
  against?: Side;
  along_ft?: number;
  /** OR free placement: item center in room-local ft (origin = room's min corner). rot_deg 0 = item faces +y (toward the back of the plot). */
  at?: Pt;
  rot_deg?: number;
  size?: { w_ft?: number; d_ft?: number; h_ft?: number };
  material?: MaterialSpec; // primary (frame/body)
  color?: string; // upholstery / accent color
  variant?: string; // free text hint: "upholstered headboard", "marble top", "rattan"...
}

export interface RoomHandle {
  id: string;
  type: RoomType;
  level: string;
  rect: Rect; // ft, plan coordinates
  floor_h_ft: number; // finished floor height above road crown
  ceiling_h_ft: number;
  /** Room-local ft (origin = room min corner) + height above this room's floor → world meters. */
  toWorld(x_ft: number, y_ft: number, h_ft?: number): THREE_NS.Vector3;
}

export interface FacadeFace {
  side: Side;
  /** Extent along the face in plan ft: plan x for front/back faces, plan y for left/right faces. */
  from_ft: number;
  to_ft: number;
  /** Plane position: plan y for front/back faces, plan x for left/right faces (outer surface). */
  plane_ft: number;
  bottom_h_ft: number;
  top_h_ft: number; // top of parapet
}

export interface FacadeRegion {
  side: Side;
  /** Along the face (plan x for front/back, plan y for left/right). */
  from_x_ft: number;
  to_x_ft: number;
  from_h_ft: number; // heights above the road crown
  to_h_ft: number;
  material: MaterialSpec;
}

export interface HouseSDK {
  THREE: typeof THREE_NS;
  plan: Readonly<BuildingPlan>;
  ft(n: number): number; // feet → meters
  toWorld(x_ft: number, y_ft: number, h_ft?: number): THREE_NS.Vector3; // plan ft → world meters
  mat(spec: MaterialSpec): THREE_NS.Material;

  /**
   * Build everything structural from the plan: walls (with real door and window openings, frames, glass, sills and
   * lintels), floor slabs and finishes, ceilings, skirting, stairs with railings, porch columns, balcony and terrace
   * railings, roof parapet, mumty, water tank, plinth, boundary wall and gates. Call exactly once, in `structure`.
   * Example: s.structure({ exterior_wall: "plaster_white", interior_wall: { preset: "paint", color: "#efe9df" },
   *   floors: { default: "porcelain_tile", drawing: "marble_white", bedroom: "wood_floor_oak", bath: "ceramic_tile",
   *   porch: "paving" }, window_frame: "metal_black", door: "wood_teak", railing: "glass", boundary_wall: "plaster_grey",
   *   gate: "metal_black" })
   * `floors` keys: "default", a RoomType, or a room id (most specific wins).
   */
  structure(opts?: {
    exterior_wall?: MaterialSpec;
    interior_wall?: MaterialSpec;
    floors?: Record<string, MaterialSpec>;
    ceiling?: MaterialSpec;
    window_frame?: MaterialSpec;
    door?: MaterialSpec;
    glass?: MaterialSpec;
    railing?: "glass" | "metal_bars" | "solid";
    boundary_wall?: MaterialSpec;
    gate?: MaterialSpec;
    plinth?: MaterialSpec;
  }): void;

  room(id: string): RoomHandle;
  face(side: Side, level?: string): FacadeFace; // building outer face info, for facade math

  facade: {
    /** Clad a rectangle of the outer wall on one side (thin panel, 0.1 ft proud of the wall). */
    cladding(o: FacadeRegion & { depth_ft?: number }): void;
    /** Vertical fins/battens across a region: count, width and depth (proud of wall). */
    fins(o: FacadeRegion & { count: number; width_ft?: number; depth_ft?: number }): void;
    /** Horizontal louvers across a region. */
    louvers(o: FacadeRegion & { count: number; depth_ft?: number; thickness_ft?: number }): void;
    /** Projecting box frame (picture frame) around a region, e.g. framing first-floor windows. */
    frame(o: FacadeRegion & { thickness_ft?: number; depth_ft?: number }): void;
    /** Flat projecting slab (canopy/chajja/cantilever) at height h_ft over a plan rect (may overhang setbacks ≤ allowed). */
    canopy(o: { rect: Rect; h_ft: number; thickness_ft?: number; material: MaterialSpec; downlights?: boolean }): void;
    /** Decorative perforated screen (jaali) or slat screen over a region. */
    screen(o: FacadeRegion & { pattern: "jaali_geometric" | "jaali_star" | "perforated" | "slats" }): void;
    /** Column from h to h at a plan point. */
    column(o: { at: Pt; from_h_ft: number; to_h_ft: number; size_ft?: number; round?: boolean; material: MaterialSpec }): void;
    /** Up/down wall washer light on the facade. */
    wall_light(o: { side: Side; x_ft: number; h_ft: number; color?: string; intensity?: number }): void;
    /** Strip of LED cove light along a facade edge. */
    led_strip(o: { side: Side; from_x_ft: number; to_x_ft: number; h_ft: number; color?: string }): void;
  };

  interior: {
    /** Paint or clad one wall of a room from the inside (accent wall, wood paneling, marble feature wall). */
    accent_wall(o: { room: string; side: Side; material: MaterialSpec; from_h_ft?: number; to_h_ft?: number }): void;
    /** Dropped false ceiling with a recessed cove light around the edge. */
    false_ceiling(o: { room: string; drop_ft?: number; inset_ft?: number; cove_color?: string; material?: MaterialSpec }): void;
    /** Recessed downlights in a grid. */
    downlights(o: { room: string; rows?: number; cols?: number; color?: string }): void;
  };

  /** Place one furniture item. Returns the group so you can tweak it. */
  furnish(item: FurnitureType, o: FurnishOptions): THREE_NS.Object3D;
  /** Sensible default layout for a room by its type (use when no specific intent). */
  auto_furnish(room: string, o?: { style?: "modern" | "classic" | "minimal" | "traditional"; palette?: string[] }): void;

  landscape: {
    lawn(rect: Rect): void;
    paving(rect: Rect, material?: MaterialSpec): void;
    planter(rect: Rect, o?: { height_ft?: number; material?: MaterialSpec }): void;
    tree(at: Pt, o?: { kind?: "palm" | "ashoka" | "neem" | "ornamental" | "bush"; height_ft?: number }): void;
    hedge(from: Pt, to: Pt, o?: { height_ft?: number }): void;
    /** Street, kerb and pavement in front of the plot (y < 0), plus simple neighbouring houses for context. */
    street(o?: { road_width_ft?: number; neighbours?: boolean; streetlights?: boolean }): void;
  };

  lights: {
    /** Sun from the plot facing + hour (6..19). 17.5 gives the golden hour. */
    sun(o?: { hour?: number; intensity?: number }): void;
    /** Warm ceiling lights for every enclosed room (skip if you place your own). */
    interior(o?: { warmth?: "warm" | "neutral"; intensity?: number }): void;
    point(o: { at: Pt; h_ft: number; color?: string; intensity?: number; distance_ft?: number }): void;
  };

  /** Add custom geometry you build with THREE (bespoke facade elements, art, etc.). Always tag it. */
  add(obj: THREE_NS.Object3D, tags: Tags): THREE_NS.Object3D;
}
