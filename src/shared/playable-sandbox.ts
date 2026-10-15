import type { CompiledPlayableSurface } from "./playable-compiled.js";
import type { PlayableCleanup, PlayableNodeContext } from "./playable-nodes.js";
import {
  describePlayableSourceTarget,
  describePlayableAppearanceTarget,
  describePlayablePick,
  type PlayablePickResult,
} from "./playable-picker.js";
import {
  parsePlayableRotation,
  parsePlayableScale,
  parsePlayableTranslate,
  roundRotation,
  roundScale,
  playableTranslateValue,
  roundOffset,
  type PlayableTransform,
  type PlayableTranslate,
} from "./playable-move.js";
import type {
  PlayableDeleteEdit,
  PlayableMove,
  PlayablePreviewTool,
  PlayableTextEdit,
  PlayableTextCreate,
  PlayableTextSelection,
  PlayableInteractionSelection,
  PlayableAppearanceTimingUpdate,
  PlayableMediaCommand,
  PlayableMediaState,
  PlayableTransformEdit,
} from "./playable-player-protocol.js";
import {
  PLAYABLE_BACKDROP_GRAIN_VARIABLE,
  PLAYABLE_BACKDROP_VIGNETTE_VARIABLE,
  type PlayableBackdropEffects,
} from "./playable-backdrop-effects.js";
import { PLAYABLE_SOURCE_ATTRIBUTE } from "./playable-source-locations.js";
import type {
  PlayableMountedSurface,
  PlayableSurfaceHost,
} from "./playable-runtime.js";

export const PLAYABLE_SANDBOX_CSP =
  "default-src 'none'; img-src data: blob:; media-src data: blob:; font-src data: blob:; style-src 'unsafe-inline'; script-src 'self' blob:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
export const PLAYABLE_IFRAME_SANDBOX = "allow-scripts";

export interface PlayableSurfaceModule {
  mount(context: PlayableNodeContext): unknown;
}

export type PlayableModuleLoader = (javascript: string) => Promise<unknown>;

