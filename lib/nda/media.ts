// the files the media route serves (NDA_DATA_DIR/media/<section>/<file>) and
// the markdown embeds point at: a strict name, one of five extensions.
export const MEDIA_TYPES = { mp4: "video/mp4", webm: "video/webm", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" } as const;

// starts with a letter or digit (so no dotfiles), then letters, digits, . _ -; no slashes, no %
export const MEDIA_FILE_SRC = "[A-Za-z0-9][A-Za-z0-9._-]{0,100}\\.(?:mp4|webm|jpg|jpeg|png)";
const MEDIA_FILE_RE = new RegExp(`^${MEDIA_FILE_SRC}$`);

export const validMediaName = (f: unknown): f is string => typeof f === "string" && MEDIA_FILE_RE.test(f) && !f.includes("..");

export const mediaType = (f: string): string => MEDIA_TYPES[f.slice(f.lastIndexOf(".") + 1).toLowerCase() as keyof typeof MEDIA_TYPES];
