"""Detached runs: long agent pipelines (design, revise) keep going if the browser disconnects, and a client can re-attach
and replay every event so far (GET /api/projects/{pid}/run). One active run per project per instance; Cloud Run session
affinity routes the returning browser to the same instance.
"""
from __future__ import annotations

import asyncio
import logging
from typing import AsyncIterator, Callable

log = logging.getLogger("naqsha.runs")


class Run:
    def __init__(self, pid: str, kind: str):
        self.pid, self.kind = pid, kind
        self.events: list[tuple[str, dict]] = []
        self.done = False
        self._cond = asyncio.Condition()
        self.task: asyncio.Task | None = None

    async def _push(self, ev: tuple[str, dict]) -> None:
        async with self._cond:
            self.events.append(ev)
            self._cond.notify_all()

    async def _finish(self) -> None:
        async with self._cond:
            self.done = True
            self._cond.notify_all()

    async def follow(self, start: int = 0) -> AsyncIterator[tuple[str, dict]]:
        i = start
        while True:
            async with self._cond:
                while i >= len(self.events) and not self.done:
                    await self._cond.wait()
                batch, i, done = self.events[i:], len(self.events), self.done
            for ev in batch:
                yield ev
            if done and i >= len(self.events):
                return


RUNS: dict[str, Run] = {}


def active(pid: str, kind: str | None = None) -> Run | None:
    r = RUNS.get(pid)
    return r if r and not r.done and (kind is None or r.kind == kind) else None


def start(pid: str, kind: str, make_gen: Callable[[], AsyncIterator[tuple[str, dict]]]) -> Run:
    run = Run(pid, kind)
    RUNS[pid] = run

    async def driver():
        try:
            async for ev in make_gen():
                await run._push(ev)
        except Exception as e:  # surfaced to every follower
            log.exception("run %s/%s failed", pid, kind)
            await run._push(("error", {"message": f"{type(e).__name__}: {e}", "recoverable": True}))
        finally:
            await run._finish()

    run.task = asyncio.create_task(driver())
    return run
