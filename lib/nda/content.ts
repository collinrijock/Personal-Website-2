// the sensitive content itself: NDA_DATA_DIR/projects.md (preferred) or
// projects.json. it lives on the server only, never in git or public/, and is
// read on each request so collin can edit it without a deploy.
import fs from "fs";
import path from "path";
import { ndaConfig } from "./config";
import { renderProjects, type Rendered } from "./markdown";

interface JsonProject {
  title: string;
  summary?: string;
  body?: string; // markdown
  tags?: string[];
  links?: { label: string; href: string }[];
}

export function loadProjects(): Rendered | null {
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
