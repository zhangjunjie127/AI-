import { offsetOf, startTagEnd } from "./playable-text-edit.js";
import { annotatePlayableSourceLocations } from "./playable-source-locations.js";
import type { PlayableSourceLocation } from "./playable-text-edit.js";
import type { PlayableNodeContext } from "./playable-nodes.js";

export type PlayableMotionKind =
  "countdown" | "progress-ring" | "progress-bar" | "hold-charge";

export type PlayableMotionMode = "interactive" | "visual";

export interface PlayableMotionConfig {
  kind: PlayableMotionKind;
  mode: PlayableMotionMode;
  duration: number;
  timeoutDuration?: number;
  signal?: string;
  timeoutSignal?: string;
}

export interface InsertedPlayableMotion {
  html: string;
  source: string;
  id: string;
}

export const PLAYABLE_MOTION_ATTRIBUTES = {
  kind: "data-putenggame-motion",
  mode: "data-putenggame-motion-mode",
  duration: "data-putenggame-motion-duration",
  timeoutDuration: "data-putenggame-motion-timeout-duration",
  signal: "data-putenggame-motion-signal",
  timeoutSignal: "data-putenggame-motion-timeout",
  continueWithoutInput: "data-putenggame-continue-without-input",
  asset: "data-putenggame-button-asset",
  pressedAsset: "data-putenggame-button-pressed-asset",
  assetScale: "data-putenggame-button-asset-scale",
  assetScaleX: "data-putenggame-button-asset-scale-x",
  assetScaleY: "data-putenggame-button-asset-scale-y",
  labelTranslate: "data-putenggame-button-label-translate",
} as const;

export function setPlayableContinueWithoutInput(
  html: string,
  enabled: boolean,
): string | undefined {
  const root = /<[a-z][\w-]*\b[^>]*>/i.exec(html);
  if (!root) return undefined;
  const attribute = PLAYABLE_MOTION_ATTRIBUTES.continueWithoutInput;
  const escaped = attribute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const expression = new RegExp(
    `\\s${escaped}(?:\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+))?`,
    "i",
  );
  let opening = root[0].replace(expression, "");
  if (enabled) {
    const close = opening.endsWith("/>") ? "/>" : ">";
    opening = `${opening.slice(0, -close.length).trimEnd()} ${attribute}="true"${close}`;
  }
  return `${html.slice(0, root.index)}${opening}${html.slice(root.index + root[0].length)}`;
}

export function playableContinueWithoutInput(html: string): boolean {
  const root = /<[a-z][\w-]*\b[^>]*>/i.exec(html)?.[0];
  if (!root) return false;
  const attribute = PLAYABLE_MOTION_ATTRIBUTES.continueWithoutInput;
  const match = new RegExp(
    `\\s${attribute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*=\\s*(?:"true"|'true'|true)(?:\\s|\\/?>)`,
    "i",
  ).exec(root);
  return Boolean(match);
}

export const PLAYABLE_BUTTON_ASSET_SCALE_MIN = 10;
export const PLAYABLE_BUTTON_ASSET_SCALE_MAX = 500;

const MOTION_KINDS = new Set<PlayableMotionKind>([
  "countdown",
  "progress-ring",
  "progress-bar",
  "hold-charge",
]);

export function parsePlayableMotionConfig(
  element: Pick<HTMLElement, "getAttribute">,
): PlayableMotionConfig | undefined {
  const kind = element.getAttribute(PLAYABLE_MOTION_ATTRIBUTES.kind);
  const mode = element.getAttribute(PLAYABLE_MOTION_ATTRIBUTES.mode);
  const duration = Number(
    element.getAttribute(PLAYABLE_MOTION_ATTRIBUTES.duration),
  );
  const timeoutDuration = Number(
    element.getAttribute(PLAYABLE_MOTION_ATTRIBUTES.timeoutDuration),
  );
  if (
    !MOTION_KINDS.has(kind as PlayableMotionKind) ||
    (mode !== "interactive" && mode !== "visual") ||
    !Number.isFinite(duration) ||
    duration < 0.1 ||
    duration > 3600
  )
    return undefined;
  const signal =
    element.getAttribute(PLAYABLE_MOTION_ATTRIBUTES.signal) || undefined;
  const timeoutSignal =
    element.getAttribute(PLAYABLE_MOTION_ATTRIBUTES.timeoutSignal) || undefined;
  return {
    kind: kind as PlayableMotionKind,
    mode,
    duration,
    ...(Number.isFinite(timeoutDuration) && timeoutDuration >= duration
      ? { timeoutDuration }
      : {}),
    ...(signal ? { signal } : {}),
    ...(timeoutSignal ? { timeoutSignal } : {}),
  };
}

