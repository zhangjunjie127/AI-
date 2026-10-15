export const SYSTEM_AVATARS = [
  { id: "coral", label: "Coral", background: "#f97368", foreground: "#fff7ed", glyph: "P" },
  { id: "violet", label: "Violet", background: "#8b5cf6", foreground: "#f5f3ff", glyph: "G" },
  { id: "ocean", label: "Ocean", background: "#0ea5e9", foreground: "#ecfeff", glyph: "O" },
  { id: "mint", label: "Mint", background: "#10b981", foreground: "#ecfdf5", glyph: "M" },
  { id: "amber", label: "Amber", background: "#f59e0b", foreground: "#fffbeb", glyph: "A" },
  { id: "rose", label: "Rose", background: "#e11d48", foreground: "#fff1f2", glyph: "R" },
] as const;

export function systemAvatarUrl(id: string): string | undefined {
  const avatar = SYSTEM_AVATARS.find((item) => item.id === id);
  if (!avatar) return undefined;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="48" fill="${avatar.background}"/><text x="48" y="57" fill="${avatar.foreground}" font-family="Arial,sans-serif" font-size="38" font-weight="700" text-anchor="middle">${avatar.glyph}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function systemAvatarId(url: string | undefined): string | undefined {
  if (!url) return undefined;
  return SYSTEM_AVATARS.find((item) => systemAvatarUrl(item.id) === url)?.id;
}
