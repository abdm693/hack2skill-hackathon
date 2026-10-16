/** Landscape (stub, replaced next). */
import type { BuildCtx } from "./core/ctx";

export function landscapeAPI(_ctx: BuildCtx) {
  const noop = (..._a: unknown[]) => undefined;
  return { lawn: noop, paving: noop, planter: noop, tree: noop, hedge: noop, street: noop };
}
