/** As-built notes: what the engine had to repair (or could not), reported with the build summary. */
export interface EngineNote {
  /** "asbuilt.<rule>:<element>", e.g. "asbuilt.stair_fit:stair_g_f" */
  id: string;
  title: string;
  status: "pass" | "warn" | "fail";
  message: string;
  element_ids?: string[];
}

export class NoteLog {
  readonly list: EngineNote[] = [];
  add(n: EngineNote): void {
    if (this.list.some((x) => x.id === n.id)) return;
    this.list.push(n);
  }
}