export class DocumentPlayableSurfaceHost implements PlayableSurfaceHost {
  readonly #document: Document;
  readonly #loadModule: PlayableModuleLoader;
  readonly #projectRoot: HTMLElement;
  readonly #nodeLayer: HTMLElement;
  #picking?: {
    stop: () => void;
    delete: (pick: PlayablePickResult) => void;
  };
  #mediaListener?: (state: PlayableMediaState) => void;
  #mediaBindings = new WeakSet<HTMLVideoElement>();
  #mediaObservers: MutationObserver[] = [];
  #surfaceStartedAt = new WeakMap<HTMLElement, number>();
  #timingTimer?: number;
  #backdropEffects?: PlayableBackdropEffects;

  constructor(
    document: Document,
    loadModule: PlayableModuleLoader = loadPlayableModule,
  ) {
    this.#document = document;
    this.#loadModule = loadModule;
    assertPlayableSandboxDocument(document);
    installPlayableSandboxCsp(document);
    const scaffold = createSandboxScaffold(document);
    this.#projectRoot = scaffold.projectRoot;
    this.#nodeLayer = scaffold.nodeLayer;
  }

  mountNode(
    surface: CompiledPlayableSurface,
    context: Omit<PlayableNodeContext, "root">,
  ): Promise<PlayableMountedSurface> {
    return this.#mount(this.#nodeLayer, surface, context);
  }

  setMediaStateListener(
    listener: ((state: PlayableMediaState) => void) | undefined,
  ): void {
    this.#mediaListener = listener;
    this.#syncMedia();
  }

  controlMedia(command: PlayableMediaCommand): void {
    const video =
      this.#mediaVideos().find((candidate) => !candidate.paused) ??
      this.#mediaVideos()[0];
    if (!video) return;
    if (command.command === "seek") {
      video.currentTime = Math.min(
        Math.max(0, command.time),
        Number.isFinite(video.duration) ? video.duration : command.time,
      );
      this.#emitMediaState(video);
      return;
    }
    if (command.command === "pause") {
      video.pause();
      this.#emitMediaState(video);
      return;
    }
    void video.play().catch(() => this.#emitMediaState(video));
  }

  setBackdropEffects(effects: PlayableBackdropEffects): void {
    this.#backdropEffects = { ...effects };
    for (const host of this.#projectRoot.querySelectorAll<HTMLElement>(
      "[data-playable-surface]",
    )) {
      this.#applyBackdropEffects(host, effects);
    }
  }

  destroy(): void {
    this.stopPicking();
    if (this.#timingTimer !== undefined)
      this.#document.defaultView!.clearTimeout(this.#timingTimer);
    for (const observer of this.#mediaObservers) observer.disconnect();
    this.#mediaObservers = [];
    this.#mediaListener = undefined;
    this.#projectRoot.remove();
  }

  /**
   * Hands the preview's input to an authoring tool until it is stopped. The
   * element under the pointer is outlined and surfaces receive no pointer or
   * keyboard input. With `select`, each click reports an element; holding
   * Shift, Command, or Control adds it to the selection, and dragging across
   * the preview selects every visible source element inside the rectangle.
   * With `text`, a click
   * makes an element's text editable in place; Enter or leaving the element
   * reports the edit and Escape reverts it. With `move`, dragging an element
   * moves it and reports where it ended up; Escape during a drag puts it
   * back. Escape otherwise cancels the tool.
   */
  startPicking(
    tool: PlayablePreviewTool,
    handlers: {
      onPick: (result: PlayablePickResult, additive: boolean) => void;
      onTextSelect: (selection: PlayableTextSelection) => void;
      onInteractionSelect: (
        selection: PlayableInteractionSelection,
        additive: boolean,
      ) => void;
      onTextEdit: (edit: PlayableTextEdit) => void;
      onTextCreate: (text: PlayableTextCreate) => void;
      onMove: (move: PlayableMove) => void;
      onTransform: (edit: PlayableTransformEdit) => void;
      onDelete: (edit: PlayableDeleteEdit) => void;
      onCancel: () => void;
    },
  ): void {
    this.stopPicking();
    const view = this.#document.defaultView!;
    const outline = this.#document.createElement("div");
    outline.dataset.playablePickOutline = "true";
    Object.assign(outline.style, {
      position: "absolute",
      zIndex: "2",
      pointerEvents: "none",
      boxSizing: "border-box",
      border: "2px solid #4f8cff",
      background: tool === "text" ? "transparent" : "rgba(79, 140, 255, 0.12)",
      display: "none",
    });
    const handles =
      tool === "select" ? createTransformHandles(this.#document) : [];
    outline.append(...handles);
    this.#projectRoot.append(outline);
    const selectionOutlines = new Map<string, HTMLDivElement>();
    const marquee = this.#document.createElement("div");
    marquee.dataset.playablePickMarquee = "true";
    Object.assign(marquee.style, {
      position: "absolute",
      zIndex: "4",
      pointerEvents: "none",
      boxSizing: "border-box",
      border: "1px dashed #4f8cff",
      background: "rgba(79, 140, 255, 0.12)",
      display: "none",
    });
    this.#projectRoot.append(marquee);
    const previousCursor = this.#projectRoot.style.cursor;
    const idleCursor =
      tool === "text" ? "text" : tool === "move" ? "grab" : "crosshair";
    this.#projectRoot.style.cursor = idleCursor;
    let editing: TextEditing | undefined;
    let dragging: Dragging | undefined;
    let selected: SelectedElement | undefined;
    let selectedElements: SelectedElement[] = [];
    let transforming: Transforming | undefined;
    let marqueeDrag: MarqueeDrag | undefined;
    let pendingClickPath: readonly EventTarget[] | undefined;
    let textSequence = 0;

    const inside = (event: Event) =>
      Boolean(editing && event.composedPath().includes(editing.element));
    const block = (event: Event) => {
      // Input to the element being edited keeps its default action, such as
      // typing, but still never reaches the surface's own listeners.
      if (!inside(event)) event.preventDefault();
      event.stopImmediatePropagation();
    };
    const place = (box: PlayablePickResult["box"] | undefined) => {
      if (!box) {
        outline.style.display = "none";
        return;
      }
      const root = this.#projectRoot.getBoundingClientRect();
      Object.assign(outline.style, {
        display: "block",
        left: `${box.x - root.x}px`,
        top: `${box.y - root.y}px`,
        width: `${box.width}px`,
        height: `${box.height}px`,
      });
    };
    const placeSelectionBox = (
      target: HTMLElement,
      box: PlayablePickResult["box"] | undefined,
    ) => {
      if (!box) {
        target.style.display = "none";
        return;
      }
      const root = this.#projectRoot.getBoundingClientRect();
      Object.assign(target.style, {
        display: "block",
        left: `${box.x - root.x}px`,
        top: `${box.y - root.y}px`,
        width: `${box.width}px`,
        height: `${box.height}px`,
      });
    };
    const selectionKey = (pick: PlayablePickResult) =>
      `${pick.nodeId}:${pick.cssPath}`;
    const createSelectionOutline = () => {
      const target = this.#document.createElement("div");
      target.dataset.playablePickOutline = "multiple";
      Object.assign(target.style, {
        position: "absolute",
        zIndex: "2",
        pointerEvents: "none",
        boxSizing: "border-box",
        border: "2px solid #4f8cff",
        background: "rgba(79, 140, 255, 0.08)",
        display: "none",
      });
      this.#projectRoot.append(target);
      return target;
    };
    const placeSelectionOutlines = () => {
      const activeKey = selected ? selectionKey(selected.pick) : undefined;
      const currentKeys = new Set(
        selectedElements
          .filter((item) => selectionKey(item.pick) !== activeKey)
          .map((item) => selectionKey(item.pick)),
      );
      for (const [key, target] of selectionOutlines) {
        if (!currentKeys.has(key)) {
          target.remove();
          selectionOutlines.delete(key);
        }
      }
      for (const item of selectedElements) {
        const key = selectionKey(item.pick);
        if (key === activeKey) continue;
        const target = selectionOutlines.get(key) ?? createSelectionOutline();
        selectionOutlines.set(key, target);
        placeSelectionBox(target, selectedBox(item.element));
      }
      place(selected ? selectedBox(selected.element) : undefined);
    };
    const placeSelected = () => placeSelectionOutlines();
    const placeMarquee = () => {
      const current = marqueeDrag;
      if (!current) {
        marquee.style.display = "none";
        return;
      }
      const box = rectangle(current.start, current.current);
      const root = this.#projectRoot.getBoundingClientRect();
      Object.assign(marquee.style, {
        display: "block",
        left: `${box.x - root.x}px`,
        top: `${box.y - root.y}px`,
        width: `${box.width}px`,
        height: `${box.height}px`,
      });
    };
    const hover = (event: Event) => {
      block(event);
      if (editing) return;
      if (transforming) return dragTransform(event as PointerEvent);
      if (dragging) return drag(event as PointerEvent);
      if (marqueeDrag) {
        const pointer = event as PointerEvent;
        if (pointer.pointerId === marqueeDrag.pointerId) {
          marqueeDrag.current = { x: pointer.clientX, y: pointer.clientY };
          placeMarquee();
        }
        return;
      }
      if (tool === "select" && selected) return placeSelected();
      if (tool === "move")
        return place(movableTarget(event.composedPath())?.pick.box);
      const pick = describePlayablePick(event.composedPath());
      const target = event.composedPath()[0];
      if (pick && tool === "select" && !pick.source) {
        place(undefined);
        return;
      }
      const sourceTarget = describePlayableSourceTarget(event.composedPath());
      if (
        sourceTarget?.pick.mediaSlot === "backdrop" ||
        pick?.mediaSlot === "backdrop"
      ) {
        place(undefined);
        return;
      }
      place(
        pick && (tool === "select" || isTextTarget(target))
          ? pick.box
          : undefined,
      );
    };
    const finish = (commit: boolean) => {
      const current = editing;
      if (!current) return;
      editing = undefined;
      const { element, pick, before, inPlace } = current;
      element.removeEventListener("blur", current.onBlur);
      element.removeAttribute("contenteditable");
      const after = (element.textContent ?? "").trim();
      const changed = commit && after && after !== before.trim();
      if (current.creation) {
        if (changed)
          handlers.onTextCreate({ ...current.creation, text: after });
        else element.remove();
        place(undefined);
        return;
      }
      // Text the Agent will change goes back to what the source says until it does.
      if (!changed || !inPlace) element.textContent = current.original;
      place(undefined);
      if (changed) handlers.onTextEdit({ pick, before, after, inPlace });
    };
    const createText = (event: Event) => {
      block(event);
      if (tool !== "text" || editing) return;
      const path = event.composedPath();
      const surfaceIndex = path.findIndex(
        (target) =>
          target instanceof HTMLElement &&
          target.hasAttribute("data-playable-surface"),
      );
      if (surfaceIndex < 0) return;
      const inside = path
        .slice(0, surfaceIndex)
        .filter(
          (target): target is HTMLElement => target instanceof HTMLElement,
        );
      if (
        inside.some(
          (element) =>
            !isBackdropElement(element) &&
            (isFrameText(element) ||
              isFrameMedia(element) ||
              isFrameInteraction(element)),
        )
      )
        return;
      const surface = path[surfaceIndex] as HTMLElement;
      const parent = Array.from(surface.shadowRoot?.children ?? []).find(
        (element) => element.tagName.toLowerCase() !== "style",
      ) as HTMLElement | undefined;
      const bounds = surface.getBoundingClientRect();
      if (
        !parent ||
        !bounds.width ||
        !bounds.height ||
        !surface.dataset.playableSurface
      )
        return;
      const mouse = event as MouseEvent;
      const creation = {
        id: `putenggame-text-${Date.now()}-${++textSequence}`,
        nodeId: surface.dataset.playableSurface,
        x: Math.max(
          0,
          Math.min(100, ((mouse.clientX - bounds.left) / bounds.width) * 100),
        ),
        y: Math.max(
          0,
          Math.min(100, ((mouse.clientY - bounds.top) / bounds.height) * 100),
        ),
      };
      const element = this.#document.createElement("p");
      element.id = creation.id;
      Object.assign(element.style, {
        position: "absolute",
        left: `${creation.x}cqw`,
        top: `${creation.y}cqh`,
        margin: "0",
        minWidth: "1em",
        minHeight: "1.2em",
        whiteSpace: "pre-wrap",
      });
      parent.append(element);
      const onBlur = () => finish(true);
      editing = {
        element,
        pick: {
          nodeId: creation.nodeId,
          cssPath: `#${creation.id}`,
          tag: "p",
          text: "",
          box: selectedBox(element),
        },
        original: "",
        before: "",
        inPlace: false,
        creation,
        onBlur,
      };
      element.setAttribute("contenteditable", "plaintext-only");
      element.addEventListener("blur", onBlur);
      element.focus();
      place(selectedBox(element));
    };
    const press = (event: Event) => {
      const pointer = event as PointerEvent;
      const handle = transformHandle(event.composedPath());
      if (tool === "select" && handle && selected && pointer.button === 0) {
        block(event);
        startTransform(handle.kind, pointer);
        return;
      }
      block(event);
      if (tool === "select" && pointer.button === 0 && !transforming) {
        pendingClickPath = undefined;
        marqueeDrag = {
          pointerId: pointer.pointerId,
          start: { x: pointer.clientX, y: pointer.clientY },
          current: { x: pointer.clientX, y: pointer.clientY },
          additive: pointer.shiftKey || pointer.metaKey || pointer.ctrlKey,
          targetPath: event.composedPath(),
        };
        this.#projectRoot.setPointerCapture?.(pointer.pointerId);
        placeMarquee();
        return;
      }
      if (tool !== "move" || dragging || pointer.button !== 0) return;
      const target = movableTarget(event.composedPath());
      const root = target?.element.getRootNode();
      const size =
        root instanceof ShadowRoot
          ? root.host.getBoundingClientRect()
          : undefined;
      if (!target || !size?.width || !size.height) return;
      const { element } = target;
      const original = {
        translate: element.style.translate,
        transition: element.style.transition,
      };
      const base = parsePlayableTranslate(original.translate, size);
      dragging = {
        ...target,
        pointerId: pointer.pointerId,
        start: { x: pointer.clientX, y: pointer.clientY },
        delta: { x: 0, y: 0 },
        size: { width: size.width, height: size.height },
        base: base ?? { x: 0, y: 0 },
        original,
        inPlace:
          base !== undefined && element.hasAttribute(PLAYABLE_SOURCE_ATTRIBUTE),
      };
      // A transition on the element would make it trail the pointer.
      element.style.transition = "none";
      element.setPointerCapture(pointer.pointerId);
      this.#projectRoot.style.cursor = "grabbing";
    };
    const drag = (pointer: PointerEvent) => {
      const current = dragging;
      if (!current || pointer.pointerId !== current.pointerId) return;
      const delta = {
        x: pointer.clientX - current.start.x,
        y: pointer.clientY - current.start.y,
      };
      current.delta = delta;
      current.element.style.translate = `calc(${current.base.x}cqw + ${delta.x}px) calc(${current.base.y}cqh + ${delta.y}px)`;
      place({
        ...current.pick.box,
        x: current.pick.box.x + delta.x,
        y: current.pick.box.y + delta.y,
      });
    };
    const endDrag = (commit: boolean) => {
      const current = dragging;
      if (!current) return;
      dragging = undefined;
      const { element, delta, size, base, original } = current;
      if (element.hasPointerCapture(current.pointerId))
        element.releasePointerCapture(current.pointerId);
      this.#projectRoot.style.cursor = idleCursor;
      const moved = commit && Math.hypot(delta.x, delta.y) >= MOVE_THRESHOLD;
      const translate = {
        x: roundOffset(base.x + (delta.x / size.width) * 100),
        y: roundOffset(base.y + (delta.y / size.height) * 100),
      };
      const inPlace = current.inPlace && !overridesTranslate(element);
      // The source will say the same once the preview reloads; a move the Agent makes goes back until it does.
      element.style.translate =
        moved && inPlace
          ? (playableTranslateValue(translate) ?? "")
          : original.translate;
      element.style.transition = original.transition;
      place(undefined);
      if (moved) handlers.onMove({ pick: current.pick, translate, inPlace });
    };
    const startTransform = (
      kind: TransformHandleKind,
      pointer: PointerEvent,
    ) => {
      if (!selected || transforming) return;
      const element = selected.element;
      const computed = view.getComputedStyle(element);
      const box = selectedBox(element);
      const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      const original = {
        scale: element.style.scale,
        rotate: element.style.rotate,
        transition: element.style.transition,
      };
      transforming = {
        kind,
        element,
        pick: selected.pick,
        pointerId: pointer.pointerId,
        start: { x: pointer.clientX, y: pointer.clientY },
        box,
        center,
        base: {
          scale: parsePlayableScale(element.style.scale || computed.scale),
          rotation: parsePlayableRotation(
            element.style.rotate || computed.rotate,
          ),
        },
        transform: {
          scale: parsePlayableScale(element.style.scale || computed.scale),
          rotation: parsePlayableRotation(
            element.style.rotate || computed.rotate,
          ),
        },
        original,
        inPlace: element.hasAttribute(PLAYABLE_SOURCE_ATTRIBUTE),
      };
      element.style.transition = "none";
      element.setPointerCapture(pointer.pointerId);
      this.#projectRoot.style.cursor =
        kind === "rotate" ? "crosshair" : "nwse-resize";
    };
    const dragTransform = (pointer: PointerEvent) => {
      const current = transforming;
      if (!current || pointer.pointerId !== current.pointerId) return;
      if (current.kind === "rotate") {
        const startAngle = Math.atan2(
          current.start.y - current.center.y,
          current.start.x - current.center.x,
        );
        const nextAngle = Math.atan2(
          pointer.clientY - current.center.y,
          pointer.clientX - current.center.x,
        );
        const delta = ((nextAngle - startAngle) * 180) / Math.PI;
        current.transform.rotation = roundRotation(
          current.base.rotation + delta,
        );
        current.element.style.rotate = `${current.transform.rotation}deg`;
      } else {
        const dx = Math.abs(pointer.clientX - current.center.x);
        const dy = Math.abs(pointer.clientY - current.center.y);
        const startDx = Math.max(1, current.box.width / 2);
        const startDy = Math.max(1, current.box.height / 2);
        const factor = Math.max(dx / startDx, dy / startDy);
        current.transform.scale = roundScale(
          current.base.scale * Math.max(0.05, factor),
        );
        current.element.style.scale = String(current.transform.scale);
      }
      place(selectedBox(current.element));
    };
    const endTransform = (commit: boolean) => {
      const current = transforming;
      if (!current) return;
      transforming = undefined;
      if (current.element.hasPointerCapture(current.pointerId))
        current.element.releasePointerCapture(current.pointerId);
      this.#projectRoot.style.cursor = idleCursor;
      const changed =
        commit &&
        (current.transform.scale !== current.base.scale ||
          current.transform.rotation !== current.base.rotation);
      const inPlace = current.inPlace && !overridesTransform(current.element);
      current.element.style.scale =
        changed && inPlace
          ? String(current.transform.scale)
          : current.original.scale;
      current.element.style.rotate =
        changed && inPlace
          ? `${current.transform.rotation}deg`
          : current.original.rotate;
      current.element.style.transition = current.original.transition;
      if (changed) {
        placeSelected();
        handlers.onTransform({
          pick: current.pick,
          transform: current.transform,
          inPlace,
        });
      } else {
        placeSelected();
      }
    };
    const release = (event: Event) => {
      block(event);
      const pointer = event as PointerEvent;
      if (pointer.pointerId === transforming?.pointerId)
        return endTransform(event.type === "pointerup");
      if (pointer.pointerId === dragging?.pointerId)
        endDrag(event.type === "pointerup");
      if (pointer.pointerId === marqueeDrag?.pointerId)
        endMarquee(event.type === "pointerup");
    };
    const endMarquee = (commit: boolean) => {
      const current = marqueeDrag;
      if (!current) return;
      marqueeDrag = undefined;
      if (this.#projectRoot.hasPointerCapture?.(current.pointerId))
        this.#projectRoot.releasePointerCapture(current.pointerId);
      marquee.style.display = "none";
      if (!commit) return;
      const box = rectangle(current.start, current.current);
      if (box.width < MOVE_THRESHOLD && box.height < MOVE_THRESHOLD) {
        // Pointer capture can retarget the following click to the project
        // root. Keep the original hit path so a click still selects the item.
        pendingClickPath = current.targetPath;
        return;
      }
      const frameTargets = selectableSourceTargets(this.#projectRoot);
      const targets = frameTargets.flatMap((element) => {
        const pick = pickForElement(element);
        return pick?.source &&
          pick.mediaSlot !== "backdrop" &&
          intersects(box, pick.box)
          ? [{ element, pick }]
          : [];
      });
      if (!targets.length) return;
      if (!current.additive) selectedElements = [];
      targets.forEach(({ element, pick }, index) => {
        const additive = current.additive || index > 0;
        handlers.onPick(pick, additive);
        const appearance = interactionForElement(element);
        if (appearance) handlers.onInteractionSelect(appearance, additive);
        const key = selectionKey(pick);
        const existing = selectedElements.some(
          (item) => selectionKey(item.pick) === key,
        );
        if (current.additive && existing) {
          selectedElements = selectedElements.filter(
            (item) => selectionKey(item.pick) !== key,
          );
        } else if (!existing) {
          selectedElements = [...selectedElements, { element, pick }];
        }
      });
      selected = selectedElements.at(-1);
      placeSelected();
    };
    const deleteSelected = () => {
      if (tool !== "select" || !selected || transforming || dragging) return;
      const current = selected;
      if (current.pick.mediaSlot === "backdrop") return;
      selectedElements = selectedElements.filter(
        (item) => selectionKey(item.pick) !== selectionKey(current.pick),
      );
      selected = selectedElements.at(-1);
      current.element.remove();
      placeSelected();
      handlers.onDelete({
        pick: current.pick,
        inPlace: Boolean(current.pick.source),
      });
    };
    const click = (event: Event) => {
      block(event);
      if (tool === "move") return;
      if (transformHandle(event.composedPath())) return;
      if (inside(event)) return;
      finish(true);
      const eventPath = event.composedPath();
      const path = describePlayablePick(eventPath)
        ? eventPath
        : pendingClickPath;
      pendingClickPath = undefined;
      const pick = path ? describePlayablePick(path) : undefined;
      if (!pick) return;
      if (tool === "select") {
        const mouse = event as MouseEvent;
        const appearance = path
          ? describePlayableAppearanceTarget(path)
          : undefined;
        const sourceTarget = path
          ? describePlayableSourceTarget(path)
          : undefined;
        const selectedPick = sourceTarget?.pick ?? pick;
        if (selectedPick.mediaSlot === "backdrop") return;
        const additive = mouse.shiftKey || mouse.metaKey || mouse.ctrlKey;
        handlers.onPick(selectedPick, additive);
        const selectedElement =
          (sourceTarget?.element as HTMLElement | undefined) ??
          path?.find(
            (target): target is HTMLElement =>
              target instanceof HTMLElement &&
              target.getAttribute("data-playable-surface") === null,
          );
        if (selectedElement) {
          const next = { element: selectedElement, pick: selectedPick };
          const key = selectionKey(next.pick);
          const existing = selectedElements.some(
            (item) => selectionKey(item.pick) === key,
          );
          if (!additive) selectedElements = [next];
          else if (existing)
            selectedElements = selectedElements.filter(
              (item) => selectionKey(item.pick) !== key,
            );
          else selectedElements = [...selectedElements, next];
          selected = selectedElements.at(-1);
          placeSelected();
        } else if (!additive) {
          selectedElements = [];
          selected = undefined;
          placeSelected();
        }
        if (appearance) {
          const element = appearance.element as Element;
          const computed = view.getComputedStyle(element);
          const rawDelay =
            element instanceof HTMLElement
              ? element.style.getPropertyValue("--putenggame-appear-at") ||
                computed.getPropertyValue("--putenggame-appear-at") ||
                element.style.getPropertyValue("--delay") ||
                computed.getPropertyValue("--delay") ||
                computed.animationDelay
              : computed.getPropertyValue("--putenggame-appear-at") ||
                computed.getPropertyValue("--delay") ||
                computed.animationDelay;
          const rawEnd =
            element instanceof HTMLElement
              ? element.style.getPropertyValue("--putenggame-disappear-at") ||
                computed.getPropertyValue("--putenggame-disappear-at")
              : computed.getPropertyValue("--putenggame-disappear-at");
          const endSeconds = parseOptionalTimingSeconds(rawEnd);
          handlers.onInteractionSelect(
            {
              pick: appearance.pick,
              delaySeconds: parseDelaySeconds(rawDelay),
              ...(endSeconds === undefined ? {} : { endSeconds }),
              inPlace: Boolean(appearance.pick.source),
            },
            additive,
          );
        }
        return;
      }
      const target = event.composedPath()[0];
      if (!isTextTarget(target)) return;
      const element = target as HTMLElement;
      const original = element.textContent ?? "";
      const onBlur = () => finish(true);
      const inPlace = holdsSourceText(element);
      const computed = view.getComputedStyle(element);
      handlers.onTextSelect({
        pick,
        fontFamily:
          computed.fontFamily
            .split(",")[0]
            ?.trim()
            .replace(/^['"]|['"]$/g, "") || "sans-serif",
        fontSize: computed.fontSize,
        inPlace,
      });
      editing = {
        element,
        pick,
        original,
        before: original.replace(/\s+/g, " ").trim(),
        inPlace,
        onBlur,
      };
      element.setAttribute("contenteditable", "plaintext-only");
      element.addEventListener("blur", onBlur);
      element.focus();
      view.getSelection()?.selectAllChildren(element);
      place(pick.box);
    };
    const key = (event: Event) => {
      const keyboard = event as KeyboardEvent;
      if (editing) {
        block(event);
        if (keyboard.key === "Enter" && !keyboard.shiftKey) {
          keyboard.preventDefault();
          finish(true);
        } else if (keyboard.key === "Escape") {
          keyboard.preventDefault();
          finish(false);
        }
        return;
      }
      block(event);
      if (keyboard.key === "Delete" && tool === "select" && selected) {
        keyboard.preventDefault();
        deleteSelected();
        return;
      }
      if (keyboard.key !== "Escape") return;
      if (dragging) return endDrag(false);
      if (transforming) return endTransform(false);
      if (marqueeDrag) return endMarquee(false);
      this.stopPicking();
      handlers.onCancel();
    };
    const leavePreview = () => (marqueeDrag ? placeMarquee() : placeSelected());
    const listeners: Array<[string, (event: Event) => void]> = [
      ["pointermove", hover],
      ["pointerover", hover],
      ["pointerdown", press],
      ["pointerup", release],
      ["pointercancel", release],
      ["dblclick", createText],
      ["click", click],
      ["keydown", key],
      ...BLOCKED_PICK_EVENTS.map(
        (type) => [type, block] as [string, (event: Event) => void],
      ),
    ];
    for (const [type, listener] of listeners)
      view.addEventListener(type, listener, { capture: true });
    this.#projectRoot.addEventListener("pointerleave", leavePreview);
    this.#picking = {
      delete: (pick) => {
        const key = selectionKey(pick);
        const current = selectedElements.find(
          (item) => selectionKey(item.pick) === key,
        );
        if (!current) return;
        current.element.remove();
        selectedElements = selectedElements.filter(
          (item) => selectionKey(item.pick) !== key,
        );
        selected = selectedElements.at(-1);
        placeSelected();
      },
      stop: () => {
        finish(true);
        endTransform(false);
        endDrag(false);
        for (const [type, listener] of listeners)
          view.removeEventListener(type, listener, { capture: true });
        this.#projectRoot.removeEventListener("pointerleave", leavePreview);
        outline.remove();
        for (const target of selectionOutlines.values()) target.remove();
        selectionOutlines.clear();
        marquee.remove();
        this.#projectRoot.style.cursor = previousCursor;
      },
    };
  }

  stopPicking(): void {
    const picking = this.#picking;
    this.#picking = undefined;
    picking?.stop();
  }

  deletePicked(pick: PlayablePickResult): void {
    this.#picking?.delete(pick);
  }

  setTextSource(id: string, source: string | undefined): void {
    for (const surface of this.#nodeLayer.querySelectorAll<HTMLElement>(
      "[data-playable-surface]",
    )) {
      const element = surface.shadowRoot?.getElementById(id);
      if (!element) continue;
      if (source) element.setAttribute(PLAYABLE_SOURCE_ATTRIBUTE, source);
      else element.remove();
    }
  }

  updateAppearanceTiming(
    updates: readonly PlayableAppearanceTimingUpdate[],
  ): void {
    for (const { pick, delaySeconds, endSeconds } of updates) {
      if (
        !Number.isFinite(delaySeconds) ||
        delaySeconds < 0 ||
        delaySeconds > 3600 ||
        (endSeconds !== undefined &&
          (!Number.isFinite(endSeconds) ||
            endSeconds <= delaySeconds ||
            endSeconds > 3600)) ||
        pick.tag === "video"
      )
        continue;

      for (const surface of this.#nodeLayer.querySelectorAll<HTMLElement>(
        "[data-playable-surface]",
      )) {
        if (surface.dataset.playableSurface !== pick.nodeId) continue;
        const root = surface.shadowRoot;
        if (!root) continue;
        let target: HTMLElement | undefined;
        try {
          const candidate = root.querySelector<HTMLElement>(pick.cssPath);
          if (
            candidate?.tagName.toLowerCase() === pick.tag &&
            candidate.getAttribute(PLAYABLE_SOURCE_ATTRIBUTE) === pick.source &&
            !isBackdropElement(candidate)
          )
            target = candidate;
        } catch {
          continue;
        }
        if (!target) continue;

        target.classList.add("rise");
        target.style.setProperty("--delay", "0s");
        target.style.setProperty(
          "--putenggame-appear-at",
          `${Math.round(delaySeconds * 10) / 10}s`,
        );
        if (endSeconds === undefined)
          target.style.removeProperty("--putenggame-disappear-at");
        else
          target.style.setProperty(
            "--putenggame-disappear-at",
            `${Math.round(endSeconds * 10) / 10}s`,
          );
        break;
      }
    }
    this.#updateTimedVisibility();
  }

  async #mount(
    layer: HTMLElement,
    surface: CompiledPlayableSurface,
    context: Omit<PlayableNodeContext, "root">,
  ): Promise<PlayableMountedSurface> {
    const host = this.#document.createElement("div");
    host.dataset.playableSurface = surface.id;
    host.style.width = "100%";
    host.style.height = "100%";
    const root = host.attachShadow({ mode: "open" });
    const style = this.#document.createElement("style");
    style.textContent = `${surface.css}
[data-playable-timing-hidden] {
  visibility: hidden !important;
  pointer-events: none !important;
}`;
    const template = this.#document.createElement("template");
    template.innerHTML = surface.html;
    root.append(style, template.content.cloneNode(true));
    if (this.#backdropEffects)
      this.#applyBackdropEffects(host, this.#backdropEffects);
    for (const element of root.querySelectorAll<HTMLElement>(
      "[style*='--putenggame-appear-at'], [style*='--putenggame-disappear-at']",
    ))
      element.style.setProperty("--delay", "0s");
    this.#surfaceStartedAt.set(
      host,
      this.#document.defaultView!.performance.now(),
    );
    layer.append(host);
    this.#updateTimedVisibility();

    try {
      const module = await this.#loadModule(surface.javascript);
      if (!isPlayableSurfaceModule(module))
        throw new Error(
          `Playable surface "${surface.id}" does not export a mount function.`,
        );
      const cleanup = await module.mount({ ...context, root });
      this.#observeMedia(root);
      return {
        cleanup: cleanup as PlayableCleanup | undefined,
        destroy: () => host.remove(),
      };
    } catch (cause) {
      host.remove();
      throw cause;
    }
  }

  #applyBackdropEffects(
    host: HTMLElement,
    effects: PlayableBackdropEffects,
  ): void {
    const root = host.shadowRoot;
    if (!root) return;
    let style = root.querySelector<HTMLStyleElement>(
      "style[data-playable-backdrop-effects]",
    );
    if (!style) {
      style = this.#document.createElement("style");
      style.dataset.playableBackdropEffects = "true";
      root.append(style);
    }
    style.textContent = `:host {\n  ${PLAYABLE_BACKDROP_VIGNETTE_VARIABLE}: ${effects.vignette ? `var(${PLAYABLE_BACKDROP_VIGNETTE_VARIABLE}-source)` : "none"};\n  ${PLAYABLE_BACKDROP_GRAIN_VARIABLE}: ${effects.grain ? `var(${PLAYABLE_BACKDROP_GRAIN_VARIABLE}-source)` : "none"};\n}`;
  }

  #observeMedia(root: ShadowRoot): void {
    const observer = new MutationObserver(() => this.#syncMedia());
    observer.observe(root, { childList: true, subtree: true });
    this.#mediaObservers.push(observer);
    this.#syncMedia();
  }

  #mediaVideos(): HTMLVideoElement[] {
    const roots: (Document | ShadowRoot)[] = [this.#document];
    for (let index = 0; index < roots.length; index += 1) {
      for (const element of Array.from(roots[index]!.querySelectorAll("*"))) {
        if (element.shadowRoot) roots.push(element.shadowRoot);
      }
    }
    return roots.flatMap((root) => Array.from(root.querySelectorAll("video")));
  }

  #syncMedia(): void {
    const videos = this.#mediaVideos();
    for (const video of videos) {
      if (this.#mediaBindings.has(video)) continue;
      this.#mediaBindings.add(video);
      for (const type of [
        "timeupdate",
        "seeking",
        "seeked",
        "loadedmetadata",
        "durationchange",
        "play",
        "pause",
        "ended",
      ])
        video.addEventListener(type, () => this.#emitMediaState(video));
    }
    this.#emitMediaState(videos.find((video) => !video.paused) ?? videos[0]);
  }

  #updateTimedVisibility(): void {
    const now = this.#document.defaultView!.performance.now();
    let nextFallbackAt = Number.POSITIVE_INFINITY;
    for (const surface of this.#nodeLayer.querySelectorAll<HTMLElement>(
      "[data-playable-surface]",
    )) {
      const root = surface.shadowRoot;
      if (!root) continue;
      const backdrop = root.querySelector<HTMLElement>(
        '[data-media="backdrop"]',
      );
      const video =
        backdrop?.tagName.toLowerCase() === "video"
          ? (backdrop as HTMLVideoElement)
          : backdrop?.querySelector<HTMLVideoElement>("video");
      const currentTime =
        video && Number.isFinite(video.currentTime)
          ? video.currentTime
          : Math.max(
              0,
              (now - (this.#surfaceStartedAt.get(surface) ?? now)) / 1000,
            );
      for (const element of root.querySelectorAll<HTMLElement>(
        "[style*='--putenggame-appear-at'], [style*='--putenggame-disappear-at']",
      )) {
        const style = this.#document.defaultView!.getComputedStyle(element);
        const appearAt = parseDelaySeconds(
          element.style.getPropertyValue("--putenggame-appear-at") ||
            style.getPropertyValue("--putenggame-appear-at"),
        );
        const rawDisappearAt =
          element.style.getPropertyValue("--putenggame-disappear-at") ||
          style.getPropertyValue("--putenggame-disappear-at");
        const disappearAt = parseOptionalTimingSeconds(rawDisappearAt);
        if (!video) {
          const startedAt = this.#surfaceStartedAt.get(surface) ?? now;
          if (appearAt > currentTime)
            nextFallbackAt = Math.min(
              nextFallbackAt,
              startedAt + appearAt * 1000,
            );
          if (disappearAt !== undefined && disappearAt > currentTime)
            nextFallbackAt = Math.min(
              nextFallbackAt,
              startedAt + disappearAt * 1000,
            );
        }
        const hidden =
          currentTime < appearAt ||
          (disappearAt !== undefined && currentTime >= disappearAt) ||
          (disappearAt !== undefined && disappearAt <= appearAt);
        element.toggleAttribute("data-playable-timing-hidden", hidden);
      }
    }
    if (this.#timingTimer !== undefined)
      this.#document.defaultView!.clearTimeout(this.#timingTimer);
    this.#timingTimer = Number.isFinite(nextFallbackAt)
      ? this.#document.defaultView!.setTimeout(
          () => {
            this.#timingTimer = undefined;
            this.#updateTimedVisibility();
          },
          Math.max(0, nextFallbackAt - now),
        )
      : undefined;
  }

  #emitMediaState(video: HTMLVideoElement | undefined): void {
    this.#updateTimedVisibility();
    if (!video) {
      this.#mediaListener?.({ currentTime: 0, duration: 0, paused: true });
      return;
    }
    this.#mediaListener?.({
      currentTime: Number.isFinite(video.currentTime) ? video.currentTime : 0,
      duration: Number.isFinite(video.duration) ? video.duration : 0,
      paused: video.paused,
    });
  }
}

