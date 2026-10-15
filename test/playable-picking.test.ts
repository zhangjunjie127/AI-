import { describe, expect, it, vi } from "vitest";
import { Window } from "happy-dom";
import {
  describePlayableSourceTarget,
  describePlayableAppearanceTarget,
  describePlayablePick,
  playableCssPath,
  playableTextPickWithSource,
  type PickableElement,
  type PlayablePickResult,
} from "../src/shared/playable-picker.js";
import {
  annotatePlayableSourceLocations,
  PLAYABLE_SOURCE_ATTRIBUTE,
} from "../src/shared/playable-source-locations.js";
import {
  isPlayableFrameMessage,
  isPlayableHostMessage,
  type PlayableElementCopy,
} from "../src/shared/playable-player-protocol.js";
import { DocumentPlayableSurfaceHost } from "../src/shared/playable-sandbox.js";

describe("annotatePlayableSourceLocations", () => {
  it("annotates start tags with one-based line and column", () => {
    const html = [
      '<main class="menu">',
      "  <button>Start</button>",
      "</main>",
    ].join("\n");

    expect(annotatePlayableSourceLocations(html, "nodes/menu/index.html")).toBe(
      [
        '<main data-putenggame-source="nodes/menu/index.html:1:1" class="menu">',
        '  <button data-putenggame-source="nodes/menu/index.html:2:3">Start</button>',
        "</main>",
      ].join("\n"),
    );
  });

  it("leaves comments, end tags, and raw text content untouched", () => {
    const html = [
      "<!-- <p>comment</p> -->",
      "<style>a > b { content: '<div>'; }</style>",
      "<script>if (1 < 2) document.querySelector('p');</script>",
      "<textarea><span>literal</span></textarea>",
      '<p data-value="a>b">1 < 2</p>',
    ].join("\n");

    const annotated = annotatePlayableSourceLocations(html, "index.html");

    expect(annotated).toContain("<!-- <p>comment</p> -->");
    expect(annotated).toContain("a > b { content: '<div>'; }");
    expect(annotated).toContain("if (1 < 2) document.querySelector('p');");
    expect(annotated).toContain(
      '<textarea data-putenggame-source="index.html:4:1"><span>literal</span></textarea>',
    );
    expect(annotated).toContain(
      '<p data-putenggame-source="index.html:5:1" data-value="a>b">',
    );
    // style, script, textarea, and p only.
    expect(annotated.match(/data-putenggame-source/g)).toHaveLength(4);
  });

  it("keeps an existing attribute and self-closing tags", () => {
    const html =
      '<img src="a.png" /><b data-putenggame-source="other:1:1">x</b>';

    expect(annotatePlayableSourceLocations(html, "index.html")).toBe(
      '<img data-putenggame-source="index.html:1:1" src="a.png" /><b data-putenggame-source="other:1:1">x</b>',
    );
  });
});

describe("describePlayablePick", () => {
  it("describes the picked element with its Node, source, and CSS path", () => {
    const surface = element("div", { "data-playable-surface": "menu" });
    const list = element(
      "ul",
      { [PLAYABLE_SOURCE_ATTRIBUTE]: "nodes/menu/index.html:2:3" },
      surface,
    );
    const first = element("li", {}, list);
    const second = element(
      "li",
      { [PLAYABLE_SOURCE_ATTRIBUTE]: "nodes/menu/index.html:4:5" },
      list,
      "  Open the\n archive  ",
    );
    expect(list.children).toEqual([first, second]);

    expect(describePlayablePick([second, list, surface, {}])).toEqual({
      nodeId: "menu",
      source: "nodes/menu/index.html:4:5",
      cssPath: "ul > li:nth-of-type(2)",
      tag: "li",
      text: "Open the archive",
      box: { x: 0, y: 0, width: 0, height: 0 },
    });
  });

  it("falls back to the nearest annotated ancestor and stops the path at an ID", () => {
    const surface = element("div", { "data-playable-surface": "shell" });
    const anchored = element(
      "section",
      { id: "cases", [PLAYABLE_SOURCE_ATTRIBUTE]: "shell/index.html:3:1" },
      surface,
    );
    const created = element("span", {}, anchored);

    expect(describePlayablePick([created, anchored, surface])).toMatchObject({
      nodeId: "shell",
      source: "shell/index.html:3:1",
      cssPath: "section#cases > span",
    });
  });

  it("names the Signal of the nearest data-signal element", () => {
    const surface = element("div", { "data-playable-surface": "menu" });
    const button = element("button", { "data-signal": "start" }, surface);
    const label = element("span", {}, button, "Start");

    expect(describePlayablePick([label, button, surface])).toMatchObject({
      signal: "start",
      tag: "span",
    });
    expect(describePlayablePick([surface.children[0]!, surface])?.signal).toBe(
      "start",
    );
    expect(
      describePlayablePick([element("p", {}, surface), surface])?.signal,
    ).toBeUndefined();
  });

  it("marks images, videos, and data-media slots as media", () => {
    const surface = element("div", { "data-playable-surface": "menu" });
    const backdrop = element("div", { "data-media": "backdrop" }, surface);
    const image = element("img", {}, surface);
    const text = element("p", {}, surface);

    expect(describePlayablePick([backdrop, surface])).toMatchObject({
      media: true,
      mediaSlot: "backdrop",
    });
    expect(describePlayablePick([image, surface])).toMatchObject({
      media: true,
    });
    expect(describePlayablePick([image, surface])?.mediaSlot).toBeUndefined();
    expect(describePlayablePick([text, surface])?.media).toBeUndefined();
  });

  it("ignores a path without a surface and a click on the surface itself", () => {
    const surface = element("div", { "data-playable-surface": "menu" });

    expect(describePlayablePick([surface, {}])).toBeUndefined();
    expect(describePlayablePick([element("p"), {}])).toBeUndefined();
    expect(describePlayablePick([])).toBeUndefined();
  });

  it("returns an unannotated element without a source", () => {
    const surface = element("div", { "data-playable-surface": "menu" });
    const created = element("p", {}, surface);

    const pick = describePlayablePick([created, surface]);

    expect(pick?.source).toBeUndefined();
    expect(playableCssPath(created)).toBe("p");
  });
});

