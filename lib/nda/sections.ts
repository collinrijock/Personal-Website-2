// the four parts of the nda page. collin approves each person for some of them,
// and /nda only reads and sends the ones they were granted. the order here is
// the order on the page. scripts/nda.mjs keeps its own copy of the ids.
export const SECTIONS = [
  { id: "exowatt", label: "exowatt" },
  { id: "grunts", label: "grunts" },
  { id: "personal", label: "personal projects" },
  { id: "previous", label: "previous employers" },
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];

export const SECTION_IDS: SectionId[] = SECTIONS.map((s) => s.id);

export const isSection = (v: unknown): v is SectionId => typeof v === "string" && (SECTION_IDS as string[]).includes(v);

export const sectionLabel = (id: SectionId) => SECTIONS.find((s) => s.id === id)!.label;

// put ids in page order, without repeats
export const ordered = (ids: readonly SectionId[]): SectionId[] => SECTION_IDS.filter((id) => ids.includes(id));

// a list of section ids from a form or json body: an array, one string, or a
// comma-separated string. anything that isn't one of the four ids makes the
// whole list invalid (null), so a forged or mistyped list is refused outright.
// a missing value is an empty list.
export function parseSections(v: unknown): SectionId[] | null {
  if (v == null || v === "") return [];
  const raw = Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : null;
  if (!raw || raw.length > 16) return null;
  const out: SectionId[] = [];
  for (const x of raw) {
    const s = typeof x === "string" ? x.trim() : x;
    if (s === "") continue;
    if (!isSection(s)) return null;
    out.push(s);
  }
  return ordered(out);
}

// "exowatt, grunts and personal projects"
export function sectionList(ids: readonly SectionId[]): string {
  const l = ordered(ids).map(sectionLabel);
  if (l.length < 2) return l.join("");
  return `${l.slice(0, -1).join(", ")} and ${l[l.length - 1]}`;
}
