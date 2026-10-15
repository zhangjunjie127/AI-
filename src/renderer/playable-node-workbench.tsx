import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  ArrowRight,
  Brush,
  Image,
  ImageOff,
  InfoCircle,
  History,
  Heart,
  LoaderCircle,
  MessageSquarePlus,
  MousePointer2,
  Move,
  Pause,
  Play,
  RotateCcw,
  Trash2,
  Type,
  Undo2,
  X,
  type IconComponent,
} from "./icons.js";
import {
  type NodeGraph,
  type PlayableAssetDefinition,
  type PlayableNode,
} from "../shared/playable-nodes.js";
import { playableNodeById } from "../shared/playable-graph.js";
import type {
  PlayableAppearanceTimingCommand,
  NodePlayerDefinition,
  PlayableDeleteEdit,
  PlayableElementClipboardCommand,
  PlayableElementCopy,
  PlayableInteractionSelection,
  PlayableInteractionTimingEdit,
  PlayableMediaCommand,
  PlayableMediaState,
  PlayableMove,
  PlayablePreviewOptions,
  PlayableTextCreate,
  PlayableTextEdit,
  PlayableTextSelection,
  PlayableTextStyleEdit,
  PlayableTransformEdit,
} from "../shared/playable-player-protocol.js";
import type { PlayableBackdropEffects } from "../shared/playable-backdrop-effects.js";
import {
  playableTextPickWithSource,
  type PlayablePickResult,
} from "../shared/playable-picker.js";
import type { NodeRuntimeSnapshot } from "../shared/playable-runtime.js";
import type { PromptContext } from "../shared/contracts.js";
import {
  playableElementContext,
  playableMoveRequest,
  playableTextEditRequest,
} from "../shared/playable-chat-context.js";
import {
  playableAssetType,
  playableRuntimeKey,
  type PlayableProjectValidationIssue,
} from "../shared/playable-editor.js";
import { getNodeRuntime, getWorkspaceFile, playableSandboxUrl } from "./api.js";
import { loadLibraryAssets, type LibraryAsset } from "./library-assets.js";
import {
  LibraryAssetPicker,
  uploadLibraryFile,
  WorkbenchBreadcrumb,
  WorkbenchPreview,
} from "./node-workbench.js";
import { createMemoryStorage, NodePlayer } from "./playable-player.js";
import { loadPlayableAssets } from "./playable-assets.js";
import {
  playablePickKey,
  usePlayableChatReport,
  type PlayableChatState,
  type PlayableMediaAttachment,
  type PlayableStroke,
} from "./playable-chat.js";
import { isTextEntry } from "./editor-canvas.js";
import { PlayableAffectionDialog } from "./playable-affection-dialog.js";
import {
  readPlayableAffectionConfig,
  type PlayableAffectionConfig,
} from "../shared/playable-affection.js";

const ASSET_UPLOAD_ACCEPT = ".png,.jpg,.jpeg,.webp,.mp4,.mov,.webm";
const TOAST_LIMIT = 3;
const TOAST_MS = 3500;
const TOAST_LONG_MS = 6000;
const PICK_LIMIT = 8;
const FALLBACK_SYSTEM_FONTS = [
  "Microsoft YaHei",
  "SimSun",
  "Arial",
  "Segoe UI",
  "Georgia",
  "Times New Roman",
  "system-ui",
  "sans-serif",
];
const TEXT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72, 96];

function formatHistoryTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export interface PlayableAssetRequest extends PlayableAssetDefinition {
  name: string;
}

/** A Playtest that starts at a Scene instead of the saved game, with a new game's values. */
export interface PlaytestStart {
  nodeId: string;
}

export interface PlayableHistoryItem {
  id: string;
  label: string;
  createdAt: number;
  current: boolean;
  restoreIndex?: number;
}

export interface PreviewRuntime {
  definition?: NodePlayerDefinition;
  assets?: Record<string, Blob>;
  error?: string;
}

/**
 * What the pointer does in the preview: play the game, pick elements for the
 * chat, edit text in place, move elements, or draw over it for the chat.
 */
export type PreviewTool = "play" | "select" | "text" | "move" | "draw";

/**
 * A short message over the preview: where an Exit would go, since the preview
 * stays on the Scene, or a change from the preview that failed. Changes that
 * work show in the preview or the chat instead.
 */
interface PreviewToast {
  id: number;
  text: string;
  tone: "info" | "warning" | "error";
  /** A Scene the message offers to open. */
  targetNodeId?: string;
}

/**
 * One Node's Workbench: a live preview that reports navigation instead of
 * leaving the Node, with tools to point at, edit, and draw on it. There is no
 * inspector and no code here; the AI changes the Node.
 * Everything else floats over the preview, so it keeps the whole height.
 */
