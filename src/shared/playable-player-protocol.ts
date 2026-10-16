import type { CompiledNodeGraph } from "./playable-compiled.js";
import type { JsonObject, NodeGraph } from "./playable-nodes.js";
import type { PlayableTransform, PlayableTranslate } from "./playable-move.js";
import type { PlayablePickResult } from "./playable-picker.js";
import type { PlayableSeen } from "./playable-story-map.js";
import type { PlayableBackdropEffects } from "./playable-backdrop-effects.js";
import {
  PLAYABLE_BUTTON_ASSET_SCALE_MAX,
  PLAYABLE_BUTTON_ASSET_SCALE_MIN,
  type PlayableMotionConfig,
} from "./playable-motion.js";
import type {
  NodeRuntimePolicy,
  NodeRuntimeSnapshot,
  PlayableSave,
} from "./playable-runtime.js";

export interface NodePlayerDefinition {
  version: 1;
  graph: NodeGraph;
  compiled: CompiledNodeGraph;
  graphSignature: string;
}

// `available: false` marks an Interactive Story project whose graph.json is missing.
export type NodeRuntimeResponse =
  { available: true; definition: NodePlayerDefinition } | { available: false };

/**
 * Authoring options for a preview session. The Published Player never sends
 * them, and element picking is only available in sessions that have them.
 */
export interface PlayablePreviewOptions {
  policy?: NodeRuntimePolicy;
  startNodeId?: string;
  previewState?: JsonObject;
}

/**
 * An authoring tool that takes over the preview's input: `select` picks
 * elements to talk about, `text` edits an element's text in place, `move`
 * drags an element to a new place.
 */
export type PlayablePreviewTool = "select" | "text" | "move";

export type PlayableMediaCommand =
  | { command: "play" }
  | { command: "pause" }
  | { command: "backdrop-loop"; loop: boolean }
  | {
      command: "button-asset-scale";
      nodeId: string;
      cssPath: string;
      source: string;
      scaleX: number;
      scaleY: number;
    }
  | { command: "seek"; time: number };

export interface PlayableMediaState {
  currentTime: number;
  duration: number;
  paused: boolean;
}

/** Text the author typed over an element in the preview. */
export interface PlayableTextEdit {
  pick: PlayablePickResult;
  before: string;
  after: string;
  /** Original, untranslated text from the source markup when available. */
  sourceBefore?: string;
  /**
   * The element was written in surface HTML and has a source location.
   */
  inPlace: boolean;
}

/** A new positioned text element committed from the preview. */
export interface PlayableTextCreate {
  id: string;
  nodeId: string;
  text: string;
  x: number;
  y: number;
}

/** A text element selected by the authoring Text tool. */
export interface PlayableTextSelection {
  pick: PlayablePickResult;
  fontFamily: string;
  fontSize: string;
  /** The selected element owns a source location that can be edited directly. */
  inPlace: boolean;
}

/** A font property changed on the selected text element. */
export interface PlayableTextStyleEdit {
  pick: PlayablePickResult;
  property: "fontFamily" | "fontSize";
  value: string;
  inPlace: boolean;
}

export interface PlayableTextStyleCommand
  extends Omit<PlayableTextStyleEdit, "inPlace"> {
  sequence: number;
}

/** A non-video element selected for appearance timing. */
export interface PlayableInteractionSelection {
  pick: PlayablePickResult;
  delaySeconds: number;
  endSeconds?: number;
  /** The selected element owns a source location that can be edited directly. */
  inPlace: boolean;
}

/** A changed appearance delay for a non-video element. */
export interface PlayableInteractionTimingEdit {
  pick: PlayablePickResult;
  delaySeconds: number;
  endSeconds?: number;
  inPlace: boolean;
}

export interface PlayableAppearanceTimingUpdate {
  pick: PlayablePickResult;
  delaySeconds: number;
  endSeconds?: number;
}

