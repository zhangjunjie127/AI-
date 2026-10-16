import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import {
  assertPlayableSandboxDocument,
  installPlayableSandboxCsp,
  PLAYABLE_IFRAME_SANDBOX,
  PLAYABLE_SANDBOX_CSP,
} from "../src/shared/playable-sandbox.js";
import {
  isPlayableFrameMessage,
  isPlayableHostMessage,
} from "../src/shared/playable-player-protocol.js";

describe("Playable sandbox", () => {
  it("keeps renderer and published sandbox documents on the Runtime CSP", async () => {
    for (const file of [
      "playable-sandbox.html",
      "player/playable-sandbox.html",
    ]) {
      const html = await readFile(file, "utf8");
      expect(html).toContain(`content="${PLAYABLE_SANDBOX_CSP}"`);
      expect(html).toContain('data-playable-sandbox-csp="true"');
      expect(html).toContain('src="./assets/playable-sandbox.js"');
      expect(html).toContain("vite-ignore");
      expect(html).not.toContain('type="module"');
    }
  });

  it("requires a dedicated opaque-origin iframe document", () => {
    const iframeDocument = {
      defaultView: {
        origin: "null",
        top: {},
      },
    } as unknown as Document;
    const topLevelDocument = {
      defaultView: undefined as unknown as Window,
    } as Document;
    const sameOriginFrame = {
      defaultView: {
        origin: "https://example.test",
        top: {},
      },
    } as unknown as Document;

    expect(() => assertPlayableSandboxDocument(iframeDocument)).not.toThrow();
    expect(() => assertPlayableSandboxDocument(topLevelDocument)).toThrow(
      'sandbox="allow-scripts"',
    );
    expect(() => assertPlayableSandboxDocument(sameOriginFrame)).toThrow(
      'sandbox="allow-scripts"',
    );
  });

  it("installs the required CSP before authored surfaces load", () => {
    let installed: FakeMeta | undefined;
    let contentAtInsertion: string | undefined;
    const document = {
      head: {
        querySelector() {
          return installed;
        },
        prepend(meta: FakeMeta) {
          contentAtInsertion = meta.content;
          installed = meta;
        },
      },
      createElement() {
        return { content: "", dataset: {}, httpEquiv: "" } satisfies FakeMeta;
      },
    } as unknown as Document;

    installPlayableSandboxCsp(document);
    const first = installed;
    installPlayableSandboxCsp(document);

    expect(installed).toBe(first);
    expect(contentAtInsertion).toBe(PLAYABLE_SANDBOX_CSP);
    expect(installed).toEqual({
      content: PLAYABLE_SANDBOX_CSP,
      dataset: { playableSandboxCsp: "true" },
      httpEquiv: "Content-Security-Policy",
    });
    expect(PLAYABLE_IFRAME_SANDBOX).toBe("allow-scripts");
  });

  it("rejects a sandbox document whose installed Runtime policy was changed", () => {
    const installed = {
      content: "default-src *",
      dataset: { playableSandboxCsp: "true" },
      httpEquiv: "Content-Security-Policy",
    };
    const document = {
      head: {
        querySelector() {
          return installed;
        },
      },
    } as unknown as Document;

    expect(() => installPlayableSandboxCsp(document)).toThrow(
      "Playable sandbox CSP does not match the Runtime policy.",
    );
  });

  it("keeps diagnostics distinct from fatal Player errors", () => {
    expect(
      isPlayableFrameMessage({
        kind: "putenggame:playable:diagnostic",
        instanceId: "instance",
        error: "Cleanup failed",
      }),
    ).toBe(true);
    expect(
      isPlayableFrameMessage({
        kind: "putenggame:playable:diagnostic",
        instanceId: "instance",
        error: 42,
      }),
    ).toBe(false);
  });

  it("accepts moves for a button label without changing the move protocol shape", () => {
    const message = {
      kind: "putenggame:playable:moved",
      instanceId: "instance",
      move: {
        pick: {
          nodeId: "choice",
          source: "nodes/choice/index.html:2:1",
          cssPath: "main > button",
          tag: "button",
          buttonAssetId: "button-background",
          text: "Continue",
          box: { x: 0, y: 0, width: 100, height: 40 },
        },
        part: "button-label",
        translate: { x: 4, y: -2 },
        inPlace: true,
      },
    };

    expect(isPlayableFrameMessage(message)).toBe(true);
    expect(
      isPlayableFrameMessage({
        ...message,
        move: { ...message.move, part: "button-image" },
      }),
    ).toBe(false);
  });

  it("validates in-place appearance timing commands", () => {
    const message = {
      kind: "putenggame:playable:appearance-timing",
      instanceId: "instance",
      command: {
        sequence: 1,
        updates: [
          {
            pick: {
              nodeId: "choice",
              source: "nodes/choice/index.html:2:1",
              cssPath: "main > button",
              tag: "button",
            },
            delaySeconds: 80,
            endSeconds: 120,
          },
        ],
      },
    };

    expect(isPlayableHostMessage(message)).toBe(true);
    expect(
      isPlayableHostMessage({
        ...message,
        command: {
          ...message.command,
          updates: [{ ...message.command.updates[0], delaySeconds: -1 }],
        },
      }),
    ).toBe(false);
    expect(
      isPlayableHostMessage({
        ...message,
        command: {
          ...message.command,
          updates: [{ ...message.command.updates[0], endSeconds: 80 }],
        },
      }),
    ).toBe(false);
  });

  it("validates background-video loop commands", () => {
    expect(
      isPlayableHostMessage({
        kind: "putenggame:playable:media-command",
        instanceId: "instance",
        command: { command: "backdrop-loop", loop: true },
      }),
    ).toBe(true);
    expect(
      isPlayableHostMessage({
        kind: "putenggame:playable:media-command",
        instanceId: "instance",
        command: { command: "backdrop-loop", loop: "true" },
      }),
    ).toBe(false);
  });
});

interface FakeMeta {
  content: string;
  dataset: Record<string, string>;
  httpEquiv: string;
}
