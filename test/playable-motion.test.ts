// @vitest-environment happy-dom
import { expect, it, vi } from "vitest";
import {
  insertPlayableButtonPreset,
  insertPlayableMotion,
  insertPlayableMediaElement,
  mountPlayableMotionElement,
  playableContinueWithoutInput,
  playableButtonAssetScales,
  playableElementRuntimeScale,
  playableElementTransformScale,
  setPlayableElementAttributes,
  setPlayableContinueWithoutInput,
  updatePlayableButtonLabelScale,
} from "../src/shared/playable-motion.js";

it("updates only attributes on the source element and preserves its other markup", () => {
  const source =
    '<main>\n  <button data-signal="continue" style="color: red">Next</button>\n</main>';
  const updated = setPlayableElementAttributes(
    source,
    { line: 2, column: 3 },
    "button",
    {
      "data-putenggame-motion": "progress-ring",
      "data-putenggame-motion-signal": 'success "now"',
    },
  );

  expect(updated).toContain(
    '<button data-signal="continue" style="color: red" data-putenggame-motion="progress-ring" data-putenggame-motion-signal="success &quot;now&quot;">',
  );
  expect(
    setPlayableElementAttributes(source, { line: 2, column: 3 }, "div", {
      "data-putenggame-motion": "countdown",
    }),
  ).toBeUndefined();
});

it("keeps the existing button signal handler when an interactive motion is attached", () => {
  const button = document.createElement("button");
  button.setAttribute("data-signal", "success");
  button.setAttribute("data-putenggame-motion", "countdown");
  button.setAttribute("data-putenggame-motion-mode", "interactive");
  button.setAttribute("data-putenggame-motion-duration", "5");
  button.setAttribute("data-putenggame-motion-signal", "success");
  const root = document.createElement("div").attachShadow({ mode: "open" });
  root.append(button);
  const existingClick = vi.fn();
  button.addEventListener("click", existingClick);
  const emit = vi.fn(async () => {});
  const cleanup = mountPlayableMotionElement(button, {
    root,
    assets: { url: () => "" },
    state: {} as never,
    session: {} as never,
    story: {} as never,
    lifecycle: { signal: new AbortController().signal },
    navigation: {
      emit,
      fail: emit,
      back: async () => {},
      connected: () => true,
    },
  });

  button.dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true }),
  );

  expect(existingClick).toHaveBeenCalledOnce();
  expect(emit).not.toHaveBeenCalled();
  cleanup();
});

it("scales the replacement image and button hit area together without cropping", () => {
  const button = document.createElement("button");
  button.textContent = "Continue";
  button.style.width = "180px";
  button.style.height = "48px";
  button.style.backgroundImage = 'url("original.png")';
  button.style.position = "absolute";
  button.style.isolation = "auto";
  button.setAttribute("data-putenggame-button-asset", "replacement");
  button.setAttribute("data-putenggame-button-asset-scale-x", "150");
  button.setAttribute("data-putenggame-button-asset-scale-y", "80");
  button.setAttribute("data-putenggame-button-label-translate", "4cqw -2cqh");

  const cleanup = mountPlayableMotionElement(button, {
    root: document.createElement("div").attachShadow({ mode: "open" }),
    assets: { url: (id: string) => `/assets/${id}.png` },
    state: {} as never,
    session: {} as never,
    story: {} as never,
    lifecycle: { signal: new AbortController().signal },
    navigation: {
      emit: async () => {},
      fail: async () => {},
      back: async () => {},
      connected: () => true,
    },
  });

  const image = button.querySelector<HTMLImageElement>(
    "[data-putenggame-button-asset-image] img",
  )!;
  expect(image.src).toContain("/assets/replacement.png");
  expect(image.style.objectFit).toBe("contain");
  expect(image.style.transform).toBe("");
  expect(button.style.scale).toBe("1.5 0.8");
  expect(button.style.backgroundImage).toBe("none");
  expect(button.style.isolation).toBe("isolate");
  expect(button.style.width).toBe("180px");
  expect(button.style.height).toBe("48px");
  const label = button.querySelector<HTMLElement>(
    "[data-putenggame-button-label]",
  )!;
  expect(label.textContent).toBe("Continue");
  expect(label.style.scale).toBe(`${100 / 150} ${100 / 80}`);
  expect(label.style.translate).toBe("4cqw -2cqh");
  button.setAttribute("data-putenggame-button-asset-scale-x", "200");
  button.style.scale = "2 0.8";
  updatePlayableButtonLabelScale(button);
  expect(label.style.scale).toBe(`${100 / 200} ${100 / 80}`);
  expect(button.style.scale).toBe("2 0.8");
  const click = vi.fn();
  button.addEventListener("click", click);
  label.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  expect(click).toHaveBeenCalledOnce();

  cleanup();
  expect(
    button.querySelector("[data-putenggame-button-asset-image]"),
  ).toBeNull();
  expect(button.querySelector("[data-putenggame-button-label]")).toBeNull();
  expect(button.textContent).toBe("Continue");
  expect(button.style.backgroundImage).toContain("original.png");
  expect(button.style.isolation).toBe("auto");
  expect(button.style.scale).toBe("");
  expect(button.style.position).toBe("absolute");
});