export interface PlayableAppearanceTimingCommand {
  sequence: number;
  updates: PlayableAppearanceTimingUpdate[];
}

export interface PlayableMotionCommand {
  sequence: number;
  target:
    | { kind: "element"; pick: PlayablePickResult }
    | { kind: "create"; id: string; nodeId: string; source: string };
  config?: PlayableMotionConfig;
  assetId?: string;
  assetScaleX?: number;
  assetScaleY?: number;
  asset?: PlayableAssetTransfer;
}

/** An element the author dragged in the preview. */
export interface PlayableMove {
  /** The element before it moved. */
  pick: PlayablePickResult;
  /** Where it ends up, from where its layout puts it. */
  translate: PlayableTranslate;
  /**
   * The element was written in surface HTML and no animation of its own
   * overrides `translate`, so the offset can go straight back to its source.
   * Otherwise the Agent makes it.
   */
  inPlace: boolean;
}

/** A visual transform changed on a selected element. */
export interface PlayableTransformEdit {
  pick: PlayablePickResult;
  transform: PlayableTransform;
  inPlace: boolean;
}

/** A selected element removed from the source surface. */
export interface PlayableDeleteEdit {
  pick: PlayablePickResult;
  inPlace: boolean;
}

export interface PlayableElementCopy {
  pick: PlayablePickResult;
  /** Sanitized markup persisted to the Scene source. */
  html: string;
  /** Live markup keeps preview-only media URLs so the preview is not reloaded. */
  previewHtml: string;
  ids: string[];
}

export interface PlayableElementClipboardCommand {
  action: "copy" | "paste";
  sequence: number;
}

export type PlayableHistoryCommand = "undo" | "redo";

export interface PlayableAssetTransfer {
  contentType: string;
  bytes: ArrayBuffer;
}

export type PlayableHostMessage =
  | {
      kind: "putenggame:playable:init";
      instanceId: string;
      definition: NodePlayerDefinition;
      assets: Record<string, PlayableAssetTransfer>;
      save?: unknown;
      /** What the player has seen in earlier sessions, for the Story Map. */
      seen?: unknown;
      preview?: PlayablePreviewOptions;
    }
  | {
      kind: "putenggame:playable:save-result";
      instanceId: string;
      requestId: string;
      error?: string;
    }
  | {
      kind: "putenggame:playable:pick-start";
      instanceId: string;
      tool: PlayablePreviewTool;
    }
  | {
      kind: "putenggame:playable:delete-element";
      instanceId: string;
      pick: PlayablePickResult;
    }
  | {
      kind: "putenggame:playable:appearance-timing";
      instanceId: string;
      command: PlayableAppearanceTimingCommand;
    }
  | {
      kind: "putenggame:playable:motion";
      instanceId: string;
      command: PlayableMotionCommand;
    }
  | {
      kind: "putenggame:playable:text-style";
      instanceId: string;
      command: PlayableTextStyleCommand;
    }
  | {
      kind: "putenggame:playable:backdrop-effects";
      instanceId: string;
      effects: PlayableBackdropEffects;
    }
  | {
      kind: "putenggame:playable:text-created-result";
      instanceId: string;
      id: string;
      source?: string;
    }
  | {
      kind: "putenggame:playable:element-paste-result";
      instanceId: string;
      requestId: string;
      sources?: Record<string, string>;
      error?: string;
    }
  | {
      kind: "putenggame:playable:element-clipboard";
      instanceId: string;
      action: "copy" | "paste";
      sequence: number;
    }
  | {
      kind: "putenggame:playable:media-command";
      instanceId: string;
      command: PlayableMediaCommand;
    }
  | { kind: "putenggame:playable:pick-cancel"; instanceId: string };

