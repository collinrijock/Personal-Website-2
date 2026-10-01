// the sensitive content itself, one markdown file per section:
// NDA_DATA_DIR/sections/<id>.md (exowatt, grunts, personal, previous). it lives
// on the server only, never in git or public/, and is read on each request so
// collin can edit it without a deploy.
//
// only the sections a person was granted are ever read. the older single file,
// NDA_DATA_DIR/projects.md (or projects.json), still works: while there are no
// section files at all, it is the "personal" section.
import fs from "fs";
import path from "path";
import { ndaConfig } from "./config";
import { renderProjects, type Rendered } from "./markdown";
import { ordered, SECTION_IDS, sectionLabel, type SectionId } from "./sections";

interface JsonProject {
  title: string;
  summary?: string;
  body?: string; // markdown
  tags?: string[];
  links?: { label: string; href: string }[];
}

export interface LoadedSection {
  id: SectionId;
  label: string;
  content: Rendered | null; // null: the file isn't there yet
}

const sectionFile = (id: SectionId) => path.join(ndaConfig().dataDir, "sections", `${id}.md`);

// the granted sections, in page order, each with its content (or null)
export function loadSections(granted: readonly SectionId[]): LoadedSection[] {
  const legacy = !SECTION_IDS.some((id) => fs.existsSync(sectionFile(id)));
  return ordered(granted).map((id) => {
    let content: Rendered | null = null;
    const md = read(sectionFile(id));
    if (md != null) content = renderProjects(md);
    else if (legacy && id === "personal") content = loadLegacy();
    if (content && !content.projects.length && !content.intro.trim()) content = null;
    return { id, label: sectionLabel(id), content };
  });
}

// projects.md (preferred) or projects.json, from before sections
function loadLegacy(): Rendered | null {
  const dir = ndaConfig().dataDir;
  const md = read(path.join(dir, "projects.md"));
  if (md != null) return renderProjects(md);
  const json = read(path.join(dir, "projects.json"));
  if (json == null) return null;
  let list: JsonProject[];
  try {
    const parsed = JSON.parse(json);
    list = Array.isArray(parsed) ? parsed : parsed.projects;
    if (!Array.isArray(list)) return null;
  } catch {
    return null;
  }
  // build markdown from the json and run it through the same renderer
  const out = list
    .filter((p) => p && typeof p.title === "string")
    .map((p) => {
      const lines = [`## ${p.title}`];
      if (p.tags?.length) lines.push(p.tags.map((t) => `\`${t}\``).join(" "));
      if (p.summary) lines.push(`**${p.summary}**`);
      if (p.body) lines.push(p.body);
      if (p.links?.length) lines.push(p.links.map((l) => `- [${l.label}](${l.href})`).join("\n"));
      return lines.join("\n\n");
    })
    .join("\n\n");
  return renderProjects(out);
}

function read(file: string): string | null {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}