describe("playableTextPickWithSource", () => {
  it("updates a pick made while a new text element was still saving", () => {
    const pick: PlayablePickResult = {
      nodeId: "scene",
      cssPath: "p#putenggame-text-1-1",
      tag: "p",
      text: "请问请问",
      box: { x: 1, y: 2, width: 40, height: 20 },
    };

    expect(
      playableTextPickWithSource(pick, {
        id: "putenggame-text-1-1",
        nodeId: "scene",
        source: "nodes/scene/index.html:8:1",
      }),
    ).toMatchObject({
      nodeId: "scene",
      cssPath: "p#putenggame-text-1-1",
      source: "nodes/scene/index.html:8:1",
    });
  });
});

describe("describePlayableSourceTarget", () => {
  it("uses the source-backed button when its label child is clicked", () => {
    const surface = element("div", { "data-playable-surface": "choice" });
    const button = element(
      "button",
      {
        [PLAYABLE_SOURCE_ATTRIBUTE]: "nodes/choice/index.html:5:5",
        "data-signal": "option-a",
      },
      surface,
    );
    const label = element("span", {}, button, "I had no choice.");

    expect(
      describePlayableSourceTarget([label, button, surface])?.pick,
    ).toMatchObject({
      source: "nodes/choice/index.html:5:5",
      tag: "button",
      signal: "option-a",
    });
  });
});

describe("describePlayableAppearanceTarget", () => {
  it("supports source-backed text and images but skips videos", () => {
    const surface = element("div", { "data-playable-surface": "scene" });
    const text = element(
      "p",
      { [PLAYABLE_SOURCE_ATTRIBUTE]: "nodes/scene/index.html:2:1" },
      surface,
      "Caption",
    );
    const image = element(
      "img",
      {
        class: "rise",
        [PLAYABLE_SOURCE_ATTRIBUTE]: "nodes/scene/index.html:3:1",
      },
      surface,
    );
    const video = element(
      "video",
      { [PLAYABLE_SOURCE_ATTRIBUTE]: "nodes/scene/index.html:4:1" },
      surface,
    );

    expect(
      describePlayableAppearanceTarget([text, surface])?.pick,
    ).toMatchObject({ tag: "p", source: "nodes/scene/index.html:2:1" });
    expect(
      describePlayableAppearanceTarget([image, surface])?.pick,
    ).toMatchObject({ tag: "img", source: "nodes/scene/index.html:3:1" });
    expect(describePlayableAppearanceTarget([video, surface])).toBeUndefined();
  });
});

describe("pick protocol messages", () => {
  it("accepts valid undo/redo commands from the preview frame", () => {
    expect(
      isPlayableFrameMessage({
        kind: "putenggame:playable:history-command",
        instanceId: "preview",
        command: "undo",
      }),
    ).toBe(true);
    expect(
      isPlayableFrameMessage({
        kind: "putenggame:playable:history-command",
        instanceId: "preview",
        command: "clear",
      }),
    ).toBe(false);
  });

  it("accepts pick messages in both directions", () => {
    expect(
      isPlayableHostMessage({
        kind: "putenggame:playable:pick-start",
        instanceId: "a",
        tool: "text",
      }),
    ).toBe(true);
    expect(
      isPlayableHostMessage({
        kind: "putenggame:playable:pick-start",
        instanceId: "a",
      }),
    ).toBe(false);
    expect(
      isPlayableHostMessage({
        kind: "putenggame:playable:pick-start",
        instanceId: "a",
        tool: "draw",
      }),
    ).toBe(false);
    expect(
      isPlayableHostMessage({
        kind: "putenggame:playable:pick-cancel",
        instanceId: "a",
      }),
    ).toBe(true);
    expect(
      isPlayableHostMessage({
        kind: "putenggame:playable:element-clipboard",
        instanceId: "a",
        action: "paste",
        sequence: 1,
      }),
    ).toBe(true);
    expect(
      isPlayableHostMessage({
        kind: "putenggame:playable:element-clipboard",
        instanceId: "a",
        action: "paste",
        sequence: 1.5,
      }),
    ).toBe(false);
    expect(
      isPlayableFrameMessage({
        kind: "putenggame:playable:picked",
        instanceId: "a",
        pick: { nodeId: "menu" },
        additive: true,
      }),
    ).toBe(true);
    expect(
      isPlayableFrameMessage({
        kind: "putenggame:playable:picked",
        instanceId: "a",
        pick: { nodeId: "menu" },
      }),
    ).toBe(false);
    expect(
      isPlayableFrameMessage({
        kind: "putenggame:playable:text-edited",
        instanceId: "a",
        edit: {
          pick: { nodeId: "menu" },
          before: "Start",
          after: "Begin",
          inPlace: true,
        },
      }),
    ).toBe(true);
    expect(
      isPlayableFrameMessage({
        kind: "putenggame:playable:text-edited",
        instanceId: "a",
        edit: { pick: { nodeId: "menu" }, before: "Start", after: "Begin" },
      }),
    ).toBe(false);
    expect(
      isPlayableHostMessage({
        kind: "putenggame:playable:pick-start",
        instanceId: "a",
        tool: "move",
      }),
    ).toBe(true);
    expect(
      isPlayableHostMessage({
        kind: "putenggame:playable:delete-element",
        instanceId: "a",
        pick: { nodeId: "menu", cssPath: "button" },
      }),
    ).toBe(true);
    expect(
      isPlayableHostMessage({
        kind: "putenggame:playable:delete-element",
        instanceId: "a",
      }),
    ).toBe(false);
    expect(
      isPlayableFrameMessage({
        kind: "putenggame:playable:seen",
        instanceId: "a",
        seen: { version: 1, nodes: {}, edges: {} },
      }),
    ).toBe(true);
    expect(
      isPlayableFrameMessage({
        kind: "putenggame:playable:seen",
        instanceId: "a",
        seen: [],
      }),
    ).toBe(false);
    expect(
      isPlayableFrameMessage({
        kind: "putenggame:playable:moved",
        instanceId: "a",
        move: {
          pick: { nodeId: "menu" },
          translate: { x: 2.5, y: -1 },
          inPlace: true,
        },
      }),
    ).toBe(true);
    expect(
      isPlayableFrameMessage({
        kind: "putenggame:playable:moved",
        instanceId: "a",
        move: {
          pick: { nodeId: "menu" },
          translate: { x: "2.5cqw", y: 0 },
          inPlace: true,
        },
      }),
    ).toBe(false);
    expect(
      isPlayableFrameMessage({
        kind: "putenggame:playable:pick-cancelled",
        instanceId: "a",
      }),
    ).toBe(true);
    expect(
      isPlayableFrameMessage({
        kind: "putenggame:playable:picked",
        instanceId: "a",
      }),
    ).toBe(false);
  });

  it("rejects an init message with a non-object preview", () => {
    const init = {
      kind: "putenggame:playable:init",
      instanceId: "a",
      definition: {},
      assets: {},
    };

    expect(isPlayableHostMessage(init)).toBe(true);
    expect(
      isPlayableHostMessage({ ...init, preview: { policy: "report" } }),
    ).toBe(true);
    expect(isPlayableHostMessage({ ...init, preview: "report" })).toBe(false);
  });
});

