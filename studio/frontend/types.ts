export type ActionKind = "none" | "key_combo" | "command";

export interface ActionConfig {
  kind: ActionKind;
  keyCombo: string;
  command: string;
  args: string[];
  workingDir: string;
}

export interface Profile {
  id: string;
  name: string;
  mappings: ActionConfig[];
}

export interface StudioConfig {
  selectedDevicePath: string;
  reportOffset: number;
  autoDetectReportOffset: boolean;
  autostartEnabled: boolean;
  profiles: Profile[];
  activeProfileId: string;
}

export interface HidDeviceEntry {
  path: string;
  vendorId: number;
  productId: number;
  usagePage: number;
  usage: number;
  manufacturer: string;
  product: string;
  serialNumber: string;
}

export interface HidStateEvent {
  mask: number;
  pressedInputs: number[];
}

export interface ListenerStatus {
  running: boolean;
}