export function PlayableNodeWorkbench({
  projectId,
  node,
  graph,
  history,
  onRestoreHistory,
  issues,
  revision,
  onClose,
  onOpenNode,
  onRename,
  onAskAgent,
  onSendToAgent,
  onWriteText,
  onWriteTextCreate,
  onWriteElementCopies,
  elementClipboardCommand,
  onElementClipboardCommandApplied,
  onWriteTextStyle,
  onWriteInteractionTimings,
  onWriteMove,
  onWriteTransform,
  onWriteDelete,
  onWriteAffection,
  onAddAsset,
  onSetBackdrop,
  onRemoveBackdrop,
  backdrop,
  backdropEffects,
  onPlayFromHere,
  onChatContextChange,
}: {
  projectId: string;
  node: PlayableNode;
  graph: NodeGraph;
  history: readonly PlayableHistoryItem[];
  onRestoreHistory: (index: number) => Promise<void>;
  issues: readonly PlayableProjectValidationIssue[];
  /** Changes whenever the project's files were saved, so the preview reloads. */
  revision: number;
  onClose: () => void;
  onOpenNode: (nodeId: string) => void;
  onRename: (title: string) => void;
  /** Sends a request to the AI now; resolves false when it could not be sent. */
  onSendToAgent?: (text: string, contexts: PromptContext[]) => Promise<boolean>;
  /** Writes a text edit back to surface HTML; resolves false when it cannot be made in place. */
  onWriteText: (edit: PlayableTextEdit) => Promise<boolean>;
  /** Adds a positioned text element and returns its source location. */
  onWriteTextCreate: (text: PlayableTextCreate) => Promise<string | undefined>;
  /** Persists copied preview elements and returns each new source location. */
  onWriteElementCopies: (
    copies: PlayableElementCopy[],
  ) => Promise<Record<string, string> | undefined>;
  elementClipboardCommand?: PlayableElementClipboardCommand;
  onElementClipboardCommandApplied?: (sequence: number) => void;
  /** Writes a font property back to the selected text element. */
  onWriteTextStyle: (edit: PlayableTextStyleEdit) => Promise<boolean>;
  /** Writes a non-video element's appearance delay back to its source element. */
  onWriteInteractionTimings: (
    edits: PlayableInteractionTimingEdit[],
  ) => Promise<boolean>;
  /** Writes a move back to surface HTML; resolves false when it cannot be made in place. */
  onWriteMove: (move: PlayableMove) => Promise<boolean>;
  /** Writes a visual scale/rotation change back to surface HTML. */
  onWriteTransform: (edit: PlayableTransformEdit) => Promise<boolean>;
  /** Removes a selected element from surface HTML. */
  onWriteDelete: (edit: PlayableDeleteEdit) => Promise<boolean>;
  onWriteAffection: (config: PlayableAffectionConfig) => Promise<void>;
  /** Declares an asset on the Scene and resolves with its ID once saved. */
  onAddAsset: (asset: PlayableAssetRequest) => Promise<string>;
  /**
   * Shows the asset as the Scene's background, as a step the editor's Undo
   * takes back; resolves false when the background cannot be set in place.
   */
  onSetBackdrop?: (asset: PlayableAssetRequest) => Promise<boolean>;
  /**
   * Takes the Asset off the Scene's background, as a step the editor's Undo
   * takes back; resolves false when there is no background to clear.
   */
  onRemoveBackdrop?: () => Promise<boolean>;
  /** Whether the Scene's background shows anything yet; unset when the editor cannot set it. */
  backdrop?: "missing" | "set";
  backdropEffects: PlayableBackdropEffects;
  /** Opens a Playtest that starts at this Scene. */
  onPlayFromHere?: (start: PlaytestStart) => void;
  onChatContextChange?: (state: PlayableChatState | undefined) => void;
  /** Puts a request in the chat prompt, for when it cannot be sent now. */
  onAskAgent?: (text: string) => void;
}) {
  const skipNextRuntimeRefresh = useRef(0);
  const reserveRuntimeRefreshSkip = useCallback(() => {
    skipNextRuntimeRefresh.current += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      skipNextRuntimeRefresh.current = Math.max(
        0,
        skipNextRuntimeRefresh.current - 1,
      );
    };
  }, []);
  const runtime = usePlayablePreviewRuntime(
    projectId,
    revision,
    skipNextRuntimeRefresh,
  );
  const [affectionConfig, setAffectionConfig] =
    useState<PlayableAffectionConfig>();
  const [affectionOpen, setAffectionOpen] = useState(false);
  const [affectionSaving, setAffectionSaving] = useState(false);
  useEffect(() => {
    let active = true;
    void getWorkspaceFile(projectId, node.source.html)
      .then((file) => {
        if (active)
          setAffectionConfig(
            file.content
              ? readPlayableAffectionConfig(file.content)
              : undefined,
          );
      })
      .catch(() => {
        if (active) setAffectionConfig(undefined);
      });
    return () => {
      active = false;
    };
  }, [projectId, node.source.html, revision]);
  const [session, setSession] = useState(0);
  const [deleteCommand, setDeleteCommand] = useState<PlayablePickResult>();
  const [appearanceTimingCommand, setAppearanceTimingCommand] =
    useState<PlayableAppearanceTimingCommand>();
  const appearanceTimingSequence = useRef(0);
  const [snapshot, setSnapshot] = useState<NodeRuntimeSnapshot>();
  const [diagnostics, setDiagnostics] = useState<
    { message: string; at: string }[]
  >([]);
  const [tool, setTool] = useState<PreviewTool>("play");
  const [textSelection, setTextSelection] = useState<PlayableTextSelection>();
  const [interactionSelections, setInteractionSelections] = useState<
    PlayableInteractionSelection[]
  >([]);
  const interactionSelection = interactionSelections.at(-1);
  const [picks, setPicks] = useState<PlayablePickResult[]>([]);
  const [strokes, setStrokes] = useState<PlayableStroke[]>([]);
  const [media, setMedia] = useState<PlayableMediaAttachment[]>([]);
  const [mediaState, setMediaState] = useState<PlayableMediaState>({
    currentTime: 0,
    duration: 0,
    paused: true,
  });
  const [mediaCommand, setMediaCommand] = useState<PlayableMediaCommand>();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyRestoring, setHistoryRestoring] = useState(false);
  const [storage] = useState(createMemoryStorage);
  const fonts = useSystemFonts();
  const { toasts, show: showToast, dismiss: dismissToast } = usePreviewToasts();
  const page = useRef<HTMLElement>(null);
  const seenReport = useRef("");

  // Any new session starts with no errors and no Exits taken.
  useEffect(() => {
    setSnapshot(undefined);
    setDiagnostics([]);
  }, [runtime.definition, node.id, session]);

  useEffect(() => {
    setTool("play");
    setTextSelection(undefined);
    setInteractionSelections([]);
    setPicks([]);
    setStrokes([]);
    setMedia([]);
    setMediaState({ currentTime: 0, duration: 0, paused: true });
    setMediaCommand(undefined);
  }, [node.id]);

  useEffect(() => {
    if (tool !== "text") setTextSelection(undefined);
    if (tool !== "select") setInteractionSelections([]);
  }, [tool]);

  // Esc puts the pointer back to playing. The preview frame reports its own Esc.
  useEffect(() => {
    if (tool === "play") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        event.defaultPrevented ||
        isTextEntry(event.target)
      )
        return;
      setTool("play");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [tool]);

  // Each Exit the preview takes shows up once, instead of changing the Scene.
  useEffect(() => {
    if (!snapshot) {
      seenReport.current = "";
      return;
    }
    for (const report of snapshot.reports) {
      if (report.at > seenReport.current) showToast(reportToast(graph, report));
    }
    seenReport.current = snapshot.reports.at(-1)?.at ?? seenReport.current;
  }, [graph, showToast, snapshot]);

  const removePick = useCallback((key: string) => {
    setPicks((current) =>
      current.filter((pick) => playablePickKey(pick) !== key),
    );
    setInteractionSelections((current) =>
      current.filter((selection) => playablePickKey(selection.pick) !== key),
    );
  }, []);
  usePlayableChatReport({
    graph,
    nodeId: node.id,
    picks,
    strokes,
    media,
    onRemovePick: removePick,
    onClearPicks: () => {
      setPicks([]);
      setInteractionSelections([]);
    },
    onClearDrawing: () => setStrokes([]),
    onRemoveMedia: (assetId) =>
      setMedia((current) => current.filter((item) => item.assetId !== assetId)),
    onClearMedia: () => setMedia([]),
    stage: page,
    onChange: onChatContextChange,
  });

  const onDiagnostic = useCallback((message: string) => {
    setDiagnostics((current) => [
      ...current.slice(-19),
      { message, at: new Date().toISOString() },
    ]);
  }, []);
  const onPick = useCallback((pick: PlayablePickResult, additive: boolean) => {
    const key = playablePickKey(pick);
    if (!additive) setInteractionSelections([]);
    setPicks((current) => {
      const picked = current.some(
        (candidate) => playablePickKey(candidate) === key,
      );
      if (!additive) return [pick];
      return picked
        ? current.filter((candidate) => playablePickKey(candidate) !== key)
        : [...current, pick].slice(-PICK_LIMIT);
    });
  }, []);
  const onPickCancel = useCallback(() => setTool("play"), []);

  /** Asks the AI now, or puts the request in the chat prompt when it cannot be sent. */
  const askAgent = useCallback(
    async (
      text: string,
      contexts: PromptContext[],
      summary: string,
    ): Promise<void> => {
      if (onSendToAgent && (await onSendToAgent(text, contexts))) return;
      if (onAskAgent) return onAskAgent(text);
      showToast({ tone: "error", text: `Could not ask the AI: ${summary}` });
    },
    [onAskAgent, onSendToAgent, showToast],
  );

  const onTextEdit = useCallback(
    (edit: PlayableTextEdit) => {
      if (edit.before === edit.after) return;
      void (async () => {
        if (edit.inPlace) {
          const releaseRefreshSkip = reserveRuntimeRefreshSkip();
          try {
            if (await onWriteText(edit)) {
              return;
            }
            releaseRefreshSkip();
          } catch (cause) {
            releaseRefreshSkip();
            return showToast({
              tone: "error",
              text: `Could not change the text: ${errorMessage(cause)}`,
            });
          }
        }
        await askAgent(
          playableTextEditRequest(edit.before, edit.after),
          [playableElementContext(edit.pick)],
          `Changing "${edit.before}" to "${edit.after}"`,
        );
      })();
    },
    [askAgent, onWriteText, reserveRuntimeRefreshSkip, showToast],
  );

  const onTextSelect = useCallback((selection: PlayableTextSelection) => {
    setTextSelection(selection);
  }, []);

  const onPasteElements = useCallback(
    async (copies: PlayableElementCopy[]) => {
      const releaseRefreshSkip = reserveRuntimeRefreshSkip();
      try {
        const sources = await onWriteElementCopies(copies);
        if (sources) return sources;
        releaseRefreshSkip();
        showToast({ tone: "error", text: "无法粘贴选中的素材" });
      } catch (cause) {
        releaseRefreshSkip();
        showToast({
          tone: "error",
          text: `无法粘贴选中的素材：${errorMessage(cause)}`,
        });
      }
      return undefined;
    },
    [onWriteElementCopies, reserveRuntimeRefreshSkip, showToast],
  );

  const onTextCreate = useCallback(
    async (text: PlayableTextCreate) => {
      const releaseRefreshSkip = reserveRuntimeRefreshSkip();
      try {
        const source = await onWriteTextCreate(text);
        if (source) {
          const withSource = (pick: PlayablePickResult) =>
            playableTextPickWithSource(pick, {
              id: text.id,
              nodeId: text.nodeId,
              source,
            });
          setPicks((current) => current.map(withSource));
          setTextSelection((current) => {
            if (!current) return current;
            const pick = withSource(current.pick);
            return pick === current.pick
              ? current
              : { ...current, pick, inPlace: true };
          });
          setInteractionSelections((current) =>
            current.map((selection) => {
              const pick = withSource(selection.pick);
              return pick === selection.pick
                ? selection
                : { ...selection, pick, inPlace: true };
            }),
          );
          return source;
        }
        releaseRefreshSkip();
        showToast({ tone: "error", text: "无法保存新文字" });
      } catch (cause) {
        releaseRefreshSkip();
        showToast({
          tone: "error",
          text: `无法保存新文字：${errorMessage(cause)}`,
        });
      }
      return undefined;
    },
    [onWriteTextCreate, reserveRuntimeRefreshSkip, showToast],
  );

  const onTextStyle = useCallback(
    (property: PlayableTextStyleEdit["property"], value: string) => {
      const selection = textSelection;
      if (!selection || !value) return;
      void (async () => {
        const releaseRefreshSkip = reserveRuntimeRefreshSkip();
        try {
          if (!selection.inPlace) {
            releaseRefreshSkip();
            showToast({ tone: "error", text: "此文字无法直接保存字体设置" });
            return;
          }
          if (
            !(await onWriteTextStyle({
              pick: selection.pick,
              property,
              value,
              inPlace: selection.inPlace,
            }))
          ) {
            releaseRefreshSkip();
            showToast({ tone: "error", text: "此文字无法直接保存字体设置" });
            return;
          }
          setTextSelection((current) =>
            current && current.pick.cssPath === selection.pick.cssPath
              ? { ...current, [property]: value }
              : current,
          );
        } catch (cause) {
          releaseRefreshSkip();
          showToast({
            tone: "error",
            text: `无法保存字体设置：${errorMessage(cause)}`,
          });
        }
      })();
    },
    [onWriteTextStyle, reserveRuntimeRefreshSkip, showToast, textSelection],
  );

  const onInteractionSelect = useCallback(
    (selection: PlayableInteractionSelection, additive: boolean) => {
      const key = playablePickKey(selection.pick);
      setInteractionSelections((current) => {
        if (!additive) return [selection];
        const existing = current.some(
          (item) => playablePickKey(item.pick) === key,
        );
        return existing
          ? current.filter((item) => playablePickKey(item.pick) !== key)
          : [...current, selection];
      });
    },
    [],
  );

  const onInteractionTiming = useCallback(
    (property: "appear" | "disappear", seconds: number | undefined) => {
      const value =
        seconds === undefined ? undefined : Math.round(seconds * 10) / 10;
      if (
        !interactionSelections.length ||
        (value !== undefined &&
          (!Number.isFinite(value) || value < 0 || value > 3600))
      )
        return;
      const edits = interactionSelections.map((selection) => {
        const delaySeconds =
          property === "appear" ? value! : selection.delaySeconds;
        const endSeconds =
          property === "disappear" ? value : selection.endSeconds;
        return { ...selection, delaySeconds, endSeconds };
      });
      if (
        edits.some(
          ({ delaySeconds, endSeconds }) =>
            endSeconds !== undefined && endSeconds <= delaySeconds,
        )
      ) {
        showToast({
          tone: "error",
          text: "消失时间必须晚于所有已选素材的出现时间",
        });
        return;
      }
      const releaseRefreshSkip = reserveRuntimeRefreshSkip();
      void (async () => {
        try {
          if (!(await onWriteInteractionTimings(edits))) {
            releaseRefreshSkip();
            showToast({
              tone: "error",
              text: "部分素材无法直接保存时间设置",
            });
            return;
          }
          setInteractionSelections((current) =>
            current.map((selection) => {
              const updated = edits.find(
                (edit) =>
                  playablePickKey(edit.pick) ===
                  playablePickKey(selection.pick),
              );
              return updated ?? selection;
            }),
          );
          setAppearanceTimingCommand({
            sequence: ++appearanceTimingSequence.current,
            updates: edits.map((selection) => ({
              pick: selection.pick,
              delaySeconds: selection.delaySeconds,
              ...(selection.endSeconds === undefined
                ? {}
                : { endSeconds: selection.endSeconds }),
            })),
          });
        } catch (cause) {
          releaseRefreshSkip();
          showToast({
            tone: "error",
            text: `无法保存时间设置：${errorMessage(cause)}`,
          });
        }
      })();
    },
    [
      interactionSelections,
      onWriteInteractionTimings,
      reserveRuntimeRefreshSkip,
      showToast,
    ],
  );

  const onMove = useCallback(
    (move: PlayableMove) => {
      void (async () => {
        if (move.inPlace) {
          const releaseRefreshSkip = reserveRuntimeRefreshSkip();
          try {
            if (await onWriteMove(move)) return;
            releaseRefreshSkip();
          } catch (cause) {
            releaseRefreshSkip();
            return showToast({
              tone: "error",
              text: `Could not move it: ${errorMessage(cause)}`,
            });
          }
        }
        const excerpt = move.pick.text ? ` "${move.pick.text}"` : "";
        await askAgent(
          playableMoveRequest(move.translate),
          [playableElementContext(move.pick)],
          `Moving <${move.pick.tag}>${excerpt}`,
        );
      })();
    },
    [askAgent, onWriteMove, reserveRuntimeRefreshSkip, showToast],
  );

  const onTransform = useCallback(
    (edit: PlayableTransformEdit) => {
      void (async () => {
        const releaseRefreshSkip = reserveRuntimeRefreshSkip();
        try {
          if (!edit.inPlace) {
            releaseRefreshSkip();
            showToast({ tone: "error", text: "此元素无法直接保存缩放或旋转" });
            return;
          }
          if (await onWriteTransform(edit)) return;
          releaseRefreshSkip();
          showToast({ tone: "error", text: "此元素无法直接保存缩放或旋转" });
        } catch (cause) {
          releaseRefreshSkip();
          showToast({
            tone: "error",
            text: `无法保存缩放或旋转：${errorMessage(cause)}`,
          });
        }
      })();
    },
    [onWriteTransform, reserveRuntimeRefreshSkip, showToast],
  );

  const onDelete = useCallback(
    (edit: PlayableDeleteEdit) => {
      void (async () => {
        let releaseRefreshSkip: (() => void) | undefined;
        try {
          if (!edit.inPlace) {
            showToast({ tone: "error", text: "此元素无法直接删除" });
            return;
          }
          releaseRefreshSkip = reserveRuntimeRefreshSkip();
          if (await onWriteDelete(edit)) {
            setPicks((current) =>
              current.filter(
                (pick) => playablePickKey(pick) !== playablePickKey(edit.pick),
              ),
            );
            setInteractionSelections((current) =>
              current.filter(
                (selection) =>
                  playablePickKey(selection.pick) !==
                  playablePickKey(edit.pick),
              ),
            );
            return;
          }
          releaseRefreshSkip();
          showToast({ tone: "error", text: "此元素无法直接删除" });
        } catch (cause) {
          releaseRefreshSkip?.();
          showToast({
            tone: "error",
            text: `无法删除元素：${errorMessage(cause)}`,
          });
        }
      })();
    },
    [onWriteDelete, reserveRuntimeRefreshSkip, showToast],
  );

  const deleteSelected = useCallback(() => {
    const pick = picks.at(-1);
    if (!pick) return;
    void (async () => {
      let releaseRefreshSkip: (() => void) | undefined;
      try {
        releaseRefreshSkip = reserveRuntimeRefreshSkip();
        if (!(await onWriteDelete({ pick, inPlace: true }))) {
          releaseRefreshSkip();
          showToast({ tone: "error", text: "此元素无法直接删除" });
          return;
        }
        setDeleteCommand(pick);
        setPicks((current) =>
          current.filter(
            (candidate) => playablePickKey(candidate) !== playablePickKey(pick),
          ),
        );
        setInteractionSelections((current) =>
          current.filter(
            (selection) =>
              playablePickKey(selection.pick) !== playablePickKey(pick),
          ),
        );
      } catch (cause) {
        releaseRefreshSkip?.();
        showToast({
          tone: "error",
          text: `无法删除元素：${errorMessage(cause)}`,
        });
      }
    })();
  }, [onWriteDelete, picks, reserveRuntimeRefreshSkip, showToast]);

  /**
   * As background, the editor sets the Scene's background. Otherwise the
   * media goes into the chat, declared on the Scene, for the message to say
   * where it goes.
   */
  const addMedia = useCallback(
    async (asset: PlayableAssetRequest, target: MediaTarget) => {
      try {
        if (
          target === "backdrop" &&
          onSetBackdrop &&
          (await onSetBackdrop(asset))
        ) {
          // A picked background is gone once the preview reloads with the new one.
          setPicks((current) =>
            current.filter((pick) => pick.mediaSlot !== "backdrop"),
          );
          return;
        }
        const assetId = await onAddAsset(asset);
        if (asset.type !== "image" && asset.type !== "video") return;
        const type = asset.type;
        setMedia((current) => [
          ...current.filter((item) => item.assetId !== assetId),
          { assetId, name: asset.name, type },
        ]);
      } catch (cause) {
        showToast({
          tone: "error",
          text: `Could not add ${asset.name}: ${errorMessage(cause)}`,
        });
      }
    },
    [onAddAsset, onSetBackdrop, showToast],
  );

  const removeBackdrop = useCallback(async () => {
    try {
      if (!onRemoveBackdrop || !(await onRemoveBackdrop()))
        return showToast({
          tone: "error",
          text: "This Scene has no background to remove",
        });
      setPicks((current) =>
        current.filter((pick) => pick.mediaSlot !== "backdrop"),
      );
    } catch (cause) {
      showToast({
        tone: "error",
        text: `Could not remove the background: ${errorMessage(cause)}`,
      });
    }
  }, [onRemoveBackdrop, showToast]);

  const preview: PlayablePreviewOptions = {
    policy: "report",
    startNodeId: node.id,
  };
  const nodeIssues = issues.filter(
    (issue) =>
      issue.surfaceId === node.id ||
      issue.path.startsWith(`nodes/${node.id}/`) ||
      Object.values(node.source).includes(issue.path),
  );
  const errors = previewErrors(
    graph,
    node,
    nodeIssues,
    runtime.error,
    snapshot,
    diagnostics,
  );
  const ready = Boolean(runtime.definition && runtime.assets);
  const canSetBackdrop = Boolean(backdrop && onSetBackdrop);
  const canRemoveBackdrop = Boolean(backdrop === "set" && onRemoveBackdrop);
  const chooser = useMediaChooser(
    (asset, target) => void addMedia(asset, target),
    (text) => showToast({ tone: "error", text }),
  );

  // In the header, where the canvas has Playtest.
  const actions = (
    <div className="story-node-editor-actions">
      <div className="story-node-editor-history">
        <button
          type="button"
          className="icon-button pane-header-action"
          title="编辑历史"
          aria-label="编辑历史"
          aria-expanded={historyOpen}
          aria-haspopup="menu"
          onClick={() => setHistoryOpen((current) => !current)}
        >
          <History size={14} />
        </button>
        {historyOpen ? (
          <div className="story-node-editor-history-popover" role="menu">
            <div className="story-node-editor-history-title">编辑历史</div>
            <div className="story-node-editor-history-list">
              {history.length ? (
                history.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    className={item.current ? "is-current" : undefined}
                    disabled={item.current || historyRestoring}
                    onClick={() => {
                      if (item.restoreIndex === undefined) return;
                      setHistoryRestoring(true);
                      void onRestoreHistory(item.restoreIndex)
                        .catch(() => {})
                        .finally(() => {
                          setHistoryRestoring(false);
                          setHistoryOpen(false);
                        });
                    }}
                  >
                    <span>{item.label}</span>
                    <time>{formatHistoryTime(item.createdAt)}</time>
                  </button>
                ))
              ) : (
                <p className="story-node-editor-history-empty">暂无编辑记录</p>
              )}
            </div>
          </div>
        ) : null}
      </div>
      {affectionConfig ? (
        <button
          type="button"
          className="icon-button pane-header-action"
          title="Affection settings"
          aria-label="Affection settings"
          onClick={() => setAffectionOpen(true)}
        >
          <Heart size={14} />
        </button>
      ) : null}
      <button
        type="button"
        className="icon-button pane-header-action"
        title="Play this Scene again from the start"
        aria-label="Replay"
        disabled={!runtime.definition}
        onClick={() => setSession((current) => current + 1)}
      >
        <RotateCcw size={14} />
      </button>
      {onPlayFromHere ? (
        <button
          type="button"
          className="icon-button pane-header-action"
          data-tooltip="从此场景开始试玩"
          title="从此场景开始试玩"
          aria-label="从此场景开始试玩"
          onClick={() => onPlayFromHere({ nodeId: node.id })}
        >
          <Play size={14} />
        </button>
      ) : null}
    </div>
  );

  const previewPane = (
    <WorkbenchPreview
      ariaLabel={`${node.title} live preview`}
      viewport={graph.viewport}
      stageClassName={`playable-workbench-stage is-tool-${tool}`}
      stageOverlayHeight={mediaState.duration > 0 ? 28 : 0}
      stageOverlay={
        <PreviewTimeline
          state={mediaState}
          onSeek={(time) => setMediaCommand({ command: "seek", time })}
        />
      }
      overlay={
        <>
          <PreviewToolbar
            tool={tool}
            disabled={!ready}
            strokes={strokes.length}
            picks={picks.length}
            textSelection={textSelection}
            interactionSelection={interactionSelection}
            fonts={fonts}
            onTextStyle={onTextStyle}
            onInteractionTiming={onInteractionTiming}
            onTool={setTool}
            mediaState={mediaState}
            onMediaCommand={setMediaCommand}
            onDeleteSelected={deleteSelected}
            onUndoStroke={() => setStrokes((current) => current.slice(0, -1))}
            onClearStrokes={() => setStrokes([])}
            media={
              <MediaMenu
                disabled={!ready}
                uploading={chooser.uploading}
                canSetBackdrop={canSetBackdrop}
                canRemoveBackdrop={canRemoveBackdrop}
                onChoose={chooser.choose}
                onRemoveBackdrop={() => void removeBackdrop()}
              />
            }
          />
          <PreviewToasts
            errors={errors}
            toasts={toasts}
            onFix={() =>
              void askAgent(
                fixErrorsRequest(node.title, errors),
                [],
                "Fixing the errors",
              )
            }
            onOpenNode={onOpenNode}
            onDismiss={dismissToast}
          />
        </>
      }
    >
      {runtime.definition && runtime.assets ? (
        <NodePlayer
          key={session}
          definition={runtime.definition}
          frameUrl={playableSandboxUrl()}
          assets={runtime.assets}
          saveKey={`putenggame:playable:preview:${projectId}`}
          storage={storage}
          preview={preview}
          preserveMediaState={mediaState}
          backdropEffects={backdropEffects}
          deleteCommand={deleteCommand}
          appearanceTimingCommand={appearanceTimingCommand}
          onAppearanceTimingCommandApplied={(sequence) =>
            setAppearanceTimingCommand((current) =>
              current?.sequence === sequence ? undefined : current,
            )
          }
          {...(tool === "select" || tool === "text" || tool === "move"
            ? { tool }
            : {})}
          onPick={onPick}
          onTextEdit={onTextEdit}
          onTextCreate={onTextCreate}
          onTextSelect={onTextSelect}
          onInteractionSelect={onInteractionSelect}
          onMove={onMove}
          onTransform={onTransform}
          onDelete={onDelete}
          onPasteElements={onPasteElements}
          elementClipboardCommand={elementClipboardCommand}
          onElementClipboardCommandApplied={
            onElementClipboardCommandApplied
          }
          onMediaState={setMediaState}
          mediaCommand={mediaCommand}
          onPickCancel={onPickCancel}
          onSnapshot={setSnapshot}
          onDiagnostic={onDiagnostic}
        />
      ) : (
        <div
          className={`playable-workbench-stage-state${runtime.error ? " is-error" : ""}`}
          role={runtime.error ? "alert" : undefined}
        >
          {runtime.error ?? "Loading preview..."}
        </div>
      )}
      {tool === "draw" || strokes.length ? (
        <DrawingLayer
          viewport={graph.viewport}
          strokes={strokes}
          drawing={tool === "draw"}
          onStroke={(stroke) => setStrokes((current) => [...current, stroke])}
        />
      ) : null}
      {chooser.elements}
    </WorkbenchPreview>
  );

  return (
    <section
      ref={page}
      className="story-node-editor-page playable-workbench-page"
      aria-label={`${node.title} workbench`}
    >
      <header className="pane-header story-node-editor-header window-drag-handle">
        <WorkbenchBreadcrumb
          label={node.title}
          onClose={onClose}
          onRename={onRename}
        />
        {actions}
      </header>
      <div className="story-node-workbench playable-node-workbench">
        <div className="story-node-workbench-stage">
          <div className="story-node-workbench-preview">{previewPane}</div>
        </div>
      </div>
      {affectionOpen && affectionConfig ? (
        <PlayableAffectionDialog
          config={affectionConfig}
          busy={affectionSaving}
          onSave={async (config) => {
            setAffectionSaving(true);
            try {
              await onWriteAffection(config);
              setAffectionConfig(config);
            } finally {
              setAffectionSaving(false);
            }
          }}
          onClose={() => setAffectionOpen(false)}
        />
      ) : null}
    </section>
  );
}