export type PlayableFrameMessage =
  | {
      kind: "putenggame:playable:save";
      instanceId: string;
      requestId: string;
      save: PlayableSave;
    }
  | {
      /** Keep this record; there is no reply, since losing it never stops the game. */
      kind: "putenggame:playable:seen";
      instanceId: string;
      seen: PlayableSeen;
    }
  | {
      kind: "putenggame:playable:snapshot";
      instanceId: string;
      snapshot: NodeRuntimeSnapshot;
    }
  | {
      kind: "putenggame:playable:error";
      instanceId: string;
      error: string;
    }
  | {
      kind: "putenggame:playable:diagnostic";
      instanceId: string;
      error: string;
    }
  | {
      kind: "putenggame:playable:picked";
      instanceId: string;
      pick: PlayablePickResult;
      /** Added to the current selection (a modifier key was held) instead of replacing it. */
      additive: boolean;
    }
  | {
      kind: "putenggame:playable:text-edited";
      instanceId: string;
      edit: PlayableTextEdit;
    }
  | {
      kind: "putenggame:playable:text-created";
      instanceId: string;
      text: PlayableTextCreate;
    }
  | {
      kind: "putenggame:playable:text-selected";
      instanceId: string;
      selection?: PlayableTextSelection;
    }
  | {
      kind: "putenggame:playable:interaction-selected";
      instanceId: string;
      selection: PlayableInteractionSelection;
      /** Added to the current interaction selection when a modifier or marquee was used. */
      additive: boolean;
    }
  | {
      kind: "putenggame:playable:moved";
      instanceId: string;
      move: PlayableMove;
    }
  | {
      kind: "putenggame:playable:transformed";
      instanceId: string;
      edit: PlayableTransformEdit;
    }
  | {
      kind: "putenggame:playable:deleted";
      instanceId: string;
      edit: PlayableDeleteEdit;
    }
  | {
      kind: "putenggame:playable:element-paste";
      instanceId: string;
      requestId: string;
      copies: PlayableElementCopy[];
    }
  | {
      kind: "putenggame:playable:history-command";
      instanceId: string;
      command: PlayableHistoryCommand;
    }
  | {
      kind: "putenggame:playable:media-state";
      instanceId: string;
      state: PlayableMediaState;
    }
  | { kind: "putenggame:playable:activity"; instanceId: string }
  | { kind: "putenggame:playable:pick-cancelled"; instanceId: string };

