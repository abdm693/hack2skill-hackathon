/**
 * The few overhaul endpoints the flows call that `@/api/client` (APP-SHELL) may not expose yet:
 * - POST /projects/{pid}/concepts/night   (contracts/api.md "Concepts")
 * - POST /projects/{pid}/revise with {instruction}  (contracts/api.md "Revise")
 * - the conversational setup agent in mock mode (understood card, floors, tank and solar)
 * Each prefers the shell's `api` method when it exists, so auth headers stay in one place.
 */
import type { Comment } from "@contracts/api-types";
import { api, userId, type IntakeBody, type SSEHandlers, type StreamOptions } from "@/api/client";
import { openSSE } from "@/api/sse";

export interface ReviseBody { version_id: string; comment_ids?: string[]; instruction?: string }

type Extended = {
  conceptsNight?: (pid: string, body: { ids?: string[] }, handlers: SSEHandlers, opts?: StreamOptions) => Promise<void>;
};

const p = (pid: string) => `/api/projects/${encodeURIComponent(pid)}`;

/** Night versions of the given concepts (the same camera, edited from the day image). Streams `concept` events. */
export async function conceptsNight(pid: string, ids: string[], handlers: SSEHandlers, opts?: StreamOptions): Promise<void> {
  if (api.mock) {
    const { mockNight } = await import("@/app/concepts/mock-night");
    return mockNight(pid, ids, handlers, opts);
  }
  const ext = api as unknown as Extended;
  if (ext.conceptsNight) return ext.conceptsNight(pid, { ids }, handlers, opts);
  await openSSE(`${p(pid)}/concepts/night`, { method: "POST", body: { ids }, headers: { "X-Naqsha-User": userId() } }, handlers, {
    idleTimeoutMs: 120_000,
    ...opts,
  });
}

/** Revise from pinned comments, a typed instruction ("make the kitchen bigger"), or both. */
export async function revise(pid: string, body: ReviseBody, handlers: SSEHandlers, opts?: StreamOptions): Promise<void> {
  if (api.mock && body.instruction && !body.comment_ids?.length) {
    const { mockInstructionRevise } = await import("@/app/revisions/mock-instruction");
    return mockInstructionRevise(pid, body.version_id, body.instruction, handlers, opts);
  }
  // The shell's typed body may predate `instruction`; the real client sends the body as JSON unchanged.
  return api.revise(pid, body as Parameters<typeof api.revise>[1], handlers, opts);
}

/** One setup turn. The mock speaks the overhaul's conversational agent; the real API does it server side. */
export async function intake(pid: string, body: IntakeBody, handlers: SSEHandlers, opts?: StreamOptions): Promise<void> {
  if (api.mock) {
    const { mockIntake } = await import("@/app/setup/mock-agent");
    return mockIntake(pid, body, handlers, opts);
  }
  return api.intake(pid, body, handlers, opts);
}

export function commentNumber(comments: Comment[], id: string): number {
  const sorted = [...comments].sort((a, b) => a.created_at.localeCompare(b.created_at));
  return sorted.findIndex((c) => c.id === id) + 1;
}