it("swaps the normal button image for the pressed image while held", () => {
  const button = document.createElement("button");
  button.textContent = "开始";
  button.style.transition = "transform 180ms ease";
  button.setAttribute("data-putenggame-button-asset", "normal");
  button.setAttribute("data-putenggame-button-pressed-asset", "pressed");
  const click = vi.fn();
  button.addEventListener("click", click);
  const cleanup = mountPlayableMotionElement(button, {
    root: document.createElement("div").attachShadow({ mode: "open" }),
    assets: { url: (id: string) => `/assets/${id}.png` },
    state: {} as never,
    session: {} as never,
    story: {} as never,
    lifecycle: { signal: new AbortController().signal },
    navigation: {
      emit: async () => {},
      fail: async () => {},
      back: async () => {},
      connected: () => true,
    },
  });

  const pressed = button.querySelector<HTMLElement>(
    "[data-putenggame-button-pressed-image]",
  )!;
  const normal = button.querySelector<HTMLElement>(
    "[data-putenggame-button-asset-image]",
  )!;
  expect(pressed.style.visibility).toBe("hidden");
  expect(normal.style.visibility).toBe("visible");
  expect(button.style.scale).toBe("1 1");
  button.dispatchEvent(
    new PointerEvent("pointerenter", {
      bubbles: true,
      pointerType: "mouse",
    }),
  );
  expect(pressed.style.visibility).toBe("visible");
  expect(normal.style.visibility).toBe("hidden");
  expect(button.style.scale).toBe("1 1");
  button.dispatchEvent(
    new PointerEvent("pointerleave", {
      bubbles: true,
      pointerType: "mouse",
    }),
  );
  expect(pressed.style.visibility).toBe("hidden");
  expect(normal.style.visibility).toBe("visible");
  button.dispatchEvent(
    new PointerEvent("pointerenter", {
      bubbles: true,
      pointerType: "mouse",
    }),
  );
  button.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  button.dispatchEvent(
    new PointerEvent("pointerleave", {
      bubbles: true,
      pointerType: "mouse",
    }),
  );
  expect(pressed.style.visibility).toBe("visible");
  expect(button.style.scale).toBe("1.08 1.08");
  window.dispatchEvent(new PointerEvent("pointerup"));
  expect(pressed.style.visibility).toBe("hidden");
  expect(normal.style.visibility).toBe("visible");
  expect(button.style.scale).toBe("1 1");
  expect(button.style.transition).toContain("transform 180ms ease");
  expect(button.style.transition).toContain("scale 120ms ease");
  button.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
  );
  expect(pressed.style.visibility).toBe("visible");
  expect(normal.style.visibility).toBe("hidden");
  expect(button.style.scale).toBe("1.08 1.08");
  button.dispatchEvent(
    new KeyboardEvent("keyup", { key: "Enter", bubbles: true }),
  );
  expect(pressed.style.visibility).toBe("hidden");
  expect(normal.style.visibility).toBe("visible");
  expect(button.style.scale).toBe("1 1");
  button.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  expect(pressed.style.visibility).toBe("visible");
  expect(normal.style.visibility).toBe("hidden");
  window.dispatchEvent(new PointerEvent("pointerup"));
  expect(pressed.style.visibility).toBe("hidden");
  expect(normal.style.visibility).toBe("visible");
  button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  expect(click).toHaveBeenCalledOnce();
  expect(button.textContent).toBe("开始");
  cleanup();
});

