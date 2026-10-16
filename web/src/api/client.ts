/** API client (track: APP). Same-origin /api; identity via X-Naqsha-User (see contracts/api.md). */
export function userId(): string {
  let id = localStorage.getItem("naqsha.uid");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("naqsha.uid", id); }
  return id;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", "X-Naqsha-User": userId(), ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}