export function assertPlayableSandboxDocument(document: Document): void {
  const view = document.defaultView;
  if (!view || view === view.top || view.origin !== "null") {
    throw new Error(
      'Playable surfaces require an opaque-origin iframe with sandbox="allow-scripts".',
    );
  }
}

export function installPlayableSandboxCsp(document: Document): void {
  const existing = document.head.querySelector<HTMLMetaElement>(
    'meta[data-playable-sandbox-csp="true"]',
  );
  if (existing) {
    if (existing.content !== PLAYABLE_SANDBOX_CSP)
      throw new Error(
        "Playable sandbox CSP does not match the Runtime policy.",
      );
    return;
  }

  const meta = document.createElement("meta");
  meta.httpEquiv = "Content-Security-Policy";
  meta.content = PLAYABLE_SANDBOX_CSP;
  meta.dataset.playableSandboxCsp = "true";
  document.head.prepend(meta);
}

export async function loadPlayableModule(javascript: string): Promise<unknown> {
  const url = URL.createObjectURL(
    new Blob([javascript], { type: "text/javascript" }),
  );
  try {
    return await import(/* @vite-ignore */ url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function createSandboxScaffold(document: Document): {
  projectRoot: HTMLElement;
  nodeLayer: HTMLElement;
} {
  document.documentElement.style.width = "100%";
  document.documentElement.style.height = "100%";
  document.body.replaceChildren();
  document.body.style.width = "100%";
  document.body.style.height = "100%";
  document.body.style.margin = "0";
  document.body.style.overflow = "hidden";

  const projectRoot = document.createElement("main");
  projectRoot.dataset.playableSandbox = "true";
  projectRoot.style.position = "relative";
  projectRoot.style.width = "100%";
  projectRoot.style.height = "100%";
  projectRoot.style.overflow = "hidden";

  const nodeLayer = document.createElement("div");
  nodeLayer.dataset.playableNodeLayer = "true";
  setLayerStyle(nodeLayer, 0);

  projectRoot.append(nodeLayer);
  document.body.append(projectRoot);
  return { projectRoot, nodeLayer };
}

interface TextEditing {
  element: HTMLElement;
  pick: PlayablePickResult;
  /** The text before editing, restored on Escape. */
  original: string;
  before: string;
  inPlace: boolean;
  creation?: Omit<PlayableTextCreate, "text">;
  onBlur: () => void;
}

interface Dragging {
  element: HTMLElement;
  /** The element before the drag started. */
  pick: PlayablePickResult;
  pointerId: number;
  start: { x: number; y: number };
  /** How far the pointer has moved, in the frame's CSS pixels. */
  delta: { x: number; y: number };
  /** The surface's size, which cqw and cqh are hundredths of. */
  size: { width: number; height: number };
  /** The offset the element had, in cqw and cqh. */
  base: PlayableTranslate;
  /** The inline values the drag replaces, restored when it is cancelled. */
  original: { translate: string; transition: string };
  inPlace: boolean;
}

type TransformHandleKind = "nw" | "ne" | "sw" | "se" | "rotate";

interface SelectedElement {
  element: HTMLElement;
  pick: PlayablePickResult;
}

interface MarqueeDrag {
  pointerId: number;
  start: { x: number; y: number };
  current: { x: number; y: number };
  additive: boolean;
  targetPath: readonly EventTarget[];
}

interface Transforming {
  kind: TransformHandleKind;
  element: HTMLElement;
  pick: PlayablePickResult;
  pointerId: number;
  start: { x: number; y: number };
  box: PlayablePickResult["box"];
  center: { x: number; y: number };
  base: PlayableTransform;
  transform: PlayableTransform;
  original: { scale: string; rotate: string; transition: string };
  inPlace: boolean;
}

function createTransformHandles(document: Document): HTMLDivElement[] {
  return (["nw", "ne", "sw", "se", "rotate"] as const).map((kind) => {
    const handle = document.createElement("div");
    handle.dataset.playableTransformHandle = kind;
    handle.setAttribute("aria-hidden", "true");
    Object.assign(handle.style, {
      position: "absolute",
      zIndex: "3",
      width: kind === "rotate" ? "10px" : "8px",
      height: kind === "rotate" ? "10px" : "8px",
      boxSizing: "border-box",
      border: "1px solid #4f8cff",
      borderRadius: "2px",
      background: "#fff",
      pointerEvents: "auto",
      ...(kind === "nw"
        ? { left: "-5px", top: "-5px", cursor: "nwse-resize" }
        : {}),
      ...(kind === "ne"
        ? { right: "-5px", top: "-5px", cursor: "nesw-resize" }
        : {}),
      ...(kind === "sw"
        ? { left: "-5px", bottom: "-5px", cursor: "nesw-resize" }
        : {}),
      ...(kind === "se"
        ? { right: "-5px", bottom: "-5px", cursor: "nwse-resize" }
        : {}),
      ...(kind === "rotate"
        ? {
            left: "50%",
            top: "-28px",
            transform: "translateX(-50%)",
            borderRadius: "50%",
            cursor: "grab",
          }
        : {}),
    });
    return handle;
  });
}

function transformHandle(
  path: readonly EventTarget[],
): { kind: TransformHandleKind; element: HTMLElement } | undefined {
  const element = path.find(
    (target): target is HTMLElement =>
      target instanceof HTMLElement &&
      typeof target.dataset.playableTransformHandle === "string",
  );
  const kind = element?.dataset.playableTransformHandle;
  return kind && isTransformHandleKind(kind) ? { kind, element } : undefined;
}

function isTransformHandleKind(value: string): value is TransformHandleKind {
  return (
    value === "nw" ||
    value === "ne" ||
    value === "sw" ||
    value === "se" ||
    value === "rotate"
  );
}

function selectedBox(element: Element): PlayablePickResult["box"] {
  const rect = element.getBoundingClientRect();
  return {
    x: Math.round(rect.x * 100) / 100,
    y: Math.round(rect.y * 100) / 100,
    width: Math.round(rect.width * 100) / 100,
    height: Math.round(rect.height * 100) / 100,
  };
}

function rectangle(
  start: { x: number; y: number },
  end: { x: number; y: number },
): PlayablePickResult["box"] {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

function intersects(
  first: PlayablePickResult["box"],
  second: PlayablePickResult["box"],
): boolean {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}

function selectableSourceTargets(root: HTMLElement): HTMLElement[] {
  const elements: HTMLElement[] = [];
  const visit = (container: Document | ShadowRoot | HTMLElement) => {
    for (const element of Array.from(
      container.querySelectorAll<HTMLElement>("*"),
    )) {
      if (element.hasAttribute(PLAYABLE_SOURCE_ATTRIBUTE))
        elements.push(element);
      if (element.shadowRoot) visit(element.shadowRoot);
    }
  };
  visit(root);
  const sourceElements = new Set(elements);
  const targets = new Set<HTMLElement>();
  for (const element of elements) {
    if (isBackdropElement(element)) continue;

    const interaction = nearestSourceAncestor(
      element,
      sourceElements,
      isFrameInteraction,
    );
    if (interaction) {
      targets.add(interaction);
      continue;
    }

    if (
      isFrameMedia(element) ||
      isFrameText(element) ||
      !hasSourceChild(element, sourceElements)
    )
      targets.add(element);
  }
  return [...targets];
}

function nearestSourceAncestor(
  element: HTMLElement,
  sourceElements: Set<HTMLElement>,
  predicate: (element: HTMLElement) => boolean,
): HTMLElement | undefined {
  let current: HTMLElement | null = element;
  while (current) {
    if (sourceElements.has(current) && predicate(current)) return current;
    current = current.parentElement;
  }
  return undefined;
}

function isBackdropElement(element: HTMLElement): boolean {
  let current: HTMLElement | null = element;
  while (current) {
    if (current.getAttribute("data-media") === "backdrop") return true;
    current = current.parentElement;
  }
  return false;
}

function isFrameInteraction(element: HTMLElement): boolean {
  const tag = element.tagName.toLowerCase();
  return (
    ["button", "a", "input", "select", "textarea"].includes(tag) ||
    element.getAttribute("role") === "button" ||
    element.hasAttribute("data-qte") ||
    [
      "data-signal",
      "data-press",
      "data-restart",
      "data-continue",
      "data-back",
    ].some((name) => element.hasAttribute(name))
  );
}

function isFrameMedia(element: HTMLElement): boolean {
  return (
    ["img", "video", "picture", "canvas", "svg"].includes(
      element.tagName.toLowerCase(),
    ) || element.hasAttribute("data-media")
  );
}

function isFrameText(element: HTMLElement): boolean {
  return Array.from(element.childNodes).some(
    (child) => child.nodeType === 3 && Boolean(child.textContent?.trim()),
  );
}

function hasSourceChild(
  element: HTMLElement,
  sourceElements: Set<HTMLElement>,
): boolean {
  return Array.from(element.children).some((child) =>
    sourceElements.has(child as HTMLElement),
  );
}

function pickForElement(element: HTMLElement): PlayablePickResult | undefined {
  return describePlayablePick(elementPath(element));
}

function interactionForElement(
  element: HTMLElement,
): PlayableInteractionSelection | undefined {
  const appearance = describePlayableAppearanceTarget(elementPath(element));
  if (!appearance) return undefined;
  const target = appearance.element as HTMLElement;
  const computed = getComputedStyle(target);
  const rawDelay =
    target.style.getPropertyValue("--putenggame-appear-at") ||
    computed.getPropertyValue("--putenggame-appear-at") ||
    target.style.getPropertyValue("--delay") ||
    computed.getPropertyValue("--delay") ||
    computed.animationDelay;
  const rawEnd =
    target.style.getPropertyValue("--putenggame-disappear-at") ||
    computed.getPropertyValue("--putenggame-disappear-at");
  return {
    pick: appearance.pick,
    delaySeconds: parseDelaySeconds(rawDelay),
    ...(parseOptionalTimingSeconds(rawEnd) === undefined
      ? {}
      : { endSeconds: parseOptionalTimingSeconds(rawEnd) }),
    inPlace: Boolean(appearance.pick.source),
  };
}

function elementPath(element: HTMLElement): EventTarget[] {
  const path: EventTarget[] = [element];
  let current: Element | null = element;
  while (current) {
    if (current.parentElement) {
      current = current.parentElement;
      path.push(current);
      continue;
    }
    const shadowRoot = current.getRootNode();
    if (!(shadowRoot instanceof ShadowRoot)) break;
    current = shadowRoot.host;
    path.push(current);
  }
  return path;
}

/** Pointer travel, in CSS pixels, before a press becomes a move instead of a click. */
const MOVE_THRESHOLD = 3;

/**
 * The element a drag at the start of `path` moves, with its pick. Inline
 * boxes ignore `translate`, so a press on one moves the box that holds it.
 * A surface's own root and its background stay put.
 */
function movableTarget(
  path: readonly EventTarget[],
): { element: HTMLElement; pick: PlayablePickResult } | undefined {
  let element = path[0] instanceof HTMLElement ? path[0] : undefined;
  while (
    element &&
    ["inline", "contents"].includes(getComputedStyle(element).display)
  )
    element = element.parentElement ?? undefined;
  if (
    !element?.parentElement ||
    element.getAttribute("data-media") === "backdrop"
  )
    return undefined;
  const pick = describePlayablePick(path.slice(path.indexOf(element)));
  const sourceTarget = describePlayableSourceTarget(path);
  if (
    pick?.mediaSlot === "backdrop" ||
    sourceTarget?.pick.mediaSlot === "backdrop"
  )
    return undefined;
  return pick ? { element, pick } : undefined;
}

/**
 * An animation on the element sets `translate` in place of the element's
 * own, so an offset written to its style would not show. Animations that add
 * to it, like the Project Style's `.rise`, are fine, and transitions end.
 */
function overridesTranslate(element: Element): boolean {
  return element.getAnimations().some((animation) => {
    const effect = animation.effect;
    if (
      "transitionProperty" in animation ||
      !(effect instanceof KeyframeEffect) ||
      effect.composite !== "replace"
    )
      return false;
    return effect.getKeyframes().some((frame) => "translate" in frame);
  });
}

function overridesTransform(element: Element): boolean {
  return element.getAnimations().some((animation) => {
    const effect = animation.effect;
    if (
      "transitionProperty" in animation ||
      !(effect instanceof KeyframeEffect) ||
      effect.composite !== "replace"
    )
      return false;
    return effect
      .getKeyframes()
      .some(
        (frame) =>
          "transform" in frame || "scale" in frame || "rotate" in frame,
      );
  });
}

/**
 * Elements whose text can be typed over: they hold text of their own and are
 * not form fields. A container whose text all sits in child elements is not
 * one; typing over it would replace the whole layout.
 */
function isTextTarget(target: unknown): boolean {
  if (!(target instanceof Element)) return false;
  const tag = target.tagName.toLowerCase();
  if (
    [
      "input",
      "textarea",
      "select",
      "img",
      "video",
      "audio",
      "canvas",
      "svg",
      "iframe",
    ].includes(tag)
  )
    return false;
  return Array.from(target.childNodes).some(
    (child) => child.nodeType === 3 && Boolean(child.textContent?.trim()),
  );
}

/**
 * The element came from surface HTML and holds only text, so its source can
 * be rewritten directly.
 */
function holdsSourceText(element: Element): boolean {
  return (
    element.hasAttribute(PLAYABLE_SOURCE_ATTRIBUTE) &&
    Array.from(element.childNodes).every(
      (child) => child.nodeType === 3 || child.nodeType === 8,
    )
  );
}

function parseDelaySeconds(value: string): number {
  const match = /(-?(?:\d+\.?\d*|\.\d+))\s*(ms|s)?/i.exec(value.trim());
  if (!match) return 0;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return 0;
  return Math.max(
    0,
    Math.round(
      (match[2]?.toLowerCase() === "ms" ? amount / 1000 : amount) * 10,
    ) / 10,
  );
}

function parseOptionalTimingSeconds(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const seconds = parseDelaySeconds(value);
  return seconds <= 3600 ? seconds : undefined;
}

const BLOCKED_PICK_EVENTS = [
  "mousedown",
  "mouseup",
  "dblclick",
  "auxclick",
  "contextmenu",
  "touchstart",
  "touchmove",
  "touchend",
  "wheel",
  "keyup",
  "keypress",
];

function setLayerStyle(layer: HTMLElement, zIndex: number): void {
  layer.style.position = "absolute";
  layer.style.inset = "0";
  layer.style.zIndex = String(zIndex);
}

function isPlayableSurfaceModule(
  value: unknown,
): value is PlayableSurfaceModule {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof Reflect.get(value, "mount") === "function"
  );
}
