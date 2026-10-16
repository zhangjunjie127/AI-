import { offsetOf, startTagEnd } from "./playable-text-edit.js";
import { annotatePlayableSourceLocations } from "./playable-source-locations.js";
import type { PlayableSourceLocation } from "./playable-text-edit.js";
import type { PlayableNodeContext } from "./playable-nodes.js";

export type PlayableMotionKind =
  | "countdown"
  | "progress-ring"
  | "progress-bar"
  | "hold-charge";

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
  asset: "data-putenggame-button-asset",
} as const;

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
    if (existing) next = `${next.slice(0, existing.index)}${next.slice(existing.index + existing[0].length)}`;
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

export function mountPlayableMotionElement(
  element: HTMLElement,
  context: PlayableNodeContext,
): () => void {
  const cleanups: (() => void)[] = [];
  const assetId = element.getAttribute(PLAYABLE_MOTION_ATTRIBUTES.asset);
  if (assetId) {
    try {
      const previous = element.style.backgroundImage;
      const previousSize = element.style.backgroundSize;
      const previousPosition = element.style.backgroundPosition;
      const previousRepeat = element.style.backgroundRepeat;
      element.style.backgroundImage = `url("${context.assets.url(assetId)}")`;
      element.style.backgroundSize = "contain";
      element.style.backgroundPosition = "center";
      element.style.backgroundRepeat = "no-repeat";
      cleanups.push(() => {
        element.style.backgroundImage = previous;
        element.style.backgroundSize = previousSize;
        element.style.backgroundPosition = previousPosition;
        element.style.backgroundRepeat = previousRepeat;
      });
    } catch {
      // An undeclared button asset should not prevent the scene from mounting.
    }
  }
  const config = parsePlayableMotionConfig(element);
  if (config) cleanups.push(mountMotion(element, config, context));
  return () => cleanups.forEach((cleanup) => cleanup());
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
  if (computedStyle.position === "static")
    element.style.position = "relative";
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
    else emit(config.timeoutSignal);
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
    if (config.signal && element.getAttribute("data-signal") === config.signal) {
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
      ? [`${PLAYABLE_MOTION_ATTRIBUTES.signal}="${escapeAttribute(config.signal)}"`]
      : []),
    ...(config.timeoutSignal
      ? [
          `${PLAYABLE_MOTION_ATTRIBUTES.timeoutSignal}="${escapeAttribute(config.timeoutSignal)}"`,
        ]
      : []),
  ].join(" ");
}

