import { useEffect, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/app/lib/utils";

const KEYWORDS = new Set(["const", "let", "var", "for", "of", "in", "if", "else", "return", "new", "function", "true", "false", "null", "undefined", "while", "break", "continue"]);

/** Minimal JS highlighter for design.js sections (comments, strings, numbers, keywords, calls). */
function highlight(code: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\/\/[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)(\s*\()?|([^\w"'`/]+|\/)/g;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(code))) {
    const [all, com, str, numLit, ident, call, other] = m;
    if (com) out.push(<span key={i++} className="tk-com">{com}</span>);
    else if (str) out.push(<span key={i++} className="tk-str">{str}</span>);
    else if (numLit) out.push(<span key={i++} className="tk-num">{numLit}</span>);
    else if (ident) {
      if (KEYWORDS.has(ident)) out.push(<span key={i++} className="tk-key">{ident}</span>);
      else if (call) out.push(<span key={i++} className="tk-fn">{ident}</span>, call);
      else out.push(ident);
    } else out.push(other ?? all);
  }
  return out;
}

/** Code view; with `typing`, reveals the code progressively as if it were being written. */
export function CodeBlock({ code, typing, className, maxHeight = 320 }: { code: string; typing?: boolean; className?: string; maxHeight?: number }) {
  const [shown, setShown] = useState(typing ? 0 : code.length);
  useEffect(() => {
    if (!typing) { setShown(code.length); return; }
    setShown(0);
    const total = code.length;
    const step = Math.max(12, Math.ceil(total / 70));
    const t = setInterval(() => setShown((s) => {
      const n = Math.min(total, s + step);
      if (n >= total) clearInterval(t);
      return n;
    }), 18);
    return () => clearInterval(t);
  }, [code, typing]);
  const visible = shown >= code.length ? code : code.slice(0, shown);
  const nodes = useMemo(() => highlight(visible), [visible]);
  const lines = visible.split("\n").length;
  return (
    <div className={cn("relative overflow-hidden rounded-xl bg-[#1d1b18] text-[#e9e4da]", className)}>
      <pre className="code-view scrollbar-thin overflow-auto px-3.5 py-3" style={{ maxHeight }}>
        <code className="grid grid-cols-[auto_1fr] gap-x-3">
          <span aria-hidden className="select-none text-right text-[#6f685e]">
            {Array.from({ length: lines }, (_, k) => k + 1).join("\n")}
          </span>
          <span className="whitespace-pre">
            {nodes}
            {shown < code.length && <span className="ml-px inline-block h-3.5 w-[7px] translate-y-0.5 bg-[#e7a58f]" />}
          </span>
        </code>
      </pre>
    </div>
  );
}