export function isPlayableHostMessage(
  value: unknown,
): value is PlayableHostMessage {
  if (
    !isRecord(value) ||
    typeof value.kind !== "string" ||
    typeof value.instanceId !== "string"
  )
    return false;
  if (value.kind === "putenggame:playable:init") {
    return (
      isRecord(value.definition) &&
      isRecord(value.assets) &&
      (value.preview === undefined || isRecord(value.preview))
    );
  }
  if (value.kind === "putenggame:playable:pick-start")
    return (
      value.tool === "select" || value.tool === "text" || value.tool === "move"
    );
  if (value.kind === "putenggame:playable:delete-element")
    return (
      isRecord(value.pick) &&
      typeof value.pick.nodeId === "string" &&
      typeof value.pick.cssPath === "string"
    );
  if (value.kind === "putenggame:playable:text-style") {
    const command = value.command;
    return (
      isRecord(command) &&
      typeof command.sequence === "number" &&
      Number.isSafeInteger(command.sequence) &&
      command.sequence > 0 &&
      isRecord(command.pick) &&
      typeof command.pick.nodeId === "string" &&
      typeof command.pick.cssPath === "string" &&
      typeof command.pick.tag === "string" &&
      typeof command.pick.source === "string" &&
      (command.property === "fontFamily" || command.property === "fontSize") &&
      typeof command.value === "string"
    );
  }
  if (value.kind === "putenggame:playable:text-created-result")
    return (
      typeof value.id === "string" &&
      (value.source === undefined || typeof value.source === "string")
    );
  if (value.kind === "putenggame:playable:element-paste-result")
    return (
      typeof value.requestId === "string" &&
      (value.error === undefined || typeof value.error === "string") &&
      (value.sources === undefined ||
        (isRecord(value.sources) &&
          Object.entries(value.sources).every(
            ([id, source]) =>
              /^putenggame-copy-[\w-]+$/.test(id) && typeof source === "string",
          )))
    );
  if (value.kind === "putenggame:playable:element-clipboard")
    return (
      (value.action === "copy" || value.action === "paste") &&
      typeof value.sequence === "number" &&
      Number.isSafeInteger(value.sequence) &&
      value.sequence > 0
    );
  if (value.kind === "putenggame:playable:appearance-timing") {
    const command = value.command;
    return (
      isRecord(command) &&
      typeof command.sequence === "number" &&
      Number.isSafeInteger(command.sequence) &&
      command.sequence > 0 &&
      Array.isArray(command.updates) &&
      command.updates.length > 0 &&
      command.updates.every(
        (update) =>
          isRecord(update) &&
          isRecord(update.pick) &&
          typeof update.pick.nodeId === "string" &&
          typeof update.pick.source === "string" &&
          typeof update.pick.cssPath === "string" &&
          typeof update.pick.tag === "string" &&
          typeof update.delaySeconds === "number" &&
          Number.isFinite(update.delaySeconds) &&
          update.delaySeconds >= 0 &&
          update.delaySeconds <= 3600 &&
          (update.endSeconds === undefined ||
            (typeof update.endSeconds === "number" &&
              Number.isFinite(update.endSeconds) &&
              update.endSeconds > update.delaySeconds &&
              update.endSeconds <= 3600)),
      )
    );
  }
  if (value.kind === "putenggame:playable:motion") {
    const command = value.command;
    if (
      !isRecord(command) ||
      typeof command.sequence !== "number" ||
      !Number.isSafeInteger(command.sequence) ||
      command.sequence < 1 ||
      !isRecord(command.target) ||
      !(
        (command.target.kind === "element" &&
          isRecord(command.target.pick) &&
          typeof command.target.pick.nodeId === "string" &&
          typeof command.target.pick.cssPath === "string" &&
          typeof command.target.pick.tag === "string" &&
          typeof command.target.pick.source === "string") ||
        (command.target.kind === "create" &&
          typeof command.target.id === "string" &&
          typeof command.target.nodeId === "string" &&
          typeof command.target.source === "string")
      ) ||
      (command.config !== undefined &&
        (!isRecord(command.config) ||
          !["countdown", "progress-ring", "progress-bar", "hold-charge"].includes(String(command.config.kind)) ||
          !["interactive", "visual"].includes(String(command.config.mode)) ||
          typeof command.config.duration !== "number" ||
          !Number.isFinite(command.config.duration) ||
          command.config.duration < 0.1 ||
          command.config.duration > 3600 ||
          (command.config.timeoutDuration !== undefined &&
            (typeof command.config.timeoutDuration !== "number" ||
              !Number.isFinite(command.config.timeoutDuration) ||
              command.config.timeoutDuration < command.config.duration ||
              command.config.timeoutDuration > 3600)) ||
          (command.config.signal !== undefined && typeof command.config.signal !== "string") ||
          (command.config.timeoutSignal !== undefined && typeof command.config.timeoutSignal !== "string"))) ||
      (command.assetId !== undefined && typeof command.assetId !== "string") ||
      (command.assetScaleX !== undefined &&
        (typeof command.assetScaleX !== "number" ||
          !Number.isInteger(command.assetScaleX) ||
          command.assetScaleX < PLAYABLE_BUTTON_ASSET_SCALE_MIN ||
          command.assetScaleX > PLAYABLE_BUTTON_ASSET_SCALE_MAX)) ||
      (command.assetScaleY !== undefined &&
        (typeof command.assetScaleY !== "number" ||
          !Number.isInteger(command.assetScaleY) ||
          command.assetScaleY < PLAYABLE_BUTTON_ASSET_SCALE_MIN ||
          command.assetScaleY > PLAYABLE_BUTTON_ASSET_SCALE_MAX)) ||
      (command.asset !== undefined &&
        (!isRecord(command.asset) ||
          typeof command.asset.contentType !== "string" ||
          !(command.asset.bytes instanceof ArrayBuffer)))
    )
      return false;
    return true;
  }
  if (value.kind === "putenggame:playable:backdrop-effects")
    return (
      isRecord(value.effects) &&
      typeof value.effects.vignette === "boolean" &&
      typeof value.effects.grain === "boolean"
    );
  if (value.kind === "putenggame:playable:media-command")
    return (
      isRecord(value.command) &&
      (value.command.command === "play" ||
        value.command.command === "pause" ||
        (value.command.command === "backdrop-loop" &&
          typeof value.command.loop === "boolean") ||
        (value.command.command === "button-asset-scale" &&
          typeof value.command.nodeId === "string" &&
          typeof value.command.cssPath === "string" &&
          typeof value.command.source === "string" &&
          typeof value.command.scaleX === "number" &&
          Number.isInteger(value.command.scaleX) &&
          value.command.scaleX >= PLAYABLE_BUTTON_ASSET_SCALE_MIN &&
          value.command.scaleX <= PLAYABLE_BUTTON_ASSET_SCALE_MAX &&
          typeof value.command.scaleY === "number" &&
          Number.isInteger(value.command.scaleY) &&
          value.command.scaleY >= PLAYABLE_BUTTON_ASSET_SCALE_MIN &&
          value.command.scaleY <= PLAYABLE_BUTTON_ASSET_SCALE_MAX) ||
        (value.command.command === "seek" &&
          typeof value.command.time === "number" &&
          Number.isFinite(value.command.time) &&
          value.command.time >= 0))
    );
  if (value.kind === "putenggame:playable:pick-cancel") return true;
  return (
    value.kind === "putenggame:playable:save-result" &&
    typeof value.requestId === "string" &&
    (value.error === undefined || typeof value.error === "string")
  );
}

