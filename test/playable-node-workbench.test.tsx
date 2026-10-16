// @vitest-environment happy-dom
import path from "node:path";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type {
  NodePlayerDefinition,
  PlayableInteractionSelection,
} from "../src/shared/playable-player-protocol.js";

const getNodeRuntime = vi.fn();

vi.doMock(path.resolve("src/renderer/api.ts"), async (original) => ({
  ...(await original<typeof import("../src/renderer/api.js")>()),
  getNodeRuntime,
}));

const { PreviewToolbar, usePlayablePreviewRuntime } =
  await import("../src/renderer/playable-node-workbench.js");

const definition: NodePlayerDefinition = {
  version: 1,
  graph: {
    version: 1,
    title: "Preview",
    viewport: { width: 1280, height: 720 },
    entryNodeId: "start",
    initialState: {},
    assets: {},
    nodes: [
      {
        id: "start",
        title: "Start",
        source: {
          html: "nodes/start/index.html",
          css: "nodes/start/style.css",
          javascript: "nodes/start/node.js",
        },
        assets: [],
        signals: [],
      },
    ],
    edges: [],
  },
  graphSignature: "preview",
  compiled: {
    version: 1,
    nodes: {
      start: {
        id: "start",
        inputs: [],
        html: "<main>Start</main>",
        css: "",
        javascript: "",
      },
    },
  },
};

function Probe({
  revision,
  skip,
}: {
  revision: number;
  skip: { current: number };
}) {
  const runtime = usePlayablePreviewRuntime("project", revision, skip);
  return <output>{runtime.definition?.graph.title ?? "loading"}</output>;
}

let root: ReturnType<typeof createRoot>;
let container: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  getNodeRuntime.mockReset().mockResolvedValue({
    available: true,
    definition,
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

it("skips each consecutive source-save revision without reloading the preview", async () => {
  const skip = { current: 0 };
  await act(async () => root.render(<Probe revision={0} skip={skip} />));
  expect(getNodeRuntime).toHaveBeenCalledTimes(1);

  skip.current = 2;
  await act(async () => root.render(<Probe revision={1} skip={skip} />));
  await act(async () => root.render(<Probe revision={2} skip={skip} />));

  expect(getNodeRuntime).toHaveBeenCalledTimes(1);
  expect(skip.current).toBe(0);

  await act(async () => root.render(<Probe revision={3} skip={skip} />));
  expect(getNodeRuntime).toHaveBeenCalledTimes(2);
});

it("keeps a disappearance-time draft editable until the full value is committed", async () => {
  const onInteractionTiming = vi.fn();
  const selection: PlayableInteractionSelection = {
    pick: {
      nodeId: "start",
      source: "nodes/start/index.html:1:1",
      cssPath: "button",
      tag: "button",
      text: "Choice",
      box: { x: 0, y: 0, width: 100, height: 40 },
    },
    delaySeconds: 10,
    inPlace: true,
  };

  await act(async () =>
    root.render(
      <PreviewToolbar
        tool="select"
        disabled={false}
        strokes={0}
        picks={1}
        interactionSelection={selection}
        motionSignals={[]}
        mediaState={{ currentTime: 0, duration: 30, paused: true }}
        onMediaCommand={vi.fn()}
        onDeleteSelected={vi.fn()}
        fonts={[]}
        onTextStyle={vi.fn()}
        onInteractionTiming={onInteractionTiming}
        onApplyMotion={vi.fn(async () => {})}
        onRemoveMotion={vi.fn(async () => {})}
        onTool={vi.fn()}
        onUndoStroke={vi.fn()}
        onClearStrokes={vi.fn()}
      />,
    ),
  );

  const endSeconds = container.querySelector<HTMLInputElement>(
    '[aria-label="消失时间（秒）"]',
  )!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(endSeconds, "2");
    endSeconds.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(endSeconds.value).toBe("2");
  expect(onInteractionTiming).not.toHaveBeenCalled();

  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(endSeconds, "20");
    endSeconds.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(endSeconds.value).toBe("20");
  expect(onInteractionTiming).not.toHaveBeenCalled();

  await act(async () =>
    endSeconds.dispatchEvent(new FocusEvent("focusout", { bubbles: true })),
  );
  expect(onInteractionTiming).toHaveBeenCalledWith("disappear", 20);
});

it("offers motion presets and applies the chosen interaction mode", async () => {
  const onApplyMotion = vi.fn(async () => {});
  const selection = {
    nodeId: "start",
    source: "nodes/start/index.html:1:1",
    cssPath: "button",
    signal: "success",
    tag: "button",
    text: "Continue",
    box: { x: 0, y: 0, width: 100, height: 40 },
  };

  await act(async () =>
    root.render(
      <PreviewToolbar
        tool="select"
        disabled={false}
        strokes={0}
        picks={1}
        motionSelection={selection}
        motionSignals={[
          { id: "success", label: "成功" },
          { id: "timeout", label: "超时" },
        ]}
        mediaState={{ currentTime: 0, duration: 30, paused: true }}
        onMediaCommand={vi.fn()}
        onDeleteSelected={vi.fn()}
        fonts={[]}
        onTextStyle={vi.fn()}
        onInteractionTiming={vi.fn()}
        onApplyMotion={onApplyMotion}
        onRemoveMotion={vi.fn(async () => {})}
        onTool={vi.fn()}
        onUndoStroke={vi.fn()}
        onClearStrokes={vi.fn()}
      />,
    ),
  );

  await act(async () =>
    container.querySelector<HTMLButtonElement>('[title="打开动效库"]')!.click(),
  );
  expect(container.textContent).toContain("倒计时");
  expect(container.textContent).toContain("圆环进度");
  expect(container.textContent).toContain("长条进度");
  expect(container.textContent).toContain("长按蓄力");

  const choose = async (selector: string, value: string) => {
    const control = container.querySelector<HTMLSelectElement | HTMLInputElement>(
      selector,
    )!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        control instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLSelectElement.prototype,
        "value",
      )!.set!.call(control, value);
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
    });
  };
  await choose('[aria-label="动效类型"]', "hold-charge");
  await choose('[aria-label="运行方式"]', "interactive");
  await choose('[aria-label="持续时间（秒）"]', "4");
  await choose('[aria-label="超时出口"]', "timeout");
  const apply = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent?.includes("应用到选中元素"),
  )!;
  await act(async () => apply.click());
  expect(onApplyMotion).toHaveBeenCalledWith(
    expect.objectContaining({
      kind: "hold-charge",
      mode: "interactive",
      duration: 4,
      signal: "success",
      timeoutSignal: "timeout",
    }),
    false,
  );
});

