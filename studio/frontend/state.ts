import { INPUT_LABELS } from "./constants";
import type { ActionConfig, HidDeviceEntry, Profile, StudioConfig } from "./types";

export interface RuntimeState {
  allowClose: boolean;
  listenerRunning: boolean;
  latestPressedInputs: number[];
  statusMessage: string;
  config: StudioConfig;
  devices: HidDeviceEntry[];
}

export function createDefaultAction(): ActionConfig {
  return {
    kind: "none",
    keyCombo: "",
    command: "",
    args: [],
    workingDir: "",
  };
}

export function createDefaultConfig(): StudioConfig {
  const profile = {
    id: makeProfileId(),
    name: "Default",
    mappings: Array.from({ length: INPUT_LABELS.length }, () => createDefaultAction()),
  };

  return {
    selectedDevicePath: "",
    reportOffset: 0,
    autoDetectReportOffset: true,
    autostartEnabled: false,
    profiles: [profile],
    activeProfileId: profile.id,
  };
}

export function createInitialRuntimeState(): RuntimeState {
  return {
    allowClose: false,
    listenerRunning: false,
    latestPressedInputs: [],
    statusMessage: "Idle",
    config: createDefaultConfig(),
    devices: [],
  };
}

export function makeProfileId(): string {
  return `profile-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export function sanitizeConfig(raw: StudioConfig): StudioConfig {
  const next: StudioConfig = { ...raw };

  if (!Array.isArray(next.profiles) || next.profiles.length === 0) {
    return createDefaultConfig();
  }

  next.profiles = next.profiles.map((profile, index) => {
    const mappings = Array.isArray(profile.mappings) ? [...profile.mappings] : [];
    while (mappings.length < INPUT_LABELS.length) {
      mappings.push(createDefaultAction());
    }
    if (mappings.length > INPUT_LABELS.length) {
      mappings.length = INPUT_LABELS.length;
    }

    return {
      ...profile,
      id: profile.id?.trim() ? profile.id : `${makeProfileId()}-${index}`,
      name: profile.name?.trim() ? profile.name : `Profile ${index + 1}`,
      mappings: mappings.map((mapping) => ({
        kind: mapping?.kind ?? "none",
        keyCombo: mapping?.keyCombo ?? "",
        command: mapping?.command ?? "",
        args: Array.isArray(mapping?.args) ? mapping.args : [],
        workingDir: mapping?.workingDir ?? "",
      })),
    };
  });

  if (!next.profiles.some((profile) => profile.id === next.activeProfileId)) {
    next.activeProfileId = next.profiles[0].id;
  }

  return next;
}

export function getActiveProfile(config: StudioConfig): Profile {
  return config.profiles.find((profile) => profile.id === config.activeProfileId) ?? config.profiles[0];
}

export function profileById(config: StudioConfig, profileId: string): Profile | undefined {
  return config.profiles.find((profile) => profile.id === profileId);
}

export function parseArgs(raw: string): string[] {
  const args: string[] = [];
  const regex = /"([^"]*)"|[^\s]+/g;
  for (const match of raw.matchAll(regex)) {
    const value = match[1] ?? match[0];
    if (value.trim()) {
      args.push(value.trim());
    }
  }
  return args;
}

export function hex(value: number, size = 4): string {
  return `0x${value.toString(16).toUpperCase().padStart(size, "0")}`;
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