const TOOLS: {
  tool: PreviewTool;
  label: string;
  title: string;
  icon: IconComponent;
}[] = [
  { tool: "play", label: "播放", title: "播放或暂停预览", icon: Play },
  {
    tool: "select",
    label: "选择",
    title: "点击或框选素材，按住 Shift 可多选",
    icon: MousePointer2,
  },
  {
    tool: "text",
    label: "文本",
    title: "点击文字进行修改，双击空白处添加",
    icon: Type,
  },
  {
    tool: "move",
    label: "移动",
    title: "拖动元素进行移动",
    icon: Move,
  },
  {
    tool: "draw",
    label: "绘制",
    title: "在预览中绘制标记",
    icon: Brush,
  },
];

const TOOL_HINTS: Record<Exclude<PreviewTool, "play">, string> = {
  select:
    "点击或拖动框选 · Shift 点击或框选可多选 · Ctrl/⌘ C 复制 · Ctrl/⌘ V 粘贴 · Esc 返回播放",
  text: "点击文本修改 · Enter 保存 · Esc 返回播放",
  move: "拖动移动 · Esc 返回播放",
  draw: "绘制后在聊天中说明需求 · Esc 返回播放",
};

/** Floats over the bottom of the preview. */
export function PreviewToolbar({
  tool,
  disabled,
  strokes,
  picks,
  textSelection,
  interactionSelection,
  mediaState,
  onMediaCommand,
  onDeleteSelected,
  fonts,
  onTextStyle,
  onInteractionTiming,
  onTool,
  onUndoStroke,
  onClearStrokes,
  media,
}: {
  tool: PreviewTool;
  disabled: boolean;
  strokes: number;
  picks: number;
  textSelection?: PlayableTextSelection;
  interactionSelection?: PlayableInteractionSelection;
  mediaState: PlayableMediaState;
  onMediaCommand: (command: PlayableMediaCommand) => void;
  onDeleteSelected: () => void;
  fonts: readonly string[];
  onTextStyle: (
    property: PlayableTextStyleEdit["property"],
    value: string,
  ) => void;
  onInteractionTiming: (
    property: "appear" | "disappear",
    seconds: number | undefined,
  ) => void;
  onTool: (tool: PreviewTool) => void;
  onUndoStroke: () => void;
  onClearStrokes: () => void;
  /** An action after the tools, such as the Media menu. */
  media?: ReactNode;
}) {
  const fontFamilies =
    textSelection?.fontFamily && !fonts.includes(textSelection.fontFamily)
      ? [textSelection.fontFamily, ...fonts]
      : fonts;
  const currentSize = textSelection
    ? Number.parseFloat(textSelection.fontSize)
    : undefined;
  const sizes =
    currentSize &&
    Number.isFinite(currentSize) &&
    !TEXT_SIZES.includes(currentSize)
      ? [currentSize, ...TEXT_SIZES]
      : TEXT_SIZES;
  const delayMinutes = interactionSelection
    ? Math.floor(interactionSelection.delaySeconds / 60)
    : 0;
  const delaySeconds = interactionSelection
    ? Math.round((interactionSelection.delaySeconds % 60) * 10) / 10
    : 0;
  const endMinutes =
    interactionSelection?.endSeconds === undefined
      ? ""
      : String(Math.floor(interactionSelection.endSeconds / 60));
  const endSeconds =
    interactionSelection?.endSeconds === undefined
      ? ""
      : String(Math.round((interactionSelection.endSeconds % 60) * 10) / 10);
  const [timingDraft, setTimingDraft] = useState(() => ({
    appearMinutes: String(delayMinutes),
    appearSeconds: String(delaySeconds),
    disappearMinutes: endMinutes,
    disappearSeconds: endSeconds,
  }));
  useEffect(() => {
    setTimingDraft({
      appearMinutes: String(delayMinutes),
      appearSeconds: String(delaySeconds),
      disappearMinutes: endMinutes,
      disappearSeconds: endSeconds,
    });
  }, [delayMinutes, delaySeconds, endMinutes, endSeconds]);
  const commitTimingDraft = (property: "appear" | "disappear") => {
    const minutes = Number(
      property === "appear"
        ? timingDraft.appearMinutes || 0
        : timingDraft.disappearMinutes || 0,
    );
    const secondsValue =
      property === "appear"
        ? timingDraft.appearSeconds
        : timingDraft.disappearSeconds;
    if (
      property === "disappear" &&
      !timingDraft.disappearMinutes &&
      !secondsValue
    ) {
      onInteractionTiming("disappear", undefined);
      return;
    }
    const seconds = Number(secondsValue || 0);
    if (Number.isFinite(minutes) && Number.isFinite(seconds))
      onInteractionTiming(property, minutes * 60 + seconds);
  };
  return (
    <div className="playable-preview-toolbar">
      {tool !== "play" ? (
        <p className="playable-preview-toolbar-hint">
          {TOOL_HINTS[tool]}
          {tool === "select" && picks ? ` · ${picks} picked` : ""}
        </p>
      ) : null}
      <div role="toolbar" aria-label="Preview tools">
        {TOOLS.map(({ tool: value, label, title, icon: ToolIcon }) => {
          const isPlayingTool = value === "play";
          const Icon = isPlayingTool && !mediaState.paused ? Pause : ToolIcon;
          const visibleLabel = isPlayingTool
            ? mediaState.paused
              ? "播放"
              : "暂停"
            : label;
          return (
            <button
              key={value}
              type="button"
              className={tool === value ? "is-active" : undefined}
              title={title}
              aria-pressed={tool === value}
              disabled={disabled && value !== "play"}
              onClick={() => {
                onTool(value);
                if (value === "play")
                  onMediaCommand({
                    command: mediaState.paused ? "play" : "pause",
                  });
              }}
            >
              <Icon size={14} />
              <span>{visibleLabel}</span>
            </button>
          );
        })}
        {media ? (
          <>
            <span
              className="playable-preview-toolbar-divider"
              aria-hidden="true"
            />
            {media}
          </>
        ) : null}
        {tool === "text" && textSelection ? (
          <>
            <span
              className="playable-preview-toolbar-divider"
              aria-hidden="true"
            />
            <label className="playable-preview-text-control">
              <span>字体</span>
              <select
                value={textSelection.fontFamily}
                onChange={(event) =>
                  onTextStyle("fontFamily", event.target.value)
                }
                aria-label="字体"
              >
                <option value="" disabled>
                  选择字体
                </option>
                {fontFamilies.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </select>
            </label>
            <label className="playable-preview-text-control">
              <span>字号</span>
              <select
                value={
                  currentSize && Number.isFinite(currentSize)
                    ? String(currentSize)
                    : ""
                }
                onChange={(event) =>
                  onTextStyle("fontSize", `${event.target.value}px`)
                }
                aria-label="字号"
              >
                <option value="" disabled>
                  选择字号
                </option>
                {sizes.map((size) => (
                  <option key={size} value={size}>
                    {size}px
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}
        {tool === "select" && interactionSelection ? (
          <>
            <span
              className="playable-preview-toolbar-divider"
              aria-hidden="true"
            />
            <label className="playable-preview-text-control">
              <span>出现时间</span>
              <input
                type="number"
                min="0"
                max="60"
                step="1"
                value={timingDraft.appearMinutes}
                onChange={(event) =>
                  setTimingDraft((current) => ({
                    ...current,
                    appearMinutes: event.target.value,
                  }))
                }
                onBlur={() => commitTimingDraft("appear")}
                aria-label="出现时间（分钟）"
              />
              <span>分</span>
              <input
                type="number"
                min="0"
                max={delayMinutes >= 60 ? 0 : 59.9}
                step="0.1"
                value={timingDraft.appearSeconds}
                onChange={(event) =>
                  setTimingDraft((current) => ({
                    ...current,
                    appearSeconds: event.target.value,
                  }))
                }
                onBlur={() => commitTimingDraft("appear")}
                aria-label="出现时间（秒）"
              />
              <span>秒</span>
            </label>
            <label className="playable-preview-text-control">
              <span>消失时间</span>
              <input
                type="number"
                min="0"
                max="60"
                step="1"
                value={timingDraft.disappearMinutes}
                onChange={(event) => {
                  setTimingDraft((current) => ({
                    ...current,
                    disappearMinutes: event.target.value,
                  }));
                }}
                onBlur={() => commitTimingDraft("disappear")}
                aria-label="消失时间（分钟）"
              />
              <span>分</span>
              <input
                type="number"
                min="0"
                max={Number(endMinutes) >= 60 ? 0 : 59.9}
                step="0.1"
                value={timingDraft.disappearSeconds}
                onChange={(event) => {
                  setTimingDraft((current) => ({
                    ...current,
                    disappearSeconds: event.target.value,
                  }));
                }}
                onBlur={() => commitTimingDraft("disappear")}
                aria-label="消失时间（秒）"
              />
              <span>秒</span>
              {interactionSelection.endSeconds === undefined ? (
                <small>留空则持续显示</small>
              ) : null}
            </label>
          </>
        ) : null}
        {tool === "select" && picks ? (
          <>
            <span
              className="playable-preview-toolbar-divider"
              aria-hidden="true"
            />
            <button
              type="button"
              title="删除选中元素"
              aria-label="删除选中元素"
              onClick={onDeleteSelected}
            >
              <Trash2 size={14} />
              <span>删除</span>
            </button>
          </>
        ) : null}
        {strokes ? (
          <>
            <span
              className="playable-preview-toolbar-divider"
              aria-hidden="true"
            />
            <button
              type="button"
              title="Undo the last stroke"
              aria-label="Undo stroke"
              onClick={onUndoStroke}
            >
              <Undo2 size={14} />
            </button>
            <button
              type="button"
              title="Clear the drawing"
              aria-label="Clear drawing"
              onClick={onClearStrokes}
            >
              <Trash2 size={14} />
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function PreviewTimeline({
  state,
  onSeek,
}: {
  state: PlayableMediaState;
  onSeek: (time: number) => void;
}) {
  if (!(state.duration > 0)) return null;
  const currentTime = Math.min(Math.max(0, state.currentTime), state.duration);
  return (
    <div className="playable-preview-timeline" aria-label="视频时间轴">
      <span>{formatMediaTime(currentTime)}</span>
      <input
        type="range"
        min="0"
        max={state.duration}
        step="0.01"
        value={currentTime}
        aria-label="视频进度"
        onChange={(event) => onSeek(Number(event.target.value))}
      />
      <span>{formatMediaTime(state.duration)}</span>
    </div>
  );
}

function formatMediaTime(value: number): string {
  const total = Math.max(0, Math.floor(value));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function useSystemFonts(): readonly string[] {
  const [fonts, setFonts] = useState<readonly string[]>(FALLBACK_SYSTEM_FONTS);
  useEffect(() => {
    const bridge = window.putengGameDesktop?.fonts;
    if (!bridge) return;
    let active = true;
    const load = () =>
      void bridge
        .list()
        .then((next) => {
          if (active && next.length) setFonts(next);
        })
        .catch(() => undefined);
    load();
    const stop = bridge.onChanged(load);
    return () => {
      active = false;
      stop();
    };
  }, []);
  return fonts;
}

/**
 * Freehand strokes over the preview, in project viewport pixels. Strokes stay
 * visible after drawing ends, until the chat message that carries them.
 */
export function DrawingLayer({
  viewport,
  strokes,
  drawing,
  onStroke,
}: {
  viewport: { width: number; height: number };
  strokes: readonly PlayableStroke[];
  drawing: boolean;
  onStroke: (stroke: PlayableStroke) => void;
}) {
  const [current, setCurrent] = useState<{
    pointerId: number;
    points: { x: number; y: number }[];
  }>();
  const point = (event: ReactPointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.round(
        ((event.clientX - bounds.left) / bounds.width) * viewport.width,
      ),
      y: Math.round(
        ((event.clientY - bounds.top) / bounds.height) * viewport.height,
      ),
    };
  };
  const finish = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (current?.pointerId !== event.pointerId) return;
    onStroke(current.points);
    setCurrent(undefined);
  };
  const width = Math.max(3, Math.round(viewport.width / 240));
  return (
    <svg
      className={`playable-drawing-layer${drawing ? " is-drawing" : ""}`}
      viewBox={`0 0 ${viewport.width} ${viewport.height}`}
      preserveAspectRatio="none"
      aria-label={drawing ? "Drawing" : undefined}
      aria-hidden={drawing ? undefined : true}
      onPointerDown={(event) => {
        if (!drawing || event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        setCurrent({ pointerId: event.pointerId, points: [point(event)] });
      }}
      onPointerMove={(event) => {
        if (current?.pointerId !== event.pointerId) return;
        const next = point(event);
        const last = current.points.at(-1)!;
        if (Math.abs(next.x - last.x) + Math.abs(next.y - last.y) < 2) return;
        setCurrent({ ...current, points: [...current.points, next] });
      }}
      onPointerUp={finish}
      onPointerCancel={finish}
    >
      {[...strokes, ...(current ? [current.points] : [])].map(
        (stroke, index) =>
          stroke.length === 1 ? (
            <circle
              key={index}
              cx={stroke[0]!.x}
              cy={stroke[0]!.y}
              r={width / 2}
            />
          ) : (
            <polyline
              key={index}
              points={stroke.map(({ x, y }) => `${x},${y}`).join(" ")}
              strokeWidth={width}
            />
          ),
      )}
    </svg>
  );
}

/** Where chosen media goes: the Scene's background, or the chat. */
type MediaTarget = "backdrop" | "chat";

/**
 * Chooses an image or a video from the Library, or uploads a new one.
 * `elements` holds the picker and the file input, and must be rendered.
 */
function useMediaChooser(
  onAsset: (asset: PlayableAssetRequest, target: MediaTarget) => void,
  onError: (text: string) => void,
) {
  const [library, setLibrary] = useState<LibraryAsset[]>();
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const target = useRef<MediaTarget>("chat");

  const use = (asset: LibraryAsset) => {
    const type = playableAssetType(asset.mediaType);
    if (type !== "image" && type !== "video")
      return onError(`${asset.name} is not an image or a video`);
    onAsset(
      {
        name: asset.name,
        type,
        source: { kind: "library", assetId: asset.id },
      },
      target.current,
    );
  };

  const elements = (
    <>
      <input
        ref={fileInput}
        type="file"
        accept={ASSET_UPLOAD_ACCEPT}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setUploading(true);
          void uploadLibraryFile(file)
            .then(
              (asset) => {
                setLibrary(undefined);
                use(asset);
              },
              (cause) => onError(`Could not upload: ${errorMessage(cause)}`),
            )
            .finally(() => setUploading(false));
        }}
      />
      {library ? (
        <LibraryAssetPicker
          title={
            target.current === "backdrop"
              ? "Choose a background"
              : "Add to chat"
          }
          assets={library.filter((asset) => {
            const type = playableAssetType(asset.mediaType);
            return type === "image" || type === "video";
          })}
          uploading={uploading}
          onUpload={() => fileInput.current?.click()}
          onClose={() => setLibrary(undefined)}
          onSelect={(asset) => {
            setLibrary(undefined);
            use(asset);
          }}
        />
      ) : null}
    </>
  );

  return {
    uploading,
    elements,
    /** Opens the picker for the given target, with Upload in it. */
    choose: (to: MediaTarget) => {
      target.current = to;
      void loadLibraryAssets().then(setLibrary, (cause) =>
        onError(`Could not open the Library: ${errorMessage(cause)}`),
      );
    },
  };
}

/** The toolbar's Media action: as the Scene's background, or into the chat, or taking the background off. */
function MediaMenu({
  disabled,
  uploading,
  canSetBackdrop,
  canRemoveBackdrop,
  onChoose,
  onRemoveBackdrop,
}: {
  disabled: boolean;
  uploading: boolean;
  canSetBackdrop: boolean;
  canRemoveBackdrop: boolean;
  onChoose: (to: MediaTarget) => void;
  onRemoveBackdrop: () => void;
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  useDismiss(open, [button, menu], () => setOpen(false));
  const choose = (to: MediaTarget) => () => {
    setOpen(false);
    onChoose(to);
  };

  return (
    <span className="playable-preview-media">
      <button
        ref={button}
        type="button"
        title="Add an image or a video"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled || uploading}
        onClick={() => setOpen((current) => !current)}
      >
        {uploading ? (
          <LoaderCircle className="spin" size={14} />
        ) : (
          <Image size={14} />
        )}
        <span>Media</span>
      </button>
      {open ? (
        <div
          ref={menu}
          className="playable-preview-popover is-media"
          role="menu"
          aria-label="Media"
        >
          <button
            type="button"
            role="menuitem"
            disabled={!canSetBackdrop}
            title={
              canSetBackdrop
                ? "Show it behind this Scene"
                : "This Scene has no background to set; add it to the chat instead"
            }
            onClick={choose("backdrop")}
          >
            <Image size={13} />
            <span>As background</span>
          </button>
          <button type="button" role="menuitem" onClick={choose("chat")}>
            <MessageSquarePlus size={13} />
            <span>Add to chat</span>
          </button>
          {canRemoveBackdrop ? (
            <button
              type="button"
              role="menuitem"
              title="Take the background off this Scene"
              onClick={() => {
                setOpen(false);
                onRemoveBackdrop();
              }}
            >
              <ImageOff size={13} />
              <span>Remove background</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </span>
  );
}

/** Shows short messages over the preview; each fades after a few seconds. */
function usePreviewToasts() {
  const [toasts, setToasts] = useState<PreviewToast[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);
  const show = useCallback(
    (toast: Omit<PreviewToast, "id">) => {
      const id = nextId.current++;
      setToasts((current) =>
        [...current, { ...toast, id }].slice(-TOAST_LIMIT),
      );
      timers.current.set(
        id,
        setTimeout(
          () => dismiss(id),
          toast.targetNodeId || toast.tone === "error"
            ? TOAST_LONG_MS
            : TOAST_MS,
        ),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  return { toasts, show, dismiss };
}

const TOAST_ICONS: Record<PreviewToast["tone"], IconComponent> = {
  info: ArrowRight,
  warning: InfoCircle,
  error: InfoCircle,
};

/**
 * The top of the preview: the Scene's errors, which stay until they are gone,
 * then what the preview did instead of navigating.
 */
function PreviewToasts({
  errors,
  toasts,
  onFix,
  onOpenNode,
  onDismiss,
}: {
  errors: readonly string[];
  toasts: readonly PreviewToast[];
  onFix: () => void;
  onOpenNode: (nodeId: string) => void;
  onDismiss: (id: number) => void;
}) {
  return (
    <div
      className="playable-preview-toasts"
      aria-live="polite"
      aria-label="What happened in the preview"
    >
      {errors.length ? (
        <p className="playable-preview-toast is-error" role="alert">
          <InfoCircle size={12} />
          <span title={errors.join("\n")}>
            {errors[0]}
            {errors.length > 1 ? ` (+${errors.length - 1} more)` : ""}
          </span>
          <button type="button" title="Ask the AI to fix this" onClick={onFix}>
            Fix
          </button>
        </p>
      ) : null}
      {toasts.map((toast) => {
        const Icon = TOAST_ICONS[toast.tone];
        return (
          <p
            key={toast.id}
            className={`playable-preview-toast is-${toast.tone}`}
            role={toast.tone === "error" ? "alert" : undefined}
          >
            <Icon size={12} />
            <span title={toast.text}>{toast.text}</span>
            {toast.targetNodeId ? (
              <button
                type="button"
                onClick={() => {
                  onDismiss(toast.id);
                  onOpenNode(toast.targetNodeId!);
                }}
              >
                Open
              </button>
            ) : null}
            <button
              type="button"
              className="playable-preview-toast-close"
              aria-label="Dismiss"
              onClick={() => onDismiss(toast.id)}
            >
              <X size={11} />
            </button>
          </p>
        );
      })}
    </div>
  );
}

/**
 * What one navigation report says. The author just used the Exit, so the
 * message only names where the game would go.
 */
function reportToast(
  graph: NodeGraph,
  report: NodeRuntimeSnapshot["reports"][number],
): Omit<PreviewToast, "id"> {
  if (!report.targetNodeId) {
    return {
      tone: "warning",
      text:
        report.kind === "back"
          ? "Nowhere to go back to"
          : "Doesn't open anything yet",
    };
  }
  const title =
    playableNodeById(graph, report.targetNodeId)?.title ?? report.targetNodeId;
  const text =
    report.kind === "back"
      ? `Would go back to ${title}`
      : report.kind === "restart"
        ? `Would restart at ${title}`
        : report.kind === "continue"
          ? `Would continue at ${title}`
          : `Would open ${title}`;
  return { tone: "info", text, targetNodeId: report.targetNodeId };
}

/**
 * What is wrong in this Scene: the build error, project issues, and errors in
 * the preview, each once. Exits that go nowhere show on the canvas instead.
 */
function previewErrors(
  graph: NodeGraph,
  node: PlayableNode,
  issues: readonly PlayableProjectValidationIssue[],
  buildError: string | undefined,
  snapshot: NodeRuntimeSnapshot | undefined,
  diagnostics: readonly { message: string }[],
): string[] {
  const titleOf = (nodeId: string) =>
    playableNodeById(graph, nodeId)?.title ?? nodeId;
  return [
    ...new Set([
      ...(buildError ? [buildError] : []),
      ...issues.map((issue) => issue.message),
      ...(snapshot?.errors ?? []).map((error) =>
        error.nodeId && error.nodeId !== node.id
          ? `${titleOf(error.nodeId)}: ${error.message}`
          : error.message,
      ),
      ...diagnostics.map((diagnostic) => diagnostic.message),
    ]),
  ];
}

/** The chat request behind Fix. */
function fixErrorsRequest(title: string, errors: readonly string[]): string {
  const one = errors.length === 1;
  return `The preview of ${title} shows ${one ? "this error" : "these errors"}:\n${errors.map((error) => `- ${error}`).join("\n")}\nFix ${one ? "it" : "them"}.`;
}

/**
 * Calls `onDismiss` on Escape or a press outside the given elements while
 * `open`. A press in the preview frame reaches only the frame, so the window
 * losing focus to it counts as outside too.
 */
function useDismiss(
  open: boolean,
  inside: readonly RefObject<HTMLElement | null>[],
  onDismiss: () => void,
): void {
  const latest = useRef({ inside, onDismiss });
  latest.current = { inside, onDismiss };
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as globalThis.Node;
      if (!latest.current.inside.some((ref) => ref.current?.contains(target)))
        latest.current.onDismiss();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      latest.current.onDismiss();
    };
    const onBlur = () => latest.current.onDismiss();
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", onBlur);
    };
  }, [open]);
}

/**
 * Builds the project's current sources for a Workbench preview. A rebuild
 * with identical output keeps the running preview.
 */
export function usePlayablePreviewRuntime(
  projectId: string,
  revision: number,
  skipNextRevision?: { current: number },
): PreviewRuntime {
  const [runtime, setRuntime] = useState<PreviewRuntime>({});
  const runtimeKey = useRef<string | undefined>(undefined);
  const assetCache = useRef(new Map<string, Blob>());

  useEffect(() => {
    // Never skip the first runtime load: an edit can finish while that load is
    // still in flight, and skipping its replacement would leave the preview empty.
    const canKeepRunningPreview = runtimeKey.current !== undefined;
    if (skipNextRevision && skipNextRevision.current > 0) {
      skipNextRevision.current -= 1;
      if (canKeepRunningPreview) return;
    }
    let disposed = false;
    void getNodeRuntime(projectId)
      .then(async (result) => {
        if (!result.available)
          throw new Error("This project has no Scenes yet.");
        const key = playableRuntimeKey(result.definition);
        if (key === runtimeKey.current) {
          if (!disposed)
            setRuntime((current) => ({ ...current, error: undefined }));
          return;
        }
        const assets = await loadPlayableAssets(
          projectId,
          result.definition.graph,
          assetCache.current,
        );
        if (disposed) return;
        runtimeKey.current = key;
        setRuntime({ definition: result.definition, assets });
      })
      .catch((cause) => {
        if (!disposed)
          setRuntime((current) => ({ ...current, error: errorMessage(cause) }));
      });
    return () => {
      disposed = true;
    };
  }, [projectId, revision, skipNextRevision]);

  return runtime;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
