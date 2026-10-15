import { contextBridge, ipcRenderer } from "electron";
import type { DesktopUpdateState } from "../shared/desktop-update.js";
import type { ProjectFileOpenMode } from "../shared/contracts.js";
import type { PlaytestWatchState } from "../shared/playtest.js";
import type { DesktopClipboardFile } from "../shared/file-transfer.js";
import type {
  WebGamePlayerRequest,
  WebGamePlayerState,
  WebGamePreviewLayout,
} from "../shared/web-game-player.js";
import type { DesktopRuntimeState } from "../shared/desktop-runtime.js";

function argument(name: string): string {
  const prefix = `--${name}=`;
  const value = process.argv
    .find((entry) => entry.startsWith(prefix))
    ?.slice(prefix.length);
  if (!value) throw new Error(`Missing desktop runtime argument: ${name}`);
  return value;
}

if (process.isMainFrame) {
  contextBridge.exposeInMainWorld(
    "putengGameDesktop",
    Object.freeze({
      platform: process.platform,
      runtime: Object.freeze({
        daemonUrl: argument("putenggame-daemon-url"),
        token: argument("putenggame-daemon-token"),
      }),
      fonts: Object.freeze({
        list: () =>
          ipcRenderer.invoke("putenggame:system-fonts") as Promise<string[]>,
        onChanged: (listener: (fonts: string[]) => void) => {
          const callback = (
            _event: Electron.IpcRendererEvent,
            fonts: string[],
          ) => listener(fonts);
          ipcRenderer.on("putenggame:system-fonts-changed", callback);
          return () =>
            ipcRenderer.removeListener(
              "putenggame:system-fonts-changed",
              callback,
            );
        },
      }),
      runtimeService: Object.freeze({
        state: () =>
          ipcRenderer.invoke(
            "putenggame:runtime-state",
          ) as Promise<DesktopRuntimeState>,
        restart: () =>
          ipcRenderer.invoke(
            "putenggame:restart-runtime",
          ) as Promise<DesktopRuntimeState>,
        onState: (listener: (state: DesktopRuntimeState) => void) => {
          const handler = (
            _event: Electron.IpcRendererEvent,
            state: DesktopRuntimeState,
          ) => listener(state);
          ipcRenderer.on("putenggame:runtime-state", handler);
          return () =>
            ipcRenderer.removeListener("putenggame:runtime-state", handler);
        },
      }),
      setAppearance: (appearance: "system" | "light" | "dark") =>
        ipcRenderer.invoke(
          "putenggame:set-appearance",
          appearance,
        ) as Promise<void>,
      restartApp: () =>
        ipcRenderer.invoke("putenggame:restart-app") as Promise<void>,
      onPrepareClose: (listener: () => Promise<void>) => {
        const callback = (_event: Electron.IpcRendererEvent, id: number) => {
          void Promise.resolve()
            .then(listener)
            .then(
              () => ipcRenderer.send("putenggame:ready-to-close", id),
              (cause) =>
                ipcRenderer.send(
                  "putenggame:ready-to-close",
                  id,
                  cause instanceof Error ? cause.message : String(cause),
                ),
            );
        };
        ipcRenderer.on("putenggame:prepare-close", callback);
        return () =>
          ipcRenderer.removeListener("putenggame:prepare-close", callback);
      },
      onCancelClose: (listener: (error: string) => void) => {
        const callback = (
          _event: Electron.IpcRendererEvent,
          _id: number,
          error: string,
        ) => listener(error);
        ipcRenderer.on("putenggame:cancel-close", callback);
        return () =>
          ipcRenderer.removeListener("putenggame:cancel-close", callback);
      },
      windowMenu: Object.freeze({
        icon: () =>
          ipcRenderer.invoke("putenggame:window-menu-icon") as Promise<string>,
        popup: (label: string, x: number, y: number) =>
          ipcRenderer.invoke(
            "putenggame:popup-window-menu",
            label,
            x,
            y,
          ) as Promise<void>,
      }),
      openExternal: (url: string) =>
        ipcRenderer.invoke("putenggame:open-auth-url", url) as Promise<void>,
      openProjectFile: (
        projectId: string,
        filePath: string,
        mode: ProjectFileOpenMode = "default",
      ) =>
        ipcRenderer.invoke(
          "putenggame:open-project-file",
          projectId,
          filePath,
          mode,
        ) as Promise<void>,
      browsePluginDirectory: (pluginId: string) =>
        ipcRenderer.invoke(
          "putenggame:browse-plugin-directory",
          pluginId,
        ) as Promise<void>,
      revealPluginSkill: (pluginId: string, skillId: string) =>
        ipcRenderer.invoke(
          "putenggame:reveal-plugin-skill",
          pluginId,
          skillId,
        ) as Promise<void>,
      selectPluginDirectory: () =>
        ipcRenderer.invoke("putenggame:select-plugin-directory") as Promise<
          string | undefined
        >,
      selectProjectDirectory: () =>
        ipcRenderer.invoke("putenggame:select-project-directory") as Promise<
          string | undefined
        >,
      clipboard: Object.freeze({
        files: () =>
          ipcRenderer.invoke("putenggame:clipboard-files") as Promise<
            DesktopClipboardFile[]
          >,
        paste: () =>
          ipcRenderer.invoke("putenggame:paste-native") as Promise<void>,
      }),
      capturePage: (bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
      }) =>
        ipcRenderer.invoke(
          "putenggame:capture-page",
          bounds,
        ) as Promise<Uint8Array>,
      captureNodeThumbnail: (
        projectId: string,
        nodeId: string,
        viewport: { width: number; height: number },
        batchId: string,
      ) =>
        ipcRenderer.invoke(
          "putenggame:capture-node-thumbnail",
          projectId,
          nodeId,
          viewport,
          batchId,
        ) as Promise<boolean>,
      cancelNodeThumbnails: (batchId: string) =>
        ipcRenderer.invoke(
          "putenggame:cancel-node-thumbnails",
          batchId,
        ) as Promise<void>,
      finishNodeThumbnail: (captured: boolean) =>
        ipcRenderer.invoke(
          "putenggame:finish-node-thumbnail",
          captured,
        ) as Promise<void>,
      openPlaytest: (
        projectId: string,
        viewport: { width: number; height: number },
      ) =>
        ipcRenderer.invoke(
          "putenggame:open-playtest",
          projectId,
          viewport,
        ) as Promise<void>,
      webGamePlayer: Object.freeze({
        preview: Object.freeze({
          attach: (
            projectId: string,
            attachment: string,
            url: string,
            layout: WebGamePreviewLayout,
          ) =>
            ipcRenderer.invoke(
              "putenggame:attach-web-game-preview",
              projectId,
              attachment,
              url,
              layout,
            ) as Promise<void>,
          layout: (
            projectId: string,
            attachment: string,
            layout: WebGamePreviewLayout,
          ) =>
            ipcRenderer.invoke(
              "putenggame:layout-web-game-preview",
              projectId,
              attachment,
              layout,
            ) as Promise<void>,
          detach: (projectId: string, attachment: string) =>
            ipcRenderer.invoke(
              "putenggame:detach-web-game-preview",
              projectId,
              attachment,
            ) as Promise<void>,
          capture: (projectId: string) =>
            ipcRenderer.invoke(
              "putenggame:capture-web-game-preview",
              projectId,
            ) as Promise<Uint8Array>,
        }),
        open: (projectId: string, request: WebGamePlayerRequest) =>
          ipcRenderer.invoke(
            "putenggame:open-web-game-player",
            projectId,
            request,
          ) as Promise<void>,
        state: (projectId: string) =>
          ipcRenderer.invoke(
            "putenggame:web-game-player-state",
            projectId,
          ) as Promise<WebGamePlayerState>,
        close: (projectId: string) =>
          ipcRenderer.invoke(
            "putenggame:close-web-game-player",
            projectId,
          ) as Promise<void>,
        refresh: (projectId: string, reload = false) =>
          ipcRenderer.invoke(
            "putenggame:refresh-web-game-player",
            projectId,
            reload,
          ) as Promise<void>,
        onState: (listener: (state: WebGamePlayerState) => void) => {
          const callback = (
            _event: Electron.IpcRendererEvent,
            state: WebGamePlayerState,
          ) => listener(state);
          ipcRenderer.on("putenggame:web-game-player-state", callback);
          return () =>
            ipcRenderer.removeListener(
              "putenggame:web-game-player-state",
              callback,
            );
        },
      }),
      openPlayableNode: (projectId: string, nodeId: string) =>
        ipcRenderer.invoke(
          "putenggame:open-playable-node",
          projectId,
          nodeId,
        ) as Promise<void>,
      onOpenPlayableNode: (
        listener: (projectId: string, nodeId: string) => void,
      ) => {
        const callback = (
          _event: Electron.IpcRendererEvent,
          projectId: string,
          nodeId: string,
        ) => listener(projectId, nodeId);
        ipcRenderer.on("putenggame:open-playable-node", callback);
        return () =>
          ipcRenderer.removeListener("putenggame:open-playable-node", callback);
      },
      agentPlaytests: Object.freeze({
        state: () =>
          ipcRenderer.invoke(
            "putenggame:agent-playtest-state",
          ) as Promise<PlaytestWatchState>,
        setVisible: (visible: boolean) =>
          ipcRenderer.invoke(
            "putenggame:set-agent-playtest-visible",
            visible,
          ) as Promise<PlaytestWatchState>,
        onState: (listener: (state: PlaytestWatchState) => void) => {
          const callback = (
            _event: Electron.IpcRendererEvent,
            state: PlaytestWatchState,
          ) => listener(state);
          ipcRenderer.on("putenggame:agent-playtest-state", callback);
          return () =>
            ipcRenderer.removeListener(
              "putenggame:agent-playtest-state",
              callback,
            );
        },
      }),
      updates: Object.freeze({
        state: () =>
          ipcRenderer.invoke(
            "putenggame:update-state",
          ) as Promise<DesktopUpdateState | null>,
        check: () =>
          ipcRenderer.invoke("putenggame:check-for-update") as Promise<void>,
        download: () =>
          ipcRenderer.invoke("putenggame:download-update") as Promise<void>,
        install: () =>
          ipcRenderer.invoke("putenggame:install-update") as Promise<void>,
        onState: (listener: (state: DesktopUpdateState) => void) => {
          const callback = (
            _event: Electron.IpcRendererEvent,
            state: DesktopUpdateState,
          ) => listener(state);
          ipcRenderer.on("putenggame:update-state", callback);
          return () =>
            ipcRenderer.removeListener("putenggame:update-state", callback);
        },
      }),
      auth: Object.freeze({
        callbackUrl: () =>
          ipcRenderer.invoke("putenggame:auth-callback-url") as Promise<string>,
        cancel: () =>
          ipcRenderer.invoke("putenggame:cancel-auth") as Promise<void>,
        openUrl: (url: string) =>
          ipcRenderer.invoke("putenggame:open-auth-url", url) as Promise<void>,
        takeCallback: () =>
          ipcRenderer.invoke("putenggame:take-auth-callback") as Promise<
            string | undefined
          >,
        onCallback: (listener: () => void) => {
          const callback = () => listener();
          ipcRenderer.on("putenggame:auth-callback", callback);
          return () =>
            ipcRenderer.removeListener("putenggame:auth-callback", callback);
        },
      }),
    }),
  );
}
