import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Menu } from "@tauri-apps/api/menu";
import { TrayIcon } from "@tauri-apps/api/tray";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { register, unregisterAll } from "@tauri-apps/plugin-global-shortcut";

import { INPUT_LABELS, MAX_HOTKEY_PROFILES } from "./constants";
import {
  createDefaultAction,
  createInitialRuntimeState,
  getActiveProfile,
  makeProfileId,
  parseArgs,
  profileById,
  sanitizeConfig,
  type RuntimeState,
} from "./state";
import type { ActionKind, HidDeviceEntry, HidStateEvent, ListenerStatus, StudioConfig } from "./types";
import { getInputIdFromDataset, renderApp, updateLiveState, updateStatus } from "./ui";

export class AppController {
  private readonly appWindow = getCurrentWindow();
  private trayIcon: TrayIcon | null = null;
  private readonly state: RuntimeState = createInitialRuntimeState();

  async bootstrap(): Promise<void> {
    await this.initWindowBehavior();
    await this.setupTray();
    await this.attachRuntimeListeners();
    await this.loadConfig();
    await this.refreshDevices();
    await this.refreshListenerStatus();
    await this.registerProfileHotkeys();

    this.render();
    this.attachDomListeners();

    if (this.state.config.selectedDevicePath && !this.state.listenerRunning) {
      await this.startListener();
    }
  }

  private render(): void {
    renderApp(this.state);
  }

  private setStatus(message: string): void {
    this.state.statusMessage = message;
    updateStatus(message);
  }

  private async loadConfig(): Promise<void> {
    try {
      this.state.config = sanitizeConfig(await invoke<StudioConfig>("get_config"));
    } catch (error) {
      this.setStatus(`Failed to load config: ${String(error)}`);
    }

    try {
      this.state.config.autostartEnabled = await isEnabled();
    } catch {
      this.state.config.autostartEnabled = false;
    }
  }

  private async refreshDevices(): Promise<void> {
    try {
      this.state.devices = await invoke<HidDeviceEntry[]>("list_hid_devices");
      this.setStatus(`Detected ${this.state.devices.length} HID device(s).`);
    } catch (error) {
      this.setStatus(`Failed to list HID devices: ${String(error)}`);
    }
  }

  private async refreshListenerStatus(): Promise<void> {
    try {
      const status = await invoke<ListenerStatus>("get_listener_status");
      this.state.listenerRunning = status.running;
    } catch {
      this.state.listenerRunning = false;
    }
  }

  private async saveConfig(): Promise<void> {
    this.state.config = sanitizeConfig(this.state.config);
    await invoke("save_config", { config: this.state.config });

    if (this.state.config.autostartEnabled) {
      await enable();
    } else {
      await disable();
    }

    await this.registerProfileHotkeys();
    this.setStatus("Configuration saved.");
  }

  private async registerProfileHotkeys(): Promise<void> {
    await unregisterAll();

    const slots = Math.min(this.state.config.profiles.length, MAX_HOTKEY_PROFILES);
    for (let index = 0; index < slots; index += 1) {
      const shortcut = `Ctrl+Alt+Shift+${index + 1}`;
      await register(shortcut, async (event) => {
        if (event.state !== "Pressed") {
          return;
        }
        await this.activateProfileByIndex(index);
      });
    }
  }

  private async activateProfileByIndex(index: number): Promise<void> {
    if (index < 0 || index >= this.state.config.profiles.length) {
      return;
    }
    const profile = this.state.config.profiles[index];
    this.state.config.activeProfileId = profile.id;
    await invoke("set_active_profile", { profileId: profile.id });
    this.render();
    this.setStatus(`Active profile switched to "${profile.name}" via hotkey.`);
  }

  private async startListener(): Promise<void> {
    try {
      await invoke("start_hid_listener");
      await this.refreshListenerStatus();
      this.render();
      this.setStatus("HID listener started.");
    } catch (error) {
      this.setStatus(`Failed to start listener: ${String(error)}`);
    }
  }

  private async stopListener(): Promise<void> {
    await invoke("stop_hid_listener");
    await this.refreshListenerStatus();
    this.render();
    this.setStatus("HID listener stopped.");
  }

  private async setupTray(): Promise<void> {
    if (this.trayIcon) {
      return;
    }

    const menu = await Menu.new({
      items: [
        {
          id: "open",
          text: "Open Studio",
          action: () => {
            void this.showMainWindow();
          },
        },
        {
          id: "quit",
          text: "Quit",
          action: () => {
            void this.quit();
          },
        },
      ],
    });

    this.trayIcon = await TrayIcon.new({
      id: "control-pad-studio-tray",
      menu,
      tooltip: "Control Pad Studio",
      showMenuOnLeftClick: false,
      action: (event) => {
        if (event.type === "Click" && event.button === "Left" && event.buttonState === "Up") {
          void this.toggleMainWindow();
        }
      },
    });
  }

  private async showMainWindow(): Promise<void> {
    await this.appWindow.show();
    await this.appWindow.setFocus();
  }

  private async toggleMainWindow(): Promise<void> {
    const visible = await this.appWindow.isVisible();
    if (visible) {
      await this.appWindow.hide();
    } else {
      await this.showMainWindow();
    }
  }