it("hides and restores the original background when only a pressed asset is set", () => {
  const button = document.createElement("button");
  button.style.backgroundImage = 'url("default.png")';
  button.setAttribute("data-putenggame-button-pressed-asset", "pressed");
  const cleanup = mountPlayableMotionElement(button, {
    root: document.createElement("div").attachShadow({ mode: "open" }),
    assets: { url: (id: string) => `/assets/${id}.png` },
    state: {} as never,
    session: {} as never,
    story: {} as never,
    lifecycle: { signal: new AbortController().signal },
    navigation: {
      emit: async () => {},
      fail: async () => {},
      back: async () => {},
      connected: () => true,
    },
  });

  button.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  expect(button.style.backgroundImage).toBe("none");
  window.dispatchEvent(new PointerEvent("pointerup"));
  expect(button.style.backgroundImage).toContain("default.png");
  cleanup();
});

it("saves button label movement on its own attribute, not on the button", () => {
  const source =
    '<main>\n  <button style="color: red">Continue</button>\n</main>';
  const updated = setPlayableElementAttributes(
    source,
    { line: 2, column: 3 },
    "button",
    { "data-putenggame-button-label-translate": "4cqw -2cqh" },
  );

  expect(updated).toContain(
    '<button style="color: red" data-putenggame-button-label-translate="4cqw -2cqh">',
  );
  expect(updated).not.toContain("translate:");
});

it("uses the previous single scale value for scenes without axis-specific scales", () => {
  const button = document.createElement("button");
  button.setAttribute("data-putenggame-button-asset-scale", "175");
  expect(playableButtonAssetScales(button)).toEqual({ x: 175, y: 175 });

  button.setAttribute("data-putenggame-button-asset-scale-x", "240");
  expect(playableButtonAssetScales(button)).toEqual({ x: 240, y: 175 });
});

it("composes button frame scaling with the background-asset scaling", () => {
  const button = document.createElement("button");
  button.style.scale = "1.5";
  button.setAttribute("data-putenggame-button-asset", "normal");
  button.setAttribute("data-putenggame-button-asset-scale-x", "150");
  button.setAttribute("data-putenggame-button-asset-scale-y", "80");
  expect(playableElementTransformScale(button, "2.25 1.2")).toBe(1.5);
  expect(playableElementRuntimeScale(button, 1.5)).toBe("2.25 1.2");

  const cleanup = mountPlayableMotionElement(button, {
    root: document.createElement("div").attachShadow({ mode: "open" }),
    assets: { url: (id: string) => `/assets/${id}.png` },
    state: {} as never,
    session: {} as never,
    story: {} as never,
    lifecycle: { signal: new AbortController().signal },
    navigation: {
      emit: async () => {},
      fail: async () => {},
      back: async () => {},
      connected: () => true,
    },
  });
  expect(button.style.scale).toBe("2.25 1.2");
  cleanup();
  expect(button.style.scale).toBe("1.5");
});

it("routes a completed hold to success and an untouched charge to timeout", () => {
  const callbacks: FrameRequestCallback[] = [];
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    callbacks.push(callback);
    return callbacks.length;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  const createContext = (emit: ReturnType<typeof vi.fn>) =>
    ({
      root: document.createElement("div").attachShadow({ mode: "open" }),
      assets: { url: () => "" },
      state: {} as never,
      session: {} as never,
      story: {} as never,
      lifecycle: { signal: new AbortController().signal },
      navigation: { emit, fail: emit, back: async () => {}, connected: () => true },
    }) as never;
  const success = vi.fn(async () => {});
  const held = document.createElement("button");
  held.setAttribute("data-putenggame-motion", "hold-charge");
  held.setAttribute("data-putenggame-motion-mode", "interactive");
  held.setAttribute("data-putenggame-motion-duration", "1");
  held.setAttribute("data-putenggame-motion-timeout-duration", "5");
  held.setAttribute("data-putenggame-motion-signal", "success");
  const heldCleanup = mountPlayableMotionElement(held, createContext(success));
  held.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  callbacks.pop()!(window.performance.now() + 1100);
  expect(success).toHaveBeenCalledWith("success");
  heldCleanup();

  const timeout = vi.fn(async () => {});
  const untouched = document.createElement("div");
  untouched.setAttribute("data-putenggame-motion", "hold-charge");
  untouched.setAttribute("data-putenggame-motion-mode", "interactive");
  untouched.setAttribute("data-putenggame-motion-duration", "1");
  untouched.setAttribute("data-putenggame-motion-timeout-duration", "3");
  untouched.setAttribute("data-putenggame-motion-timeout", "timeout");
  const timeoutCleanup = mountPlayableMotionElement(
    untouched,
    createContext(timeout),
  );
  callbacks.pop()!(window.performance.now() + 3000);
  expect(timeout).toHaveBeenCalledWith("timeout");
  timeoutCleanup();
  vi.restoreAllMocks();
});

