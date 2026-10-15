import type { PlayableAssetType } from "./playable-nodes.js";

/** Opening tags that mark the Node's background with `data-media="backdrop"`. */
const BACKDROP_TAG = /<[a-zA-Z][\w-]*\b[^>]*\sdata-media\s*=\s*(?:"backdrop"|'backdrop')[^>]*>/g;
const ASSET_ATTRIBUTE = /\sdata-(?:asset|type)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>/]+)/g;
const ASSET_ID_ATTRIBUTE = /\sdata-asset\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>/]+))/;
const ASSET_TYPE_ATTRIBUTE = /\sdata-type\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>/]+))/;

/** The Node's one background tag, or undefined when there is none or more than one. */
function backdropTag(html: string): RegExpExecArray | undefined {
  const tags = [...html.matchAll(BACKDROP_TAG)];
  return tags.length === 1 ? tags[0] : undefined;
}

/**
 * Whether the Node has a background the editor can set, and whether it shows
 * anything yet; undefined when its HTML has no single `.backdrop`.
 */
export function playableBackdrop(html: string): "missing" | "set" | undefined {
  const tag = backdropTag(html);
  if (!tag) return undefined;
  return /\sdata-asset\s*=\s*(?:"[^"]+"|'[^']+'|[^\s"'>/]+)/.test(tag[0]) ? "set" : "missing";
}

/** Returns the exact media Asset the runtime shows in the Node background. */
export function playableBackdropAsset(html: string): { assetId: string; type: Extract<PlayableAssetType, "image" | "video"> } | undefined {
  const tag = backdropTag(html);
  if (!tag) return undefined;
  const assetMatch = ASSET_ID_ATTRIBUTE.exec(tag[0]);
  const typeMatch = ASSET_TYPE_ATTRIBUTE.exec(tag[0]);
  const assetId = assetMatch?.[1] ?? assetMatch?.[2] ?? assetMatch?.[3];
  const type = typeMatch?.[1] ?? typeMatch?.[2] ?? typeMatch?.[3];
  if (!assetId || (type !== "image" && type !== "video")) return undefined;
  return { assetId, type };
}

/**
 * Points the Node's background at another Asset by setting `data-asset` and
 * `data-type` on its `.backdrop`, which `showBackdrop()` in the Project Style
 * shows. Undefined when the HTML has no single background to set.
 */
export function setPlayableBackdrop(
  html: string,
  assetId: string,
  type: Extract<PlayableAssetType, "image" | "video">,
): string | undefined {
  const tag = backdropTag(html);
  if (!tag) return undefined;
  const bare = tag[0].replace(ASSET_ATTRIBUTE, "");
  const close = bare.endsWith("/>") ? "/>" : ">";
  const opening = `${bare.slice(0, -close.length).trimEnd()} data-asset="${escapeAttribute(assetId)}" data-type="${type}"${close}`;
  return `${html.slice(0, tag.index)}${opening}${html.slice(tag.index + tag[0].length)}`;
}

/**
 * Takes the Asset off the Node's background by removing `data-asset` and
 * `data-type` from its `.backdrop`, which stays for the next one. Undefined
 * when the HTML has no single background.
 */
export function clearPlayableBackdrop(html: string): string | undefined {
  const tag = backdropTag(html);
  if (!tag) return undefined;
  return `${html.slice(0, tag.index)}${tag[0].replace(ASSET_ATTRIBUTE, "")}${html.slice(tag.index + tag[0].length)}`;
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