it("previews and commits replacement-button image scaling", async () => {
  const pick = {
    nodeId: "start",
    source: "nodes/start/index.html:1:1",
    cssPath: "button",
    tag: "button",
    text: "Continue",
    buttonAssetId: "button-image",
    buttonAssetScale: 100,
    box: { x: 0, y: 0, width: 180, height: 48 },
  };
  const onPreviewButtonAssetScale = vi.fn();
  const onCommitButtonAssetScale = vi.fn(async () => true);
  await act(async () =>
    root.render(
      <PreviewToolbar
        tool="select"
        disabled={false}
        strokes={0}
        picks={1}
        motionSelection={pick}
        motionSignals={[]}
        mediaState={{ currentTime: 0, duration: 30, paused: true }}
        onMediaCommand={vi.fn()}
        onDeleteSelected={vi.fn()}
        fonts={[]}
        onTextStyle={vi.fn()}
        onInteractionTiming={vi.fn()}
        onApplyMotion={vi.fn(async () => {})}
        onRemoveMotion={vi.fn(async () => {})}
        onPreviewButtonAssetScale={onPreviewButtonAssetScale}
        onCommitButtonAssetScale={onCommitButtonAssetScale}
        onTool={vi.fn()}
        onUndoStroke={vi.fn()}
        onClearStrokes={vi.fn()}
      />,
    ),
  );

  const slider = container.querySelector<HTMLInputElement>(
    '.playable-preview-asset-scale-control input[type="range"]',
  )!;
  expect(container.querySelector("output")?.textContent).toBe("100%");
  expect(slider.min).toBe("50");
  expect(slider.max).toBe("200");
  expect(slider.step).toBe("1");

  await act(async () => {
    Object.defineProperty(slider, "value", {
      configurable: true,
      get: () => "135",
    });
    slider.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(container.querySelector("output")?.textContent).toBe("135%");
  expect(onPreviewButtonAssetScale).toHaveBeenCalledWith(pick, 135);

  await act(async () =>
    slider.dispatchEvent(new PointerEvent("pointerup", { bubbles: true })),
  );
  expect(onCommitButtonAssetScale).toHaveBeenCalledWith(pick, 135);

  await act(async () =>
    container
      .querySelector<HTMLButtonElement>(
        '[aria-label="重置按钮背景图大小"]',
      )!
      .click(),
  );
  expect(onPreviewButtonAssetScale).toHaveBeenLastCalledWith(pick, 100);
  expect(onCommitButtonAssetScale).toHaveBeenLastCalledWith(pick, 100);
});
