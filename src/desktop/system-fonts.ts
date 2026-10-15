import { execFile } from "node:child_process";

const POLL_MS = 30_000;
const WINDOWS_FONT_KEYS = [
  "HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts",
  "HKLM\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts",
];
const FALLBACK_FONTS = [
  "Arial",
  "Segoe UI",
  "Microsoft YaHei",
  "SimSun",
  "Georgia",
  "Times New Roman",
  "system-ui",
  "sans-serif",
];

/** Keeps the renderer's font picker synchronized with fonts installed on the host. */
export class SystemFontCatalog {
  #fonts = FALLBACK_FONTS;
  #timer?: NodeJS.Timeout;
  #refreshing?: Promise<string[]>;

  constructor(private readonly onChanged: (fonts: string[]) => void) {}

  start(): void {
    void this.refresh();
    this.#timer = setInterval(() => void this.refresh(), POLL_MS);
    this.#timer.unref();
  }

  stop(): void {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = undefined;
  }

  async list(): Promise<string[]> {
    return this.refresh();
  }

  async refresh(): Promise<string[]> {
    if (this.#refreshing) return this.#refreshing;
    this.#refreshing = scanSystemFonts()
      .then((fonts) => {
        if (sameFonts(this.#fonts, fonts)) return this.#fonts;
        this.#fonts = fonts;
        this.onChanged(fonts);
        return fonts;
      })
      .finally(() => {
        this.#refreshing = undefined;
      });
    return this.#refreshing;
  }
}

async function scanSystemFonts(): Promise<string[]> {
  const names = new Set<string>(FALLBACK_FONTS);
  if (process.platform === "win32") {
    for (const key of WINDOWS_FONT_KEYS) {
      for (const name of await registryFonts(key)) names.add(name);
    }
  } else {
    for (const name of await commandFonts("fc-list", [":", "family"]))
      names.add(name);
    if (process.platform === "darwin") {
      for (const name of await commandFonts("system_profiler", [
        "SPFontsDataType",
      ]))
        names.add(name);
    }
  }
  return [...names].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
}

function registryFonts(key: string): Promise<string[]> {
  return new Promise((resolve) => {
    execFile(
      "reg.exe",
      ["query", key],
      { windowsHide: true, encoding: "utf8" },
      (error, stdout) => {
        if (error) return resolve([]);
        const names = new Set<string>();
        for (const line of stdout.split(/\r?\n/)) {
          const match = /^\s{2,}(.+?)\s+REG_(?:SZ|EXPAND_SZ)\s+.+$/i.exec(line);
          if (!match) continue;
          for (const name of match[1]!
            .replace(/\s+\((?:TrueType|OpenType|Type ?1|Raster)\)$/i, "")
            .split(/\s*&\s*/)) {
            const clean = name.trim();
            if (clean) names.add(clean);
          }
        }
        resolve([...names]);
      },
    );
  });
}

function commandFonts(command: string, args: string[]): Promise<string[]> {
  return new Promise((resolve) => {
    execFile(command, args, { encoding: "utf8" }, (error, stdout) => {
      if (error) return resolve([]);
      const names = new Set<string>();
      for (const line of stdout.split(/\r?\n/)) {
        for (const value of line.split(",")) {
          const clean = value.trim();
          if (clean && !clean.includes(":")) names.add(clean);
        }
      }
      resolve([...names]);
    });
  });
}

function sameFonts(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    left.every((font, index) => font === right[index])
  );
}