export function playableButtonAssetScale(value: string | null): number {
  const scale = value === null ? 100 : Number(value);
  return Number.isFinite(scale) &&
    scale >= PLAYABLE_BUTTON_ASSET_SCALE_MIN &&
    scale <= PLAYABLE_BUTTON_ASSET_SCALE_MAX
    ? Math.round(scale)
    : 100;
}

export function playableButtonAssetScales(
  element: Pick<HTMLElement, "getAttribute">,
): { x: number; y: number } {
  const legacy = element.getAttribute(PLAYABLE_MOTION_ATTRIBUTES.assetScale);
  return {
    x:
      element.getAttribute(PLAYABLE_MOTION_ATTRIBUTES.assetScaleX) === null
        ? playableButtonAssetScale(legacy)
        : playableButtonAssetScale(
            element.getAttribute(PLAYABLE_MOTION_ATTRIBUTES.assetScaleX),
          ),
    y:
      element.getAttribute(PLAYABLE_MOTION_ATTRIBUTES.assetScaleY) === null
        ? playableButtonAssetScale(legacy)
        : playableButtonAssetScale(
            element.getAttribute(PLAYABLE_MOTION_ATTRIBUTES.assetScaleY),
          ),
  };
}

export function playableElementTransformScale(
  element: Pick<HTMLElement, "getAttribute">,
  value: string,
): number {
  const scale = Number.parseFloat(value.trim());
  if (!Number.isFinite(scale) || scale <= 0) return 1;
  if (!element.getAttribute(PLAYABLE_MOTION_ATTRIBUTES.asset)) return scale;
  return scale / (playableButtonAssetScales(element).x / 100);
}

export function playableElementRuntimeScale(
  element: Pick<HTMLElement, "getAttribute">,
  scale: number,
): string {
  if (!element.getAttribute(PLAYABLE_MOTION_ATTRIBUTES.asset))
    return String(scale);
  const assetScale = playableButtonAssetScales(element);
  return formatScaleAxes(
    scale * (assetScale.x / 100),
    scale * (assetScale.y / 100),
  );
}

function parseScaleAxes(value: string): [number, number] {
  if (!value.trim() || value.trim() === "none") return [1, 1];
  const [x, y = x] = value.trim().split(/\s+/).map(Number);
  return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : [1, 1];
}

function formatScaleAxes(x: number, y: number): string {
  return `${Number(x.toFixed(4))} ${Number(y.toFixed(4))}`;
}

export function setPlayableElementAttributes(
  html: string,
  location: Pick<PlayableSourceLocation, "line" | "column">,
  tag: string,
  updates: Readonly<Record<string, string | undefined>>,
): string | undefined {
  const start = offsetOf(html, location.line, location.column);
  if (start === undefined || html[start] !== "<") return undefined;
  const name = /^<([A-Za-z][\w-]*)/.exec(html.slice(start))?.[1];
  if (!name || name.toLowerCase() !== tag.toLowerCase()) return undefined;
  const end = startTagEnd(html, start);
  if (end === undefined) return undefined;

  let next = html.slice(start, end);
  for (const [attribute, value] of Object.entries(updates)) {
    if (!/^data-[a-z0-9-]+$/.test(attribute)) return undefined;
    const escapedName = attribute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const expression = new RegExp(
      `\\s${escapedName}(?:\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+))?`,
      "i",
    );
    const existing = expression.exec(next);
    if (existing)
      next = `${next.slice(0, existing.index)}${next.slice(existing.index + existing[0].length)}`;
    if (value !== undefined) {
      const insertAt = /\/\s*>$/.test(next)
        ? next.lastIndexOf("/")
        : next.length - 1;
      next = `${next.slice(0, insertAt)} ${attribute}="${escapeAttribute(value)}"${next.slice(insertAt)}`;
    }
  }
  return `${html.slice(0, start)}${next}${html.slice(end)}`;
}