it("reports interactive motion timeouts through the failure navigation path", () => {
  const callbacks: FrameRequestCallback[] = [];
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    callbacks.push(callback);
    return callbacks.length;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  const emit = vi.fn(async () => {});
  const fail = vi.fn(async () => {});
  const root = document.createElement("div").attachShadow({ mode: "open" });
  root.innerHTML =
    '<main data-putenggame-continue-without-input="true"></main>';
  const button = document.createElement("button");
  for (const [name, value] of Object.entries({
    "data-putenggame-motion": "countdown",
    "data-putenggame-motion-mode": "interactive",
    "data-putenggame-motion-duration": "1",
    "data-putenggame-motion-timeout": "fail",
  }))
    button.setAttribute(name, value);
  const cleanup = mountPlayableMotionElement(
    button,
    {
      root,
      assets: { url: () => "" },
      state: {} as never,
      session: {} as never,
      story: {} as never,
      lifecycle: { signal: new AbortController().signal },
      navigation: { emit, fail, back: async () => {}, connected: () => true },
    } as never,
  );

  callbacks.shift()!(window.performance.now() + 1100);
  expect(emit).not.toHaveBeenCalled();
  expect(fail).toHaveBeenCalledWith("fail");
  cleanup();
  vi.restoreAllMocks();
});

it("inserts an independent motion element with a stable source location", () => {
  const inserted = insertPlayableMotion(
    '<main class="stage">\n</main>',
    "nodes/start/index.html",
    {
      kind: "hold-charge",
      mode: "interactive",
      duration: 3,
      signal: "success",
      timeoutSignal: "timeout",
    },
    "putenggame-motion-test",
  );

  expect(inserted?.html).toContain(
    'data-putenggame-motion="hold-charge" data-putenggame-motion-mode="interactive"',
  );
  expect(inserted?.source).toBe("nodes/start/index.html:2:1");
});

it("stores the node no-input option on the scene root and preserves other markup", () => {
  const html = '<main class="stage"><button>Go</button></main>';
  const enabled = setPlayableContinueWithoutInput(html, true)!;
  expect(playableContinueWithoutInput(enabled)).toBe(true);
  expect(enabled).toContain('<main class="stage" data-putenggame-continue-without-input="true">');
  expect(setPlayableContinueWithoutInput(enabled, false)).toBe(html);
  expect(playableContinueWithoutInput(html)).toBe(false);
});

it("inserts source-backed image and video assets into the Scene markup", () => {
  const image = insertPlayableMediaElement(
    '<main class="stage">\n</main>',
    "nodes/start/index.html",
    "portrait",
    "image",
    "putenggame-media-image",
  );
  const video = insertPlayableMediaElement(
    "<main>\n</main>",
    "nodes/start/index.html",
    "clip",
    "video",
    "putenggame-media-video",
  );

  expect(image?.html).toContain(
    'id="putenggame-media-image" data-putenggame-asset="portrait"',
  );
  expect(image?.source).toBe("nodes/start/index.html:2:1");
  expect(video?.html).toContain(
    'data-putenggame-asset="clip" autoplay muted loop playsinline',
  );
  expect(video?.source).toBe("nodes/start/index.html:2:1");
});

it("inserts a source-backed button preset with an independently connectable signal", () => {
  const inserted = insertPlayableButtonPreset(
    '<main class="stage">\n</main>',
    "nodes/start/index.html",
    "putenggame-button-new",
    "button-1",
    "新按钮",
  );

  expect(inserted?.html).toContain(
    'id="putenggame-button-new" type="button" data-signal="button-1" data-putenggame-button-preset',
  );
  expect(inserted?.source).toBe("nodes/start/index.html:2:1");
  expect(
    insertPlayableButtonPreset(
      "<main></main>",
      "nodes/start/index.html",
      "putenggame-button-invalid",
      "not a signal",
      "Button",
    ),
  ).toBeUndefined();
});
