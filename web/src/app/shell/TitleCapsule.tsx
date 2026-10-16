/**
 * Title capsule (DESIGN.md §5.1), top-left: ← Homes, the name (renamed inline) and the status line
 * "v2 · 42/42 LDA · 5/5 livable · Saved". Its menu holds Versions, Print plan…, Share, Rename, Details and All homes.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronDown, CloudUpload, History, Info, LayoutGrid, Pencil, Printer, Share2 } from "lucide-react";
import type { Project } from "@contracts/api-types";
import { cn } from "@/app/lib/utils";
import { canEdit, roleOf, viewAvailable } from "@/app/lib/views";
import { requireAccount, useAuth } from "@/app/store/auth";
import { useProject } from "@/app/store/project";
import { Menu, type MenuItem } from "@/app/ui/Menu";
import { Tooltip } from "@/app/ui/Tooltip";
import { complianceCounts } from "./narration";
import { startShare } from "./next";

export function useStatusLine(project: Project): string {
  const versions = useProject((s) => s.versions);
  const saveState = useProject((s) => s.saveState);
  const current = project.versions.find((v) => v.id === project.current_version_id);
  const counts = complianceCounts(project, versions);
  const bits: string[] = [];
  if (current) bits.push(`v${current.n}`);
  if (counts) {
    bits.push(`${counts.lda.pass}/${counts.lda.total} LDA`);
    if (counts.livable) bits.push(`${counts.livable.pass}/${counts.livable.total} livable`);
  }
  if (saveState === "saving") bits.push("Saving…");
  else if (saveState === "saved") bits.push("Saved");
  else if (!current) bits.push(project.stage === "setup" ? "Brief" : project.concepts.length ? "Concepts" : "Draft");
  return bits.join(" · ");
}

export function TitleCapsule({
  project,
  tone,
  onDetails,
  compact,
}: {
  project: Project;
  tone: "light" | "hud";
  onDetails: () => void;
  /** Phone: no status line, no menu chevron text. */
  compact?: boolean;
}) {
  const navigate = useNavigate();
  const rename = useProject((s) => s.rename);
  const signedIn = useAuth((s) => !!s.user);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(project.name);
  const input = useRef<HTMLInputElement>(null);
  const status = useStatusLine(project);
  const hud = tone === "hud";
  const editable = canEdit(project);
  const base = `/app/p/${project.id}`;

  useEffect(() => setValue(project.name), [project.name]);
  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const v = value.trim();
    if (v && v !== project.name) void rename(v);
    else setValue(project.name);
  };

  const items: MenuItem[] = [];
  if (viewAvailable(project, "revisions")) items.push({ label: "Versions", icon: <History />, onSelect: () => navigate(`${base}/revisions`) });
  if (project.current_version_id && viewAvailable(project, "plan")) items.push({ label: "Print plan…", icon: <Printer />, onSelect: () => navigate(`${base}/plan?dialog=print`) });
  if (roleOf(project) === "owner") items.push({ label: "Share…", icon: <Share2 />, onSelect: () => void startShare() });
  if (editable) items.push({ label: "Rename", icon: <Pencil />, onSelect: () => setEditing(true) });
  items.push({ label: "Details", icon: <Info />, onSelect: onDetails });
  items.push({ separator: true });
  if (!signedIn) items.push({ label: "Save your work…", icon: <CloudUpload />, onSelect: () => void requireAccount("save") });
  items.push({ label: "All homes", icon: <LayoutGrid />, onSelect: () => navigate("/app") });

  return (
    <div
      className={cn(
        "pointer-events-auto flex h-12 min-w-0 items-center gap-1 rounded-full pl-1.5 pr-1",
        hud ? "glass-hud" : "glass-light",
      )}
    >
      <Tooltip content="All homes">
        <button
          type="button"
          onClick={() => navigate("/app")}
          aria-label="All homes"
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-full outline-none transition-colors focus-visible:shadow-focus",
            hud ? "text-hud-ink-2 hover:bg-white/10 hover:text-hud-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
          )}
        >
          <ArrowLeft className="size-[18px]" strokeWidth={1.75} />
        </button>
      </Tooltip>
      <div className="flex min-w-0 flex-col justify-center pl-1 pr-1">
        {editing ? (
          <input
            ref={input}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") {
                e.stopPropagation();
                setValue(project.name);
                setEditing(false);
              }
            }}
            maxLength={80}
            aria-label="Home name"
            className={cn(
              "h-6 w-[min(260px,50vw)] rounded-[6px] px-1 -mx-1 text-[14px] font-semibold tracking-[-.01em] outline-none",
              hud ? "bg-white/10 text-hud-ink" : "bg-surface text-ink shadow-[0_0_0_1px_var(--color-accent)]",
            )}
          />
        ) : (
          <button
            type="button"
            onClick={() => editable && setEditing(true)}
            title={editable ? "Rename" : undefined}
            disabled={!editable}
            className={cn(
              "max-w-[min(280px,52vw)] truncate rounded-[6px] text-left text-[14px] font-semibold leading-[18px] tracking-[-.01em] outline-none focus-visible:shadow-focus disabled:cursor-default",
              hud ? "text-hud-ink" : "text-ink",
            )}
          >
            {project.name}
          </button>
        )}
        {!compact && status && (
          <span className={cn("tabular truncate text-[11px] font-medium leading-[14px]", hud ? "text-hud-ink-2" : "text-ink-3")}>
            {status}
          </span>
        )}
      </div>
      <Menu
        align="left"
        width={220}
        label="Home menu"
        trigger={({ open, toggle }) => (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-haspopup="menu"
            aria-label="Home menu"
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-full outline-none transition-colors focus-visible:shadow-focus",
              hud ? "text-hud-ink-2 hover:bg-white/10 hover:text-hud-ink" : "text-ink-3 hover:bg-surface-2 hover:text-ink",
              open && (hud ? "bg-white/10" : "bg-surface-2"),
            )}
          >
            <ChevronDown className="size-4" strokeWidth={1.75} />
          </button>
        )}
        items={items}
      />
    </div>
  );
}