  private async initWindowBehavior(): Promise<void> {
    await this.appWindow.onCloseRequested(async (event) => {
      if (this.state.allowClose) {
        return;
      }
      event.preventDefault();
      await this.appWindow.hide();
      this.setStatus("Running in tray. Use tray icon to reopen.");
    });
  }

  private async quit(): Promise<void> {
    this.state.allowClose = true;
    await this.stopListener();
    await unregisterAll();
    await this.appWindow.close();
  }

  private async attachRuntimeListeners(): Promise<void> {
    await listen<HidStateEvent>("hid-state", (event) => {
      this.state.latestPressedInputs = event.payload.pressedInputs ?? [];
      updateLiveState(this.state.latestPressedInputs);
    });

    await listen<string>("hid-error", (event) => {
      this.setStatus(`HID error: ${event.payload}`);
    });
  }

  private attachDomListeners(): void {
    const app = document.querySelector<HTMLElement>("#app");
    if (!app) {
      return;
    }

    app.addEventListener("click", (event) => {
      void this.onClick(event);
    });
    app.addEventListener("change", (event) => {
      void this.onChange(event);
    });
    app.addEventListener("input", (event) => {
      this.onInput(event);
    });
  }

  private async onClick(event: MouseEvent): Promise<void> {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }

    if (target.id === "refresh-devices") {
      await this.refreshDevices();
      this.render();
      return;
    }

    if (target.id === "start-listener") {
      await this.startListener();
      return;
    }

    if (target.id === "stop-listener") {
      await this.stopListener();
      return;
    }

    if (target.id === "save-config") {
      try {
        await this.saveConfig();
      } catch (error) {
        this.setStatus(`Failed to save config: ${String(error)}`);
      }
      return;
    }

    if (target.id === "new-profile") {
      const name = window.prompt("New profile name:", `Profile ${this.state.config.profiles.length + 1}`);
      if (!name?.trim()) {
        return;
      }

      this.state.config.profiles.push({
        id: makeProfileId(),
        name: name.trim(),
        mappings: Array.from({ length: INPUT_LABELS.length }, () => createDefaultAction()),
      });
      this.state.config.activeProfileId =
        this.state.config.profiles[this.state.config.profiles.length - 1].id;
      await this.registerProfileHotkeys();
      this.render();
      return;
    }

    if (target.id === "rename-profile") {
      const active = getActiveProfile(this.state.config);
      const nextName = window.prompt("Rename profile:", active.name);
      if (!nextName?.trim()) {
        return;
      }

      active.name = nextName.trim();
      this.render();
      return;
    }

    if (target.id === "delete-profile") {
      if (this.state.config.profiles.length === 1) {
        this.setStatus("At least one profile is required.");
        return;
      }

      this.state.config.profiles = this.state.config.profiles.filter(
        (profile) => profile.id !== this.state.config.activeProfileId,
      );
      this.state.config.activeProfileId = this.state.config.profiles[0].id;
      await this.registerProfileHotkeys();
      this.render();
      return;
    }

    if (target.classList.contains("test-action")) {
      const inputId = getInputIdFromDataset(target);
      if (inputId === null) {
        return;
      }

      try {
        await invoke("trigger_input", { inputId });
        this.setStatus(`Triggered ${INPUT_LABELS[inputId]} test action.`);
      } catch (error) {
        this.setStatus(`Failed to trigger input: ${String(error)}`);
      }
    }
  }

  private async onChange(event: Event): Promise<void> {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }

    if (target.id === "device-select") {
      this.state.config.selectedDevicePath = (target as HTMLSelectElement).value;
      return;
    }

    if (target.id === "profile-select") {
      const profileId = (target as HTMLSelectElement).value;
      const profile = profileById(this.state.config, profileId);
      if (!profile) {
        return;
      }

      this.state.config.activeProfileId = profile.id;
      await invoke("set_active_profile", { profileId: profile.id });
      this.render();
      return;
    }

    if (target.id === "report-offset") {
      this.state.config.reportOffset = Math.max(0, Number((target as HTMLInputElement).value) || 0);
      return;
    }

    if (target.id === "auto-detect-offset") {
      this.state.config.autoDetectReportOffset = (target as HTMLInputElement).checked;
      return;
    }

    if (target.id === "autostart-enabled") {
      this.state.config.autostartEnabled = (target as HTMLInputElement).checked;
      return;
    }

    if (target.classList.contains("action-kind")) {
      const inputId = getInputIdFromDataset(target);
      if (inputId === null) {
        return;
      }

      const profile = getActiveProfile(this.state.config);
      profile.mappings[inputId].kind = (target as HTMLSelectElement).value as ActionKind;
      this.render();
    }
  }

  private onInput(event: Event): void {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }

    const inputId = getInputIdFromDataset(target);
    if (inputId === null) {
      return;
    }

    const profile = getActiveProfile(this.state.config);
    if (target.classList.contains("action-key")) {
      profile.mappings[inputId].keyCombo = (target as HTMLInputElement).value;
      return;
    }

    if (target.classList.contains("action-cmd")) {
      profile.mappings[inputId].command = (target as HTMLInputElement).value;
      return;
    }

    if (target.classList.contains("action-args")) {
      profile.mappings[inputId].args = parseArgs((target as HTMLInputElement).value);
    }
  }
}