export function insertPlayableMotion(
  html: string,
  file: string,
  config: PlayableMotionConfig,
  id: string,
): InsertedPlayableMotion | undefined {
  if (!/^putenggame-motion-[\w-]+$/.test(id) || html.includes(id))
    return undefined;
  if (
    !MOTION_KINDS.has(config.kind) ||
    (config.mode !== "interactive" && config.mode !== "visual") ||
    !Number.isFinite(config.duration) ||
    config.duration < 0.1 ||
    config.duration > 3600 ||
    (config.timeoutDuration !== undefined &&
      (!Number.isFinite(config.timeoutDuration) ||
        config.timeoutDuration < config.duration ||
        config.timeoutDuration > 3600))
  )
    return undefined;
  const root = /<([A-Za-z][\w-]*)\b[^>]*>/i.exec(html);
  if (!root) return undefined;
  const closingPattern = new RegExp(`<\\/\\s*${root[1]}\\s*>`, "gi");
  let closing: RegExpExecArray | null;
  let lastClosing: RegExpExecArray | null = null;
  while ((closing = closingPattern.exec(html))) lastClosing = closing;
  if (!lastClosing) return undefined;
  const attributes = motionAttributes(config);
  const element = `<div id="${id}" ${attributes} style="position:absolute;left:40cqw;top:40cqh;width:20cqw;height:5cqh;display:grid;place-items:center;pointer-events:auto"></div>`;
  const offset = lastClosing.index;
  const updated = `${html.slice(0, offset)}${element}${html.slice(offset)}`;
  const annotated = annotatePlayableSourceLocations(updated, file);
  const idOffset = annotated.indexOf(`id="${id}"`);
  const start = annotated.lastIndexOf("<", idOffset);
  const end = startTagEnd(annotated, start);
  if (idOffset < 0 || start < 0 || end === undefined) return undefined;
  const source = /\sdata-putenggame-source="([^"]+)"/i.exec(
    annotated.slice(start, end),
  )?.[1];
  return source ? { html: updated, source, id } : undefined;
}

export function insertPlayableMediaElement(
  html: string,
  file: string,
  assetId: string,
  type: "image" | "video",
  id: string,
): { html: string; source: string } | undefined {
  if (
    !/^[a-z0-9._-]{1,120}$/i.test(assetId) ||
    !/^putenggame-media-[\w-]+$/.test(id) ||
    html.includes(id)
  )
    return undefined;
  const root = /<([A-Za-z][\w-]*)\b[^>]*>/i.exec(html);
  if (!root) return undefined;
  const closingPattern = new RegExp(`<\\/\\s*${root[1]}\\s*>`, "gi");
  let closing: RegExpExecArray | null;
  let lastClosing: RegExpExecArray | null = null;
  while ((closing = closingPattern.exec(html))) lastClosing = closing;
  if (!lastClosing) return undefined;
  const style =
    "position:absolute;left:35cqw;top:30cqh;width:30cqw;max-height:60cqh;object-fit:contain";
  const element =
    type === "image"
      ? `<img id="${id}" data-putenggame-asset="${escapeAttribute(assetId)}" alt="" draggable="false" style="${style}">`
      : `<video id="${id}" data-putenggame-asset="${escapeAttribute(assetId)}" autoplay muted loop playsinline style="${style}"></video>`;
  const offset = lastClosing.index;
  const updated = `${html.slice(0, offset)}${element}${html.slice(offset)}`;
  const annotated = annotatePlayableSourceLocations(updated, file);
  const marker = `id="${id}"`;
  const assetOffset = annotated.indexOf(marker);
  const start = annotated.lastIndexOf("<", assetOffset);
  const end = startTagEnd(annotated, start);
  if (assetOffset < 0 || start < 0 || end === undefined) return undefined;
  const source = /\sdata-putenggame-source="([^"]+)"/i.exec(
    annotated.slice(start, end),
  )?.[1];
  return source ? { html: updated, source } : undefined;
}

