// @vitest-environment happy-dom
import { expect, it, vi } from "vitest";
import {
  insertPlayableMotion,
  mountPlayableMotionElement,
  setPlayableElementAttributes,
} from "../src/shared/playable-motion.js";

it("updates only attributes on the source element and preserves its other markup", () => {
  const source = '<main>\n  <button data-signal="continue" style="color: red">Next</button>\n</main>';
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
    setPlayableElementAttributes(
      source,
      { line: 2, column: 3 },
      "div",
      { "data-putenggame-motion": "countdown" },
    ),
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
      back: async () => {},
      connected: () => true,
    },
  });

  button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

  expect(existingClick).toHaveBeenCalledOnce();
  expect(emit).not.toHaveBeenCalled();
  cleanup();
});

it("scales only the replacement image while keeping the button hit area intact", () => {
  const button = document.createElement("button");
  button.style.width = "180px";
  button.style.height = "48px";
  button.style.backgroundImage = 'url("original.png")';
  button.style.position = "absolute";
  button.style.isolation = "auto";
  button.setAttribute("data-putenggame-button-asset", "replacement");
  button.setAttribute("data-putenggame-button-asset-scale", "150");

  const cleanup = mountPlayableMotionElement(button, {
    root: document.createElement("div").attachShadow({ mode: "open" }),
    assets: { url: (id: string) => `/assets/${id}.png` },
    state: {} as never,
    session: {} as never,
    story: {} as never,
    lifecycle: { signal: new AbortController().signal },
    navigation: {
      emit: async () => {},
      back: async () => {},
      connected: () => true,
    },
  });

  const image = button.querySelector<HTMLImageElement>(
    "[data-putenggame-button-asset-image] img",
  )!;
  expect(image.src).toContain("/assets/replacement.png");
  expect(image.style.objectFit).toBe("contain");
  expect(image.style.transform).toBe("scale(1.5)");
  expect(button.style.backgroundImage).toBe("none");
  expect(button.style.isolation).toBe("isolate");
  expect(button.style.width).toBe("180px");
  expect(button.style.height).toBe("48px");

  cleanup();
  expect(button.querySelector("[data-putenggame-button-asset-image]")).toBeNull();
  expect(button.style.backgroundImage).toContain("original.png");
  expect(button.style.isolation).toBe("auto");
  expect(button.style.position).toBe("absolute");
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
      navigation: { emit, back: async () => {}, connected: () => true },
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

it("inserts an independent motion element with a stable source location", () => {
  const inserted = insertPlayableMotion(
    "<main class=\"stage\">\n</main>",
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
