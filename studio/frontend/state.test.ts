import { describe, expect, it } from "vitest";

import {
  createDefaultConfig,
  escapeHtml,
  getActiveProfile,
  hex,
  profileById,
  parseArgs,
  sanitizeConfig,
} from "./state";

describe("state helpers", () => {
  it("sanitizeConfig normalizes missing mappings and active profile", () => {
    const raw = {
      selectedDevicePath: "",
      reportOffset: 0,
      autoDetectReportOffset: true,
      autostartEnabled: false,
      profiles: [
        {
          id: "",
          name: "",
          mappings: [{ kind: "none", keyCombo: "", command: "", args: [], workingDir: "" }],
        },
      ],
      activeProfileId: "does-not-exist",
    };

    const config = sanitizeConfig(raw as ReturnType<typeof createDefaultConfig>);
    expect(config.profiles.length).toBe(1);
    expect(config.profiles[0].id.length).toBeGreaterThan(0);
    expect(config.profiles[0].name).toBe("Profile 1");
    expect(config.profiles[0].mappings.length).toBe(15);
    expect(config.activeProfileId).toBe(config.profiles[0].id);
  });

  it("parseArgs keeps quoted blocks", () => {
    expect(parseArgs('a "two words" c')).toEqual(["a", "two words", "c"]);
    expect(parseArgs("")).toEqual([]);
  });

  it("escapeHtml escapes markup", () => {
    expect(escapeHtml('<tag attr="x">')).toBe("&lt;tag attr=&quot;x&quot;&gt;");
  });

  it("hex formats uppercase values", () => {
    expect(hex(26)).toBe("0x001A");
  });

  it("getActiveProfile returns selected profile when available", () => {
    const config = createDefaultConfig();
    const active = getActiveProfile(config);
    expect(active.id).toBe(config.activeProfileId);
    expect(profileById(config, active.id)?.id).toBe(active.id);
  });
});