export function insertPlayableButtonPreset(
  html: string,
  file: string,
  id: string,
  signal: string,
  label: string,
): { html: string; source: string } | undefined {
  if (
    !/^putenggame-button-[\w-]+$/.test(id) ||
    html.includes(id) ||
    !/^[a-z][a-z0-9-]*$/.test(signal) ||
    !label.trim() ||
    label.length > 120
  )
    return undefined;
  const root = /<([A-Za-z][\w-]*)\b[^>]*>/i.exec(html);
  if (!root) return undefined;
  const closingPattern = new RegExp(`<\\/\\s*${root[1]}\\s*>`, "gi");
  let closing: RegExpExecArray | null;
  let lastClosing: RegExpExecArray | null = null;
  while ((closing = closingPattern.exec(html))) lastClosing = closing;
  if (!lastClosing) return undefined;
  const element = `<button id="${id}" type="button" data-signal="${signal}" data-putenggame-button-preset style="position:absolute;left:50cqw;top:50cqh;transform:translate(-50%,-50%);min-width:14cqw;padding:1cqh 2cqw;border:1px solid rgba(255,255,255,.8);border-radius:6px;background:rgba(20,20,20,.78);color:#fff;font:inherit;cursor:pointer">${escapeAttribute(label)}</button>`;
  const offset = lastClosing.index;
  const updated = `${html.slice(0, offset)}${element}${html.slice(offset)}`;
  const annotated = annotatePlayableSourceLocations(updated, file);
  const idOffset = annotated.indexOf(`id="${id}"`);
  const start = annotated.lastIndexOf("<", idOffset);
  const end = startTagEnd(annotated, start);
  if (idOffset < 0 || start < 0 || end === undefined) return undefined;
  const source = /\sdata-putenggame-source="([^"]+)"/i.exec(
    annotated.slice(start, end),
  )?.[1];
  return source ? { html: updated, source } : undefined;
}

export function mountPlayableMotionElement(
  element: HTMLElement,
  context: PlayableNodeContext,
  assetUrl?: string,
  pressedAssetUrl?: string,
): () => void {
  const cleanups: (() => void)[] = [];
  const assetId = element.getAttribute(PLAYABLE_MOTION_ATTRIBUTES.asset);
  const pressedAssetId = element.getAttribute(
    PLAYABLE_MOTION_ATTRIBUTES.pressedAsset,
  );
  if (assetId || pressedAssetId) {
    try {
      cleanups.push(
        mountPlayableButtonAsset(
          element,
          assetId ? (assetUrl ?? context.assets.url(assetId)) : undefined,
          pressedAssetUrl ??
            (pressedAssetId ? context.assets.url(pressedAssetId) : undefined),
        ),
      );
    } catch {
      // An undeclared button asset should not prevent the scene from mounting.
    }
  }
  const config = parsePlayableMotionConfig(element);
  if (config) cleanups.push(mountMotion(element, config, context));
  return () => cleanups.forEach((cleanup) => cleanup());
}