export function isPlayableFrameMessage(
  value: unknown,
): value is PlayableFrameMessage {
  if (
    !isRecord(value) ||
    typeof value.kind !== "string" ||
    typeof value.instanceId !== "string"
  )
    return false;
  if (value.kind === "putenggame:playable:save")
    return typeof value.requestId === "string" && isRecord(value.save);
  if (value.kind === "putenggame:playable:seen") return isRecord(value.seen);
  if (value.kind === "putenggame:playable:snapshot")
    return isRecord(value.snapshot);
  if (value.kind === "putenggame:playable:picked")
    return isRecord(value.pick) && typeof value.additive === "boolean";
  if (value.kind === "putenggame:playable:text-edited")
    return (
      isRecord(value.edit) &&
      isRecord(value.edit.pick) &&
      typeof value.edit.before === "string" &&
      typeof value.edit.after === "string" &&
      (value.edit.sourceBefore === undefined ||
        typeof value.edit.sourceBefore === "string") &&
      typeof value.edit.inPlace === "boolean"
    );
  if (value.kind === "putenggame:playable:text-created")
    return (
      isRecord(value.text) &&
      typeof value.text.id === "string" &&
      typeof value.text.nodeId === "string" &&
      typeof value.text.text === "string" &&
      value.text.text.length > 0 &&
      typeof value.text.x === "number" &&
      Number.isFinite(value.text.x) &&
      value.text.x >= 0 &&
      value.text.x <= 100 &&
      typeof value.text.y === "number" &&
      Number.isFinite(value.text.y) &&
      value.text.y >= 0 &&
      value.text.y <= 100
    );
  if (value.kind === "putenggame:playable:text-selected")
    return (
      value.selection === undefined ||
      (isRecord(value.selection) &&
        isRecord(value.selection.pick) &&
        typeof value.selection.fontFamily === "string" &&
        typeof value.selection.fontSize === "string" &&
        typeof value.selection.inPlace === "boolean")
    );
  if (value.kind === "putenggame:playable:interaction-selected")
    return (
      isRecord(value.selection) &&
      isRecord(value.selection.pick) &&
      typeof value.selection.delaySeconds === "number" &&
      Number.isFinite(value.selection.delaySeconds) &&
      value.selection.delaySeconds >= 0 &&
      (value.selection.endSeconds === undefined ||
        (typeof value.selection.endSeconds === "number" &&
          Number.isFinite(value.selection.endSeconds) &&
          value.selection.endSeconds > value.selection.delaySeconds &&
          value.selection.endSeconds <= 3600)) &&
      typeof value.selection.inPlace === "boolean" &&
      typeof value.additive === "boolean"
    );
  if (value.kind === "putenggame:playable:moved")
    return (
      isRecord(value.move) &&
      isRecord(value.move.pick) &&
      isRecord(value.move.translate) &&
      typeof value.move.translate.x === "number" &&
      typeof value.move.translate.y === "number" &&
      typeof value.move.inPlace === "boolean"
    );
  if (value.kind === "putenggame:playable:transformed")
    return (
      isRecord(value.edit) &&
      isRecord(value.edit.pick) &&
      isRecord(value.edit.transform) &&
      typeof value.edit.transform.scale === "number" &&
      Number.isFinite(value.edit.transform.scale) &&
      value.edit.transform.scale > 0 &&
      typeof value.edit.transform.rotation === "number" &&
      Number.isFinite(value.edit.transform.rotation) &&
      typeof value.edit.inPlace === "boolean"
    );
  if (value.kind === "putenggame:playable:deleted")
    return (
      isRecord(value.edit) &&
      isRecord(value.edit.pick) &&
      typeof value.edit.inPlace === "boolean"
    );
  if (value.kind === "putenggame:playable:element-paste") {
    const copies = value.copies;
    return (
      typeof value.requestId === "string" &&
      Array.isArray(copies) &&
      copies.length > 0 &&
      copies.length <= 32 &&
      copies.reduce(
        (size, copy) =>
          size +
          (isRecord(copy) && typeof copy.html === "string"
            ? copy.html.length
            : Number.POSITIVE_INFINITY) +
          (isRecord(copy) && typeof copy.previewHtml === "string"
            ? copy.previewHtml.length
            : Number.POSITIVE_INFINITY),
        0,
      ) <=
        2 * 1024 * 1024 &&
      copies.every(
        (copy) =>
          isRecord(copy) &&
          isRecord(copy.pick) &&
          typeof copy.pick.nodeId === "string" &&
          typeof copy.pick.source === "string" &&
          typeof copy.pick.tag === "string" &&
          typeof copy.html === "string" &&
          copy.html.length > 0 &&
          copy.html.length <= 256 * 1024 &&
          typeof copy.previewHtml === "string" &&
          copy.previewHtml.length > 0 &&
          copy.previewHtml.length <= 256 * 1024 &&
          Array.isArray(copy.ids) &&
          copy.ids.length > 0 &&
          copy.ids.length <= 512 &&
          copy.ids.every(
            (id) =>
              typeof id === "string" && /^putenggame-copy-[\w-]+$/.test(id),
          ),
      )
    );
  }
  if (value.kind === "putenggame:playable:history-command")
    return value.command === "undo" || value.command === "redo";
  if (value.kind === "putenggame:playable:media-state")
    return (
      isRecord(value.state) &&
      typeof value.state.currentTime === "number" &&
      Number.isFinite(value.state.currentTime) &&
      typeof value.state.duration === "number" &&
      Number.isFinite(value.state.duration) &&
      typeof value.state.paused === "boolean"
    );
  if (value.kind === "putenggame:playable:activity") return true;
  if (value.kind === "putenggame:playable:pick-cancelled") return true;
  return (
    (value.kind === "putenggame:playable:error" ||
      value.kind === "putenggame:playable:diagnostic") &&
    typeof value.error === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