describe("DocumentPlayableSurfaceHost click selection", () => {
  it("picks a small text item beneath a non-selectable overlapping container", async () => {
    const window = new Window();
    Object.defineProperty(window, "top", { value: {} });
    Object.defineProperty(window, "origin", { value: "null" });
    Object.assign(globalThis, {
      MutationObserver: window.MutationObserver,
      HTMLElement: window.HTMLElement,
      Element: window.Element,
      ShadowRoot: window.ShadowRoot,
      Event: window.Event,
      getComputedStyle: window.getComputedStyle.bind(window),
    });
    const document = window.document as unknown as Document;
    const host = new DocumentPlayableSurfaceHost(document, async () => ({
      mount: async () => undefined,
    }));
    await host.mountNode(
      {
        id: "ending",
        html: [
          '<main data-putenggame-source="nodes/ending/index.html:1:1">',
          '<p data-putenggame-source="nodes/ending/index.html:2:1">结局</p>',
          '<div data-putenggame-source="nodes/ending/index.html:3:1" class="sealed">',
          '<h1 data-putenggame-source="nodes/ending/index.html:4:1">Ending</h1>',
          "</div></main>",
        ].join(""),
        css: "",
        javascript: "",
        inputs: [],
      },
      {} as never,
    );
    const root = document.querySelector<HTMLElement>(
      '[data-playable-sandbox="true"]',
    )!;
    const surface = document.querySelector<HTMLElement>(
      '[data-playable-surface="ending"]',
    )!;
    const overlay = surface.shadowRoot!.querySelector<HTMLElement>(".sealed")!;
    const caption = surface.shadowRoot!.querySelector<HTMLElement>("p")!;
    Object.defineProperty(root, "getBoundingClientRect", {
      value: () => ({ x: 0, y: 0, width: 640, height: 360 }),
    });
    Object.defineProperty(surface, "getBoundingClientRect", {
      value: () => ({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        width: 640,
        height: 360,
      }),
    });
    Object.defineProperty(caption, "getBoundingClientRect", {
      value: () => ({
        x: 20,
        y: 20,
        left: 20,
        top: 20,
        right: 70,
        bottom: 36,
        width: 50,
        height: 16,
      }),
    });
    Object.defineProperty(overlay, "getBoundingClientRect", {
      value: () => ({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 120,
        bottom: 120,
        width: 120,
        height: 120,
      }),
    });
    Object.defineProperty(
      surface.shadowRoot!.querySelector<HTMLElement>("h1")!,
      "getBoundingClientRect",
      {
        value: () => ({
          x: 80,
          y: 80,
          left: 80,
          top: 80,
          right: 110,
          bottom: 100,
          width: 30,
          height: 20,
        }),
      },
    );

    const onPick = vi.fn();
    host.startPicking("select", {
      onPick,
      onTextSelect: () => undefined,
      onInteractionSelect: () => undefined,
      onTextEdit: () => undefined,
      onTextCreate: () => undefined,
      onMove: () => undefined,
      onTransform: () => undefined,
      onDelete: () => undefined,
      onPasteElements: async () => undefined,
      onCancel: () => undefined,
    });
    const down = new Event("pointerdown", { bubbles: true, composed: true });
    Object.assign(down, {
      button: 0,
      pointerId: 1,
      clientX: 30,
      clientY: 26,
      shiftKey: false,
      metaKey: false,
      ctrlKey: false,
    });
    overlay.dispatchEvent(down);
    const up = new Event("pointerup", { bubbles: true, composed: true });
    Object.assign(up, { button: 0, pointerId: 1, clientX: 30, clientY: 26 });
    root.dispatchEvent(up);
    const click = new Event("click", { bubbles: true, composed: true });
    Object.assign(click, { clientX: 30, clientY: 26 });
    root.dispatchEvent(click);

    expect(onPick).toHaveBeenCalledOnce();
    expect(onPick.mock.calls[0]![0]).toMatchObject({
      tag: "p",
      text: "结局",
      source: "nodes/ending/index.html:2:1",
    });
    expect(
      root.querySelector<HTMLElement>('[data-playable-pick-outline="true"]')
        ?.style.top,
    ).toBe("20px");

    host.stopPicking();
    const onMove = vi.fn();
    host.startPicking("move", {
      onPick: () => undefined,
      onTextSelect: () => undefined,
      onInteractionSelect: () => undefined,
      onTextEdit: () => undefined,
      onTextCreate: () => undefined,
      onMove,
      onTransform: () => undefined,
      onDelete: () => undefined,
      onPasteElements: async () => undefined,
      onCancel: () => undefined,
    });
    const moveDown = new Event("pointerdown", {
      bubbles: true,
      composed: true,
    });
    Object.assign(moveDown, {
      button: 0,
      pointerId: 2,
      clientX: 30,
      clientY: 26,
    });
    overlay.dispatchEvent(moveDown);
    const move = new Event("pointermove", { bubbles: true, composed: true });
    Object.assign(move, { pointerId: 2, clientX: 45, clientY: 36 });
    root.dispatchEvent(move);
    const moveUp = new Event("pointerup", { bubbles: true, composed: true });
    Object.assign(moveUp, {
      button: 0,
      pointerId: 2,
      clientX: 45,
      clientY: 36,
    });
    root.dispatchEvent(moveUp);

    expect(onMove).toHaveBeenCalledOnce();
    expect(onMove.mock.calls[0]![0].pick).toMatchObject({
      tag: "p",
      text: "结局",
      source: "nodes/ending/index.html:2:1",
    });
    host.destroy();
    window.close();
  });

  it("adds new text on a double-clicked blank area and keeps it source-editable", async () => {
    const window = new Window();
    Object.defineProperty(window, "top", { value: {} });
    Object.defineProperty(window, "origin", { value: "null" });
    Object.assign(globalThis, {
      MutationObserver: window.MutationObserver,
      HTMLElement: window.HTMLElement,
      Element: window.Element,
      ShadowRoot: window.ShadowRoot,
      Event: window.Event,
      getComputedStyle: window.getComputedStyle.bind(window),
    });
    const document = window.document as unknown as Document;
    const host = new DocumentPlayableSurfaceHost(document, async () => ({
      mount: async () => undefined,
    }));
    await host.mountNode(
      {
        id: "choice",
        html: '<main data-putenggame-source="nodes/choice/index.html:1:1"><div data-media="backdrop"></div></main>',
        css: "",
        javascript: "",
        inputs: [],
      },
      {} as never,
    );
    const root = document.querySelector<HTMLElement>(
      '[data-playable-sandbox="true"]',
    )!;
    const surface = document.querySelector<HTMLElement>(
      '[data-playable-surface="choice"]',
    )!;
    const main = surface.shadowRoot!.querySelector<HTMLElement>("main")!;
    Object.defineProperty(root, "getBoundingClientRect", {
      value: () => ({ x: 0, y: 0, width: 640, height: 360 }),
    });
    Object.defineProperty(surface, "getBoundingClientRect", {
      value: () => ({
        x: 0,
        y: 0,
        width: 640,
        height: 360,
        left: 0,
        top: 0,
      }),
    });
    const onTextCreate = vi.fn();
    host.startPicking("text", {
      onPick: () => undefined,
      onTextSelect: () => undefined,
      onInteractionSelect: () => undefined,
      onTextEdit: () => undefined,
      onTextCreate,
      onMove: () => undefined,
      onTransform: () => undefined,
      onDelete: () => undefined,
      onPasteElements: async () => undefined,
      onCancel: () => undefined,
    });

    const doubleClick = new Event("dblclick", {
      bubbles: true,
      composed: true,
    });
    Object.assign(doubleClick, { clientX: 128, clientY: 90 });
    main.dispatchEvent(doubleClick);
    const input = main.querySelector<HTMLElement>(
      '[contenteditable="plaintext-only"]',
    )!;
    expect(input).toBeDefined();
    expect(input.style.position).toBe("absolute");

    input.textContent = "New caption";
    const enter = new Event("keydown", { bubbles: true, composed: true });
    Object.assign(enter, { key: "Enter", shiftKey: false });
    input.dispatchEvent(enter);
    expect(onTextCreate).toHaveBeenCalledWith({
      id: input.id,
      nodeId: "choice",
      text: "New caption",
      x: 20,
      y: 25,
    });
    host.setTextSource(input.id, "nodes/choice/index.html:1:82");
    expect(input.getAttribute("data-putenggame-source")).toBe(
      "nodes/choice/index.html:1:82",
    );
    host.destroy();
    window.close();
  });

  it("updates an element's appearance timing without rebuilding its video", async () => {
    const window = new Window();
    Object.defineProperty(window, "top", { value: {} });
    Object.defineProperty(window, "origin", { value: "null" });
    Object.assign(globalThis, {
      MutationObserver: window.MutationObserver,
      HTMLElement: window.HTMLElement,
      Element: window.Element,
      ShadowRoot: window.ShadowRoot,
      Event: window.Event,
      getComputedStyle: window.getComputedStyle.bind(window),
    });
    const document = window.document as unknown as Document;
    const host = new DocumentPlayableSurfaceHost(document, async () => ({
      mount: async () => undefined,
    }));
    await host.mountNode(
      {
        id: "choice",
        html: [
          '<main><div data-media="backdrop"><video src="backdrop.mp4"></video></div>',
          '<button data-putenggame-source="nodes/choice/index.html:2:1">Choice</button>',
          '<button data-putenggame-source="nodes/choice/index.html:3:1">Next</button></main>',
        ].join(""),
        css: "",
        javascript: "",
        inputs: [],
      },
      {} as never,
    );
    const surface = document.querySelector<HTMLElement>(
      '[data-playable-surface="choice"]',
    )!;
    const video = surface.shadowRoot!.querySelector<HTMLVideoElement>("video")!;
    const button =
      surface.shadowRoot!.querySelector<HTMLButtonElement>("button")!;
    const secondButton =
      surface.shadowRoot!.querySelectorAll<HTMLButtonElement>("button")[1]!;
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      value: 42,
    });
    const animations = [
      { animationName: "rise", currentTime: 0 },
      { animationName: "rise-up", currentTime: 0 },
    ];
    Object.defineProperty(button, "getAnimations", {
      configurable: true,
      value: () => animations,
    });

    host.updateAppearanceTiming([
      {
        pick: {
          nodeId: "choice",
          source: "nodes/choice/index.html:2:1",
          cssPath: "main > button:nth-of-type(1)",
          tag: "button",
          text: "Choice",
          box: { x: 0, y: 0, width: 100, height: 40 },
        },
        delaySeconds: 80,
        endSeconds: 90,
      },
      {
        pick: {
          nodeId: "choice",
          source: "nodes/choice/index.html:3:1",
          cssPath: "main > button:nth-of-type(2)",
          tag: "button",
          text: "Next",
          box: { x: 0, y: 0, width: 100, height: 40 },
        },
        delaySeconds: 80,
        endSeconds: 90,
      },
    ]);

    expect(surface.shadowRoot!.querySelector<HTMLButtonElement>("button")).toBe(
      button,
    );
    expect(
      surface.shadowRoot!.querySelectorAll<HTMLButtonElement>("button")[1],
    ).toBe(secondButton);
    expect(button.style.getPropertyValue("--delay")).toBe("0s");
    expect(secondButton.style.getPropertyValue("--delay")).toBe("0s");
    expect(button.style.getPropertyValue("--putenggame-appear-at")).toBe("80s");
    expect(secondButton.style.getPropertyValue("--putenggame-appear-at")).toBe(
      "80s",
    );
    expect(button.style.getPropertyValue("--putenggame-disappear-at")).toBe(
      "90s",
    );
    expect(
      secondButton.style.getPropertyValue("--putenggame-disappear-at"),
    ).toBe("90s");
    expect(button.classList.contains("rise")).toBe(true);
    expect(secondButton.classList.contains("rise")).toBe(true);
    expect(animations.map(({ currentTime }) => currentTime)).toEqual([0, 0]);
    expect(video.currentTime).toBe(42);
  });

  it("keeps overlays visible after video end unless they have a disappearance time", async () => {
    const window = new Window();
    Object.defineProperty(window, "top", { value: {} });
    Object.defineProperty(window, "origin", { value: "null" });
    Object.assign(globalThis, {
      MutationObserver: window.MutationObserver,
      HTMLElement: window.HTMLElement,
      Element: window.Element,
      ShadowRoot: window.ShadowRoot,
      Event: window.Event,
      getComputedStyle: window.getComputedStyle.bind(window),
    });
    const document = window.document as unknown as Document;
    const host = new DocumentPlayableSurfaceHost(document, async () => ({
      mount: async () => undefined,
    }));
    await host.mountNode(
      {
        id: "choice",
        html: [
          '<main><div data-media="backdrop"><video src="backdrop.mp4"></video></div>',
          '<button data-putenggame-source="nodes/choice/index.html:2:1">Choice</button>',
          '<img data-putenggame-source="nodes/choice/index.html:3:1" src="overlay.png">',
          '<p data-putenggame-source="nodes/choice/index.html:4:1">Untimed</p></main>',
        ].join(""),
        css: "",
        javascript: "",
        inputs: [],
      },
      {} as never,
    );
    const surface = document.querySelector<HTMLElement>(
      '[data-playable-surface="choice"]',
    )!;
    const video = surface.shadowRoot!.querySelector<HTMLVideoElement>("video")!;
    const button =
      surface.shadowRoot!.querySelector<HTMLButtonElement>("button")!;
    const image = surface.shadowRoot!.querySelector<HTMLImageElement>("img")!;
    const untimed =
      surface.shadowRoot!.querySelector<HTMLParagraphElement>("p")!;
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      writable: true,
      value: 0,
    });
    Object.defineProperty(video, "duration", {
      configurable: true,
      value: 12,
    });

    host.updateAppearanceTiming([
      {
        pick: {
          nodeId: "choice",
          source: "nodes/choice/index.html:2:1",
          cssPath: "main > button",
          tag: "button",
          text: "Choice",
          box: { x: 0, y: 0, width: 100, height: 40 },
        },
        delaySeconds: 5,
        endSeconds: 9,
      },
      {
        pick: {
          nodeId: "choice",
          source: "nodes/choice/index.html:3:1",
          cssPath: "main > img",
          tag: "img",
          text: "",
          box: { x: 0, y: 0, width: 100, height: 40 },
        },
        delaySeconds: 5,
      },
    ]);

    const timeUpdate = (time: number) => {
      video.currentTime = time;
      video.dispatchEvent(new window.Event("timeupdate") as unknown as Event);
    };
    expect(button.hasAttribute("data-playable-timing-hidden")).toBe(true);
    expect(image.hasAttribute("data-playable-timing-hidden")).toBe(true);
    timeUpdate(5);
    expect(button.hasAttribute("data-playable-timing-hidden")).toBe(false);
    expect(image.hasAttribute("data-playable-timing-hidden")).toBe(false);
    timeUpdate(9);
    expect(button.hasAttribute("data-playable-timing-hidden")).toBe(true);
    expect(image.hasAttribute("data-playable-timing-hidden")).toBe(false);
    timeUpdate(6);
    expect(button.hasAttribute("data-playable-timing-hidden")).toBe(false);
    timeUpdate(9);
    expect(button.hasAttribute("data-playable-timing-hidden")).toBe(true);
    host.updateAppearanceTiming([
      {
        pick: {
          nodeId: "choice",
          source: "nodes/choice/index.html:2:1",
          cssPath: "main > button",
          tag: "button",
          text: "Choice",
          box: { x: 0, y: 0, width: 100, height: 40 },
        },
        delaySeconds: 5,
      },
    ]);
    expect(button.hasAttribute("data-playable-timing-hidden")).toBe(false);
    timeUpdate(10);
    expect(button.hasAttribute("data-playable-timing-hidden")).toBe(false);
    timeUpdate(12);
    expect(button.hasAttribute("data-playable-timing-hidden")).toBe(false);
    expect(image.hasAttribute("data-playable-timing-hidden")).toBe(false);
    expect(untimed.hasAttribute("data-playable-timing-hidden")).toBe(false);
    Object.defineProperty(video, "ended", { configurable: true, value: true });
    video.dispatchEvent(new window.Event("ended") as unknown as Event);
    expect(button.hasAttribute("data-playable-timing-hidden")).toBe(false);
    expect(image.hasAttribute("data-playable-timing-hidden")).toBe(false);
    expect(untimed.hasAttribute("data-playable-timing-hidden")).toBe(false);
  });

  it("keeps a click selectable when pointer capture retargets the click to the root", async () => {
    const window = new Window();
    Object.defineProperty(window, "top", { value: {} });
    Object.defineProperty(window, "origin", { value: "null" });
    Object.assign(globalThis, {
      MutationObserver: window.MutationObserver,
      HTMLElement: window.HTMLElement,
      Element: window.Element,
      ShadowRoot: window.ShadowRoot,
      Event: window.Event,
      getComputedStyle: window.getComputedStyle.bind(window),
    });
    const document = window.document as unknown as Document;
    const host = new DocumentPlayableSurfaceHost(document, async () => ({
      mount: async () => undefined,
    }));
    await host.mountNode(
      {
        id: "choice",
        html: '<button data-putenggame-source="nodes/choice/index.html:1:1">Choice</button>',
        css: "",
        javascript: "",
        inputs: [],
      },
      {} as never,
    );
    const root = document.querySelector<HTMLElement>(
      '[data-playable-sandbox="true"]',
    )!;
    const surface = document.querySelector<HTMLElement>(
      '[data-playable-surface="choice"]',
    )!;
    const button =
      surface.shadowRoot!.querySelector<HTMLButtonElement>("button")!;
    Object.defineProperty(root, "getBoundingClientRect", {
      value: () => ({ x: 0, y: 0, width: 720, height: 1280 }),
    });
    Object.defineProperty(button, "getBoundingClientRect", {
      value: () => ({ x: 10, y: 20, width: 200, height: 40 }),
    });
    const picks: string[] = [];
    host.startPicking("select", {
      onPick: (pick) => picks.push(pick.cssPath),
      onTextSelect: () => undefined,
      onInteractionSelect: () => undefined,
      onTextEdit: () => undefined,
      onTextCreate: () => undefined,
      onMove: () => undefined,
      onTransform: () => undefined,
      onDelete: () => undefined,
      onPasteElements: async () => undefined,
      onCancel: () => undefined,
    });

    const down = new Event("pointerdown", { bubbles: true, composed: true });
    Object.assign(down, {
      button: 0,
      pointerId: 1,
      clientX: 20,
      clientY: 30,
      shiftKey: false,
      metaKey: false,
      ctrlKey: false,
    });
    button.dispatchEvent(down);
    const up = new Event("pointerup", { bubbles: true, composed: true });
    Object.assign(up, { button: 0, pointerId: 1, clientX: 20, clientY: 30 });
    root.dispatchEvent(up);
    root.dispatchEvent(new Event("click", { bubbles: true, composed: true }));

    expect(picks).toEqual(["button"]);
    expect(
      document.querySelector<HTMLElement>('[data-playable-pick-outline="true"]')
        ?.style.display,
    ).toBe("block");
  });

  it("moves only the individual source-backed item inside a group container", async () => {
    const window = new Window();
    Object.defineProperty(window, "top", { value: {} });
    Object.defineProperty(window, "origin", { value: "null" });
    Object.assign(globalThis, {
      MutationObserver: window.MutationObserver,
      HTMLElement: window.HTMLElement,
      Element: window.Element,
      ShadowRoot: window.ShadowRoot,
      Event: window.Event,
      getComputedStyle: window.getComputedStyle.bind(window),
    });
    const document = window.document as unknown as Document;
    const host = new DocumentPlayableSurfaceHost(document, async () => ({
      mount: async () => undefined,
    }));
    await host.mountNode(
      {
        id: "choice",
        html: [
          '<main data-putenggame-source="nodes/choice/index.html:1:1">',
          '<div id="group" data-putenggame-source="nodes/choice/index.html:2:1">',
          '<h1 id="title" data-putenggame-source="nodes/choice/index.html:3:1">Title</h1>',
          '<img id="picture" data-putenggame-source="nodes/choice/index.html:4:1">',
          '<button id="action" data-signal="next" data-putenggame-source="nodes/choice/index.html:5:1">Next</button>',
          "</div></main>",
        ].join(""),
        css: "",
        javascript: "",
        inputs: [],
      },
      {} as never,
    );
    const root = document.querySelector<HTMLElement>(
      '[data-playable-sandbox="true"]',
    )!;
    const surface = document.querySelector<HTMLElement>(
      '[data-playable-surface="choice"]',
    )!;
    const group = surface.shadowRoot!.getElementById("group")!;
    const title = surface.shadowRoot!.getElementById("title")!;
    Object.defineProperty(root, "getBoundingClientRect", {
      value: () => ({ x: 0, y: 0, width: 640, height: 360 }),
    });
    Object.defineProperty(surface, "getBoundingClientRect", {
      value: () => ({ x: 0, y: 0, width: 640, height: 360, left: 0, top: 0 }),
    });
    const onMove = vi.fn();
    host.startPicking("move", {
      onPick: () => undefined,
      onTextSelect: () => undefined,
      onInteractionSelect: () => undefined,
      onTextEdit: () => undefined,
      onTextCreate: () => undefined,
      onMove,
      onTransform: () => undefined,
      onDelete: () => undefined,
      onPasteElements: async () => undefined,
      onCancel: () => undefined,
    });

    const drag = (target: HTMLElement, pointerId: number) => {
      const down = new Event("pointerdown", { bubbles: true, composed: true });
      Object.assign(down, {
        button: 0,
        pointerId,
        clientX: 10,
        clientY: 10,
      });
      target.dispatchEvent(down);
      const move = new Event("pointermove", { bubbles: true, composed: true });
      Object.assign(move, { pointerId, clientX: 30, clientY: 30 });
      root.dispatchEvent(move);
      const up = new Event("pointerup", { bubbles: true, composed: true });
      Object.assign(up, { button: 0, pointerId, clientX: 30, clientY: 30 });
      root.dispatchEvent(up);
    };

    drag(group, 1);
    expect(onMove).not.toHaveBeenCalled();
    drag(title, 2);
    expect(onMove).toHaveBeenCalledOnce();
    expect(onMove.mock.calls[0]![0].pick.cssPath).toBe("h1#title");

    host.destroy();
    window.close();
  });

  it("copies and pastes selected scene elements in place with fresh source IDs", async () => {
    const window = new Window();
    Object.defineProperty(window, "top", { value: {} });
    Object.defineProperty(window, "origin", { value: "null" });
    Object.assign(globalThis, {
      MutationObserver: window.MutationObserver,
      HTMLElement: window.HTMLElement,
      Element: window.Element,
      ShadowRoot: window.ShadowRoot,
      Event: window.Event,
      getComputedStyle: window.getComputedStyle.bind(window),
    });
    const document = window.document as unknown as Document;
    const host = new DocumentPlayableSurfaceHost(document, async () => ({
      mount: async () => undefined,
    }));
    await host.mountNode(
      {
        id: "choice",
        html: '<main><button id="choice-a" data-signal="option-a" data-putenggame-source="nodes/choice/index.html:1:7"><span data-putenggame-source="nodes/choice/index.html:1:74">Choose</span></button></main>',
        css: "",
        javascript: "",
        inputs: [],
      },
      {} as never,
    );
    const root = document.querySelector<HTMLElement>(
      '[data-playable-sandbox="true"]',
    )!;
    const surface = document.querySelector<HTMLElement>(
      '[data-playable-surface="choice"]',
    )!;
    const button =
      surface.shadowRoot!.querySelector<HTMLButtonElement>("button")!;
    Object.defineProperty(root, "getBoundingClientRect", {
      value: () => ({ x: 0, y: 0, width: 640, height: 360 }),
    });
    Object.defineProperty(surface, "getBoundingClientRect", {
      value: () => ({ x: 0, y: 0, width: 640, height: 360, left: 0, top: 0 }),
    });
    const onPasteElements = vi.fn(async (copies: PlayableElementCopy[]) =>
      Object.fromEntries(
        copies.flatMap((copy) =>
          copy.ids.map((id, index) => [
            id,
            `nodes/choice/index.html:${index + 2}:1`,
          ]),
        ),
      ),
    );
    host.startPicking("select", {
      onPick: () => undefined,
      onTextSelect: () => undefined,
      onInteractionSelect: () => undefined,
      onTextEdit: () => undefined,
      onTextCreate: () => undefined,
      onMove: () => undefined,
      onTransform: () => undefined,
      onDelete: () => undefined,
      onPasteElements,
      onCancel: () => undefined,
    });

    const down = new Event("pointerdown", { bubbles: true, composed: true });
    Object.assign(down, {
      button: 0,
      pointerId: 1,
      clientX: 20,
      clientY: 30,
      shiftKey: false,
      metaKey: false,
      ctrlKey: false,
    });
    button.dispatchEvent(down);
    const up = new Event("pointerup", { bubbles: true, composed: true });
    Object.assign(up, { button: 0, pointerId: 1, clientX: 20, clientY: 30 });
    root.dispatchEvent(up);
    root.dispatchEvent(new Event("click", { bubbles: true, composed: true }));

    const copy = new Event("keydown", { bubbles: true, composed: true });
    Object.assign(copy, { key: "c", ctrlKey: true, metaKey: false });
    button.dispatchEvent(copy);
    await host.pastePickedElements();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const buttons = surface.shadowRoot!.querySelectorAll("button");
    expect(buttons).toHaveLength(2);
    expect(onPasteElements).toHaveBeenCalledOnce();
    expect(onPasteElements.mock.calls[0]![0][0]!.previewHtml).toContain(
      'id="putenggame-copy-',
    );
    expect(buttons[1]!.id).toMatch(/^putenggame-copy-/);
    expect(buttons[1]!.getAttribute("data-signal")).toBe("option-a");
    expect(buttons[1]!.getAttribute("data-putenggame-source")).toBe(
      "nodes/choice/index.html:2:1",
    );
    expect(buttons[1]!.style.translate).not.toContain("calc(");
    expect(
      buttons[1]!.querySelector("span")!.getAttribute("data-putenggame-source"),
    ).toBe("nodes/choice/index.html:3:1");

    buttons[1]!.style.translate =
      "calc(2cqw + 0px) calc(2cqh + 0px)";
    const onMove = vi.fn();
    host.startPicking("move", {
      onPick: () => undefined,
      onTextSelect: () => undefined,
      onInteractionSelect: () => undefined,
      onTextEdit: () => undefined,
      onTextCreate: () => undefined,
      onMove,
      onTransform: () => undefined,
      onDelete: () => undefined,
      onPasteElements,
      onCancel: () => undefined,
    });
    const moveDown = new Event("pointerdown", { bubbles: true, composed: true });
    Object.assign(moveDown, {
      button: 0,
      pointerId: 2,
      clientX: 20,
      clientY: 30,
    });
    buttons[1]!.dispatchEvent(moveDown);
    const move = new Event("pointermove", { bubbles: true, composed: true });
    Object.assign(move, { pointerId: 2, clientX: 40, clientY: 50 });
    root.dispatchEvent(move);
    const moveUp = new Event("pointerup", { bubbles: true, composed: true });
    Object.assign(moveUp, { button: 0, pointerId: 2, clientX: 40, clientY: 50 });
    root.dispatchEvent(moveUp);

    expect(onMove).toHaveBeenCalledOnce();
    expect(onMove.mock.calls[0]![0]).toMatchObject({
      inPlace: true,
      translate: { x: 5.13, y: 7.56 },
    });
    expect(buttons[1]!.style.translate).not.toContain("calc(");

    host.destroy();
    window.close();
  });

  it("shows boxes for frame-selected buttons, text, images, foreground video, and QTE", async () => {
    const window = new Window();
    Object.defineProperty(window, "top", { value: {} });
    Object.defineProperty(window, "origin", { value: "null" });
    Object.assign(globalThis, {
      MutationObserver: window.MutationObserver,
      HTMLElement: window.HTMLElement,
      Element: window.Element,
      ShadowRoot: window.ShadowRoot,
      Event: window.Event,
      getComputedStyle: window.getComputedStyle.bind(window),
    });
    const document = window.document as unknown as Document;
    const host = new DocumentPlayableSurfaceHost(document, async () => ({
      mount: async () => undefined,
    }));
    await host.mountNode(
      {
        id: "choice",
        html: [
          '<main data-putenggame-source="nodes/choice/index.html:1:1">',
          '<div data-media="backdrop" data-putenggame-source="nodes/choice/index.html:2:1"></div>',
          '<button data-signal="option-a" data-putenggame-source="nodes/choice/index.html:3:1"><kbd data-putenggame-source="nodes/choice/index.html:3:8">1</kbd>Choice</button>',
          '<p data-putenggame-source="nodes/choice/index.html:4:1">Caption</p>',
          '<img data-putenggame-source="nodes/choice/index.html:5:1">',
          '<video data-putenggame-source="nodes/choice/index.html:6:1"></video>',
          '<div data-qte="tap" data-putenggame-source="nodes/choice/index.html:7:1"><span data-putenggame-source="nodes/choice/index.html:7:10">Tap</span></div>',
          "</main>",
        ].join(""),
        css: "",
        javascript: "",
        inputs: [],
      },
      {} as never,
    );
    const root = document.querySelector<HTMLElement>(
      '[data-playable-sandbox="true"]',
    )!;
    const surface = document.querySelector<HTMLElement>(
      '[data-playable-surface="choice"]',
    )!;
    const elements = {
      backdrop: surface.shadowRoot!.querySelector<HTMLElement>(
        '[data-media="backdrop"]',
      )!,
      button: surface.shadowRoot!.querySelector<HTMLButtonElement>("button")!,
      label: surface.shadowRoot!.querySelector<HTMLElement>("kbd")!,
      text: surface.shadowRoot!.querySelector<HTMLElement>("p")!,
      image: surface.shadowRoot!.querySelector<HTMLImageElement>("img")!,
      video: surface.shadowRoot!.querySelector<HTMLVideoElement>("video")!,
      qte: surface.shadowRoot!.querySelector<HTMLElement>("[data-qte]")!,
    };
    Object.defineProperty(root, "getBoundingClientRect", {
      value: () => ({ x: 0, y: 0, width: 720, height: 1280 }),
    });
    for (const [name, element] of Object.entries(elements)) {
      const boxes: Record<
        string,
        { x: number; y: number; width: number; height: number }
      > = {
        backdrop: { x: 0, y: 0, width: 720, height: 1280 },
        button: { x: 100, y: 100, width: 220, height: 50 },
        label: { x: 110, y: 115, width: 24, height: 20 },
        text: { x: 100, y: 200, width: 200, height: 30 },
        image: { x: 100, y: 300, width: 180, height: 100 },
        video: { x: 100, y: 420, width: 240, height: 120 },
        qte: { x: 100, y: 580, width: 160, height: 48 },
      };
      Object.defineProperty(element, "getBoundingClientRect", {
        value: () => boxes[name],
      });
    }
    const picks: string[] = [];
    host.startPicking("select", {
      onPick: (pick) => picks.push(pick.cssPath),
      onTextSelect: () => undefined,
      onInteractionSelect: () => undefined,
      onTextEdit: () => undefined,
      onTextCreate: () => undefined,
      onMove: () => undefined,
      onTransform: () => undefined,
      onDelete: () => undefined,
      onPasteElements: async () => undefined,
      onCancel: () => undefined,
    });

    const down = new Event("pointerdown", { bubbles: true, composed: true });
    Object.assign(down, {
      button: 0,
      pointerId: 1,
      clientX: 90,
      clientY: 90,
      shiftKey: false,
      metaKey: false,
      ctrlKey: false,
    });
    root.dispatchEvent(down);
    const move = new Event("pointermove", { bubbles: true, composed: true });
    Object.assign(move, { pointerId: 1, clientX: 380, clientY: 650 });
    root.dispatchEvent(move);
    const up = new Event("pointerup", { bubbles: true, composed: true });
    Object.assign(up, { button: 0, pointerId: 1, clientX: 380, clientY: 650 });
    root.dispatchEvent(up);

    expect(picks).toEqual([
      "main > button",
      "main > p",
      "main > img",
      "main > video",
      "main > div:nth-of-type(2)",
    ]);
    expect(
      document.querySelectorAll("[data-playable-pick-outline]").length,
    ).toBe(5);
  });

  it("routes undo and redo shortcuts pressed in the scene preview to its editor", async () => {
    const window = new Window();
    Object.defineProperty(window, "top", { value: {} });
    Object.defineProperty(window, "origin", { value: "null" });
    Object.assign(globalThis, {
      MutationObserver: window.MutationObserver,
      HTMLElement: window.HTMLElement,
      Element: window.Element,
      ShadowRoot: window.ShadowRoot,
      Event: window.Event,
      getComputedStyle: window.getComputedStyle.bind(window),
    });
    const document = window.document as unknown as Document;
    const host = new DocumentPlayableSurfaceHost(document, async () => ({
      mount: async () => undefined,
    }));
    await host.mountNode(
      {
        id: "choice",
        html: '<main data-putenggame-source="nodes/choice/index.html:1:1"><button data-putenggame-source="nodes/choice/index.html:1:73">Choice</button></main>',
        css: "",
        javascript: "",
        inputs: [],
      },
      {} as never,
    );
    const onHistoryCommand = vi.fn();
    host.startPicking("select", {
      onPick: () => undefined,
      onTextSelect: () => undefined,
      onInteractionSelect: () => undefined,
      onTextEdit: () => undefined,
      onTextCreate: () => undefined,
      onMove: () => undefined,
      onTransform: () => undefined,
      onDelete: () => undefined,
      onPasteElements: async () => undefined,
      onHistoryCommand,
      onCancel: () => undefined,
    });

    document.body.dispatchEvent(
      new window.KeyboardEvent("keydown", {
        bubbles: true,
        key: "z",
        ctrlKey: true,
      }) as unknown as Event,
    );
    document.body.dispatchEvent(
      new window.KeyboardEvent("keydown", {
        bubbles: true,
        key: "z",
        ctrlKey: true,
        shiftKey: true,
      }) as unknown as Event,
    );
    document.body.dispatchEvent(
      new window.KeyboardEvent("keydown", {
        bubbles: true,
        key: "y",
        ctrlKey: true,
      }) as unknown as Event,
    );

    expect(onHistoryCommand.mock.calls).toEqual([
      ["undo"],
      ["redo"],
      ["redo"],
    ]);
    host.destroy();
    window.close();
  });
});

interface FakeElement extends PickableElement {
  children: FakeElement[];
}

function element(
  tag: string,
  attributes: Record<string, string> = {},
  parent?: FakeElement,
  text = "",
): FakeElement {
  const node: FakeElement = {
    tagName: tag.toUpperCase(),
    id: attributes.id ?? "",
    parentElement: parent ?? null,
    textContent: text,
    children: [],
    getAttribute: (name) => attributes[name] ?? null,
    getBoundingClientRect: () => ({ x: 0, y: 0, width: 0, height: 0 }),
  };
  parent?.children.push(node);
  return node;
}