function mountPlayableButtonAsset(
  element: HTMLElement,
  assetUrl?: string,
  pressedAssetUrl?: string,
): () => void {
  const view = element.ownerDocument.defaultView;
  const previous = {
    backgroundImage: element.style.backgroundImage,
    isolation: element.style.isolation,
    position: element.style.position,
    scale: element.style.scale,
    transition: element.style.transition,
  };
  if (pressedAssetUrl) {
    if (view?.getComputedStyle(element).position === "static")
      element.style.position = "relative";
    element.style.isolation = "isolate";
  }
  const layer = assetUrl
    ? element.ownerDocument.createElement("span")
    : undefined;
  if (layer) {
    layer.dataset.putenggameButtonAssetImage = "";
    Object.assign(layer.style, {
      position: "absolute",
      inset: "0",
      zIndex: "-1",
      overflow: "hidden",
      borderRadius: "inherit",
      pointerEvents: "none",
      ...(pressedAssetUrl ? { visibility: "visible" } : {}),
    });
  }
  const image = assetUrl
    ? element.ownerDocument.createElement("img")
    : undefined;
  if (image) {
    image.src = assetUrl!;
    image.alt = "";
    image.draggable = false;
  }
  const { x, y } = playableButtonAssetScales(element);
  const [authoredScaleX, authoredScaleY] = parseScaleAxes(previous.scale);
  const baseScale = assetUrl
    ? formatScaleAxes(
        authoredScaleX * (x / 100),
        authoredScaleY * (y / 100),
      )
    : previous.scale;
  if (image) {
    Object.assign(image.style, {
      display: "block",
      width: "100%",
      height: "100%",
      objectFit: "contain",
    });
    layer?.append(image);
  }
  let pressedLayer: HTMLSpanElement | undefined;
  if (pressedAssetUrl) {
    pressedLayer = element.ownerDocument.createElement("span");
    pressedLayer.dataset.putenggameButtonPressedImage = "";
    Object.assign(pressedLayer.style, {
      position: "absolute",
      inset: "0",
      zIndex: "-1",
      overflow: "hidden",
      borderRadius: "inherit",
      pointerEvents: "none",
      visibility: "hidden",
    });
    const pressedImage = element.ownerDocument.createElement("img");
    pressedImage.src = pressedAssetUrl;
    pressedImage.alt = "";
    pressedImage.draggable = false;
    Object.assign(pressedImage.style, {
      display: "block",
      width: "100%",
      height: "100%",
      objectFit: "contain",
    });
    pressedLayer.append(pressedImage);
    element.append(pressedLayer);
  }
  let hovered = false;
  let pointerHeld = false;
  let keyboardHeld = false;
  let scaleHeld = false;
  let scaleBeforePress = "";
  const updatePressedState = () => {
    if (!pressedLayer) return;
    const showPressed = hovered || pointerHeld || keyboardHeld;
    pressedLayer.style.visibility = showPressed ? "visible" : "hidden";
    if (layer) layer.style.visibility = showPressed ? "hidden" : "visible";
    else
      element.style.backgroundImage = showPressed
        ? "none"
        : previous.backgroundImage;
    const shouldScale = pointerHeld || keyboardHeld;
    if (shouldScale && !scaleHeld) {
      scaleBeforePress = element.style.scale;
      const [scaleX, scaleY] = parseScaleAxes(scaleBeforePress);
      element.style.scale = formatScaleAxes(scaleX * 1.08, scaleY * 1.08);
    } else if (!shouldScale && scaleHeld) {
      element.style.scale = scaleBeforePress;
    }
    scaleHeld = shouldScale;
  };
  const onPointerEnter = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    hovered = true;
    updatePressedState();
  };
  const onPointerLeave = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    hovered = false;
    updatePressedState();
  };
  const onPointerDown = () => {
    pointerHeld = true;
    updatePressedState();
  };
  const onPointerUp = () => {
    pointerHeld = false;
    updatePressedState();
  };
  const onBlur = () => {
    hovered = false;
    pointerHeld = false;
    keyboardHeld = false;
    updatePressedState();
  };
  const onKeyDown = () => {
    keyboardHeld = true;
    updatePressedState();
  };
  const onKeyUp = () => {
    keyboardHeld = false;
    updatePressedState();
  };
  if (pressedLayer) {
    const existingTransition =
      previous.transition || view?.getComputedStyle(element).transition || "";
    if (existingTransition && !existingTransition.includes("scale"))
      element.style.transition = `${existingTransition}, scale 120ms ease`;
    else if (!existingTransition)
      element.style.transition = "scale 120ms ease";
    element.addEventListener("pointerenter", onPointerEnter);
    element.addEventListener("pointerleave", onPointerLeave);
    element.addEventListener("pointerdown", onPointerDown, true);
    view?.addEventListener("pointerup", onPointerUp, true);
    view?.addEventListener("pointercancel", onPointerUp, true);
    view?.addEventListener("blur", onBlur);
    element.addEventListener("keydown", onKeyDown);
    element.addEventListener("keyup", onKeyUp);
  }
  const label = assetUrl ? wrapButtonLabel(element) : undefined;
  const labelTranslate =
    element.getAttribute(PLAYABLE_MOTION_ATTRIBUTES.labelTranslate) ?? "";
  if (label) {
    label.style.scale = `${100 / x} ${100 / y}`;
    label.style.translate = labelTranslate;
  }
  if (layer) element.prepend(layer);
  if (assetUrl) {
    element.style.backgroundImage = "none";
    element.style.isolation = "isolate";
    element.style.scale = baseScale || formatScaleAxes(x / 100, y / 100);
  }
  if (view?.getComputedStyle(element).position === "static")
    element.style.position = "relative";
  return () => {
    layer?.remove();
    pressedLayer?.remove();
    element.removeEventListener("pointerenter", onPointerEnter);
    element.removeEventListener("pointerleave", onPointerLeave);
    element.removeEventListener("pointerdown", onPointerDown, true);
    view?.removeEventListener("pointerup", onPointerUp, true);
    view?.removeEventListener("pointercancel", onPointerUp, true);
    view?.removeEventListener("blur", onBlur);
    element.removeEventListener("keydown", onKeyDown);
    element.removeEventListener("keyup", onKeyUp);
    unwrapButtonLabel(label);
    if (assetUrl || pressedAssetUrl) {
      element.style.backgroundImage = previous.backgroundImage;
    }
    if (assetUrl) {
      element.style.isolation = previous.isolation;
      element.style.position = previous.position;
      element.style.scale = previous.scale;
    }
    if (pressedAssetUrl) element.style.transition = previous.transition;
    if (pressedAssetUrl && !assetUrl) {
      element.style.position = previous.position;
      element.style.isolation = previous.isolation;
      element.style.scale = previous.scale;
    }
  };
}

function wrapButtonLabel(button: HTMLElement): HTMLSpanElement | undefined {
  const textNodes = Array.from(button.childNodes).filter(
    (child): child is Text =>
      child.nodeType === 3 && Boolean(child.textContent?.trim()),
  );
  const first = textNodes[0];
  if (!first) return undefined;
  const label = button.ownerDocument.createElement("span");
  label.dataset.putenggameButtonLabel = "";
  Object.assign(label.style, {
    display: "inline-block",
    transformOrigin: "center",
    verticalAlign: "inherit",
  });
  first.replaceWith(label);
  for (const node of textNodes) label.append(node);
  return label;
}

function unwrapButtonLabel(label: HTMLSpanElement | undefined): void {
  if (!label) return;
  label.replaceWith(...Array.from(label.childNodes));
}

export function updatePlayableButtonLabelScale(button: HTMLElement): void {
  const label = button.querySelector<HTMLElement>(
    "[data-putenggame-button-label]",
  );
  if (!label) return;
  const { x, y } = playableButtonAssetScales(button);
  label.style.scale = `${100 / x} ${100 / y}`;
}

function mountMotion(
  element: HTMLElement,
  config: PlayableMotionConfig,
  context: PlayableNodeContext,
): () => void {
  const view = element.ownerDocument.defaultView!;
  const computedStyle = view.getComputedStyle(element);
  const previousPosition = element.style.position;
  const previousCursor = element.style.cursor;
  if (computedStyle.position === "static") element.style.position = "relative";
  if (config.mode === "interactive") element.style.cursor = "pointer";
  const overlay = element.ownerDocument.createElement("span");
  overlay.dataset.putenggameMotionUi = "";
  Object.assign(overlay.style, {
    position: "absolute",
    inset: "0",
    display: "grid",
    placeItems: "center",
    pointerEvents: "none",
    zIndex: "1",
    font: "inherit",
  });
  const track = element.ownerDocument.createElement("span");
  Object.assign(track.style, {
    position: "relative",
    display: "grid",
    placeItems: "center",
    width: config.kind === "progress-ring" ? "2.8em" : "100%",
    height: config.kind === "progress-ring" ? "2.8em" : "100%",
    boxSizing: "border-box",
  });
  overlay.append(track);
  let ring: SVGCircleElement | undefined;
  if (config.kind === "progress-ring") {
    const svg = element.ownerDocument.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg",
    );
    svg.setAttribute("viewBox", "0 0 100 100");
    Object.assign(svg.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      transform: "rotate(-90deg)",
    });
    const background = element.ownerDocument.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle",
    );
    background.setAttribute("cx", "50");
    background.setAttribute("cy", "50");
    background.setAttribute("r", "44");
    background.setAttribute("fill", "none");
    background.setAttribute("stroke", "currentColor");
    background.setAttribute("stroke-opacity", "0.24");
    background.setAttribute("stroke-width", "8");
    ring = element.ownerDocument.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle",
    );
    ring.setAttribute("cx", "50");
    ring.setAttribute("cy", "50");
    ring.setAttribute("r", "44");
    ring.setAttribute("fill", "none");
    ring.setAttribute("stroke", "currentColor");
    ring.setAttribute("stroke-width", "8");
    ring.setAttribute("stroke-dasharray", String(2 * Math.PI * 44));
    ring.setAttribute("stroke-dashoffset", "0");
    ring.setAttribute("stroke-linecap", "round");
    svg.append(background, ring);
    track.append(svg);
  } else {
    const rail = element.ownerDocument.createElement("span");
    Object.assign(rail.style, {
      position: "absolute",
      left: "8%",
      right: "8%",
      bottom: "0.2em",
      height: "0.18em",
      borderRadius: "999px",
      background: "color-mix(in srgb, currentColor 28%, transparent)",
      overflow: "hidden",
    });
    const fill = element.ownerDocument.createElement("span");
    Object.assign(fill.style, {
      display: "block",
      width: "100%",
      height: "100%",
      background: "currentColor",
      transformOrigin: "left center",
      transform: "scaleX(1)",
    });
    rail.append(fill);
    track.append(rail);
    if (config.kind === "countdown") {
      const label = element.ownerDocument.createElement("span");
      label.dataset.putenggameMotionLabel = "";
      label.textContent = String(Math.ceil(config.duration));
      track.append(label);
    }
  }
  element.append(overlay);

  const started = view.performance.now();
  const durationMs = config.duration * 1000;
  const timeoutMs =
    config.kind === "hold-charge" && config.mode === "interactive"
      ? (config.timeoutDuration ?? Math.min(3600, config.duration * 2)) * 1000
      : durationMs;
  let frame = 0;
  let finished = false;
  let holding = false;
  let holdStarted = 0;
  let dispatchingSuccessClick = false;
  const fill = track.querySelector<HTMLElement>("span span");
  const label = track.querySelector<HTMLElement>(
    "[data-putenggame-motion-label]",
  );
  const update = (now: number) => {
    if (finished) return;
    const elapsed =
      config.kind === "hold-charge" && config.mode === "interactive"
        ? holding
          ? now - holdStarted
          : 0
        : now - started;
    const progress = Math.min(1, Math.max(0, elapsed / durationMs));
    if (fill) fill.style.transform = `scaleX(${1 - progress})`;
    if (ring)
      ring.setAttribute(
        "stroke-dashoffset",
        String(2 * Math.PI * 44 * progress),
      );
    if (label)
      label.textContent = String(
        Math.max(0, Math.ceil(config.duration * (1 - progress))),
      );
  };
  const emit = (signal: string | undefined) => {
    if (signal && context.navigation.connected(signal))
      void context.navigation.emit(signal).catch(() => {});
  };
  const finish = () => {
    if (finished) return;
    finished = true;
    if (config.mode === "visual") emit(config.signal);
    else if (config.timeoutSignal && context.navigation.connected(config.timeoutSignal))
      void context.navigation.fail(config.timeoutSignal).catch(() => {});
  };
  const succeed = () => {
    if (finished) return;
    finished = true;
    if (
      config.signal &&
      element.getAttribute("data-signal") === config.signal
    ) {
      dispatchingSuccessClick = true;
      element.dispatchEvent(
        new view.MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      dispatchingSuccessClick = false;
    } else {
      emit(config.signal);
    }
  };
  const tick = (now: number) => {
    update(now);
    if (finished) return;
    const elapsed =
      config.kind === "hold-charge" && config.mode === "interactive"
        ? holding
          ? now - holdStarted
          : 0
        : now - started;
    const progress = Math.min(1, Math.max(0, elapsed / durationMs));
    if (
      config.kind === "hold-charge" &&
      config.mode === "interactive" &&
      holding &&
      progress >= 1
    ) {
      succeed();
      return;
    }
    if (
      config.kind === "hold-charge" &&
      config.mode === "interactive" &&
      now - started >= timeoutMs
    ) {
      finish();
      return;
    }
    if (
      (config.kind !== "hold-charge" || config.mode !== "interactive") &&
      progress >= 1
    ) {
      finish();
      return;
    }
    frame = view.requestAnimationFrame(tick);
  };
  frame = view.requestAnimationFrame(tick);

  const setProgress = (progress: number) => {
    if (fill) fill.style.transform = `scaleX(${1 - progress})`;
    if (ring)
      ring.setAttribute(
        "stroke-dashoffset",
        String(2 * Math.PI * 44 * progress),
      );
    if (label)
      label.textContent = String(
        Math.max(0, Math.ceil(config.duration * (1 - progress))),
      );
  };
  const pressStart = (event: Event) => {
    if (config.kind !== "hold-charge" || config.mode !== "interactive") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    holding = true;
    holdStarted = view.performance.now();
    if (typeof PointerEvent !== "undefined" && event instanceof PointerEvent) {
      try {
        element.setPointerCapture(event.pointerId);
      } catch {
        // Capturing is not available for all embedded preview elements.
      }
    }
    setProgress(0);
    frame = view.requestAnimationFrame(tick);
  };
  const pressEnd = (event: Event) => {
    if (config.kind !== "hold-charge" || config.mode !== "interactive") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!holding || finished) return;
    holding = false;
    const holdElapsed = Math.min(
      durationMs,
      view.performance.now() - holdStarted,
    );
    if (holdElapsed >= durationMs) succeed();
    else {
      setProgress(0);
    }
  };
  const click = (event: Event) => {
    if (config.mode !== "interactive" || config.kind === "hold-charge") return;
    if (dispatchingSuccessClick) return;
    if (finished) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (
      config.signal &&
      element.getAttribute("data-signal") === config.signal
    ) {
      finished = true;
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    finished = true;
    emit(config.signal);
  };
  element.addEventListener("click", click, true);
  if (config.kind === "hold-charge" && config.mode === "interactive") {
    element.addEventListener("pointerdown", pressStart, true);
    element.addEventListener("pointerup", pressEnd, true);
    element.addEventListener("pointercancel", pressEnd, true);
    element.addEventListener("click", pressEnd, true);
  }

  return () => {
    view.cancelAnimationFrame(frame);
    element.removeEventListener("click", click, true);
    element.removeEventListener("pointerdown", pressStart, true);
    element.removeEventListener("pointerup", pressEnd, true);
    element.removeEventListener("pointercancel", pressEnd, true);
    element.removeEventListener("click", pressEnd, true);
    overlay.remove();
    element.style.position = previousPosition;
    element.style.cursor = previousCursor;
  };
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
}

function motionAttributes(config: PlayableMotionConfig): string {
  return [
    `${PLAYABLE_MOTION_ATTRIBUTES.kind}="${config.kind}"`,
    `${PLAYABLE_MOTION_ATTRIBUTES.mode}="${config.mode}"`,
    `${PLAYABLE_MOTION_ATTRIBUTES.duration}="${config.duration}"`,
    ...(config.timeoutDuration === undefined
      ? []
      : [
          `${PLAYABLE_MOTION_ATTRIBUTES.timeoutDuration}="${config.timeoutDuration}"`,
        ]),
    ...(config.signal
      ? [
          `${PLAYABLE_MOTION_ATTRIBUTES.signal}="${escapeAttribute(config.signal)}"`,
        ]
      : []),
    ...(config.timeoutSignal
      ? [
          `${PLAYABLE_MOTION_ATTRIBUTES.timeoutSignal}="${escapeAttribute(config.timeoutSignal)}"`,
        ]
      : []),
  ].join(" ");
}
