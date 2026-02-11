import { INPUT_LABELS } from "./constants";
import { escapeHtml, getActiveProfile, hex } from "./state";
import type { RuntimeState } from "./state";

export function renderApp(state: RuntimeState): void {
  const app = document.querySelector<HTMLElement>("#app");
  if (!app) {
    return;
  }

  const activeProfile = getActiveProfile(state.config);

  const deviceOptions = [
    `<option value="">Select HID device...</option>`,
    ...state.devices.map((device) => {
      const name = [device.manufacturer, device.product].filter(Boolean).join(" ").trim();
      const summary = name || "Unknown HID";
      const details = `${hex(device.vendorId)}:${hex(device.productId)} usage ${hex(
        device.usagePage,
      )}/${hex(device.usage)}`;
      const selected = device.path === state.config.selectedDevicePath ? "selected" : "";
      return `<option value="${escapeHtml(device.path)}" ${selected}>${escapeHtml(
        `${summary} - ${details}`,
      )}</option>`;
    }),
  ].join("");

  const profileOptions = state.config.profiles
    .map((profile, index) => {
      const selected = profile.id === state.config.activeProfileId ? "selected" : "";
      return `<option value="${escapeHtml(profile.id)}" ${selected}>${escapeHtml(
        `${index + 1}. ${profile.name}`,
      )}</option>`;
    })
    .join("");

  const mappingRows = activeProfile.mappings
    .map((mapping, inputId) => {
      const isKey = mapping.kind === "key_combo";
      const isCommand = mapping.kind === "command";
      const argsText = mapping.args.join(" ");
      return `
        <tr>
          <td>
            <div class="input-name">${INPUT_LABELS[inputId]}</div>
            <div class="input-id">ID ${inputId}</div>
          </td>
          <td>
            <select class="action-kind" data-input-id="${inputId}">
              <option value="none" ${mapping.kind === "none" ? "selected" : ""}>None</option>
              <option value="key_combo" ${isKey ? "selected" : ""}>Key Combo</option>
              <option value="command" ${isCommand ? "selected" : ""}>Command</option>
            </select>
          </td>
          <td>
            <input
              class="action-key"
              data-input-id="${inputId}"
              value="${escapeHtml(mapping.keyCombo)}"
              placeholder="Ctrl+Shift+1"
              ${isKey ? "" : "disabled"}
            />
          </td>
          <td>
            <input
              class="action-cmd"
              data-input-id="${inputId}"
              value="${escapeHtml(mapping.command)}"
              placeholder="C:\\Tools\\script.bat"
              ${isCommand ? "" : "disabled"}
            />
          </td>
          <td>
            <input
              class="action-args"
              data-input-id="${inputId}"
              value="${escapeHtml(argsText)}"
              placeholder="arg1 \"arg with spaces\""
              ${isCommand ? "" : "disabled"}
            />
          </td>
          <td>
            <button class="btn-secondary test-action" data-input-id="${inputId}">Test</button>
          </td>
        </tr>
      `;
    })
    .join("");

  app.innerHTML = `
    <main class="layout">
      <header class="hero">
        <div>
          <h1>Control Pad Studio</h1>
          <p>HID capture, profiles and automation mapped to your Control Pad firmware.</p>
        </div>
        <div class="status-box">
          <span class="status-pill ${state.listenerRunning ? "running" : "stopped"}">
            ${state.listenerRunning ? "Listener Running" : "Listener Stopped"}
          </span>
          <div id="status-message">${escapeHtml(state.statusMessage)}</div>
        </div>
      </header>

      <section class="card">
        <h2>HID Device</h2>
        <div class="row-grid">
          <label class="field grow">
            <span>Device</span>
            <select id="device-select">${deviceOptions}</select>
          </label>
          <button id="refresh-devices" class="btn-secondary">Refresh Devices</button>
          <button id="start-listener" class="btn-primary">Start Listener</button>
          <button id="stop-listener" class="btn-secondary">Stop Listener</button>
        </div>
        <div class="row-grid compact">
          <label class="field">
            <span>Report Offset</span>
            <input id="report-offset" type="number" min="0" max="8" value="${state.config.reportOffset}" />
          </label>
          <label class="field checkbox">
            <input id="auto-detect-offset" type="checkbox" ${state.config.autoDetectReportOffset ? "checked" : ""} />
            <span>Auto detect offset</span>
          </label>
          <label class="field checkbox">
            <input id="autostart-enabled" type="checkbox" ${state.config.autostartEnabled ? "checked" : ""} />
            <span>Autostart with Windows</span>
          </label>
        </div>
      </section>

      <section class="card">
        <h2>Profiles</h2>
        <div class="row-grid">
          <label class="field grow">
            <span>Active Profile</span>
            <select id="profile-select">${profileOptions}</select>
          </label>
          <button id="new-profile" class="btn-secondary">New Profile</button>
          <button id="rename-profile" class="btn-secondary">Rename Profile</button>
          <button id="delete-profile" class="btn-secondary">Delete Profile</button>
          <button id="save-config" class="btn-primary">Save Config</button>
        </div>
        <p class="hint">Switch profile hotkeys: Ctrl + Alt + Shift + Number (1-9).</p>
      </section>

      <section class="card">
        <h2>Input Mapping</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Input</th>
                <th>Action</th>
                <th>Key Combo</th>
                <th>Command</th>
                <th>Args</th>
                <th>Test</th>
              </tr>
            </thead>
            <tbody>${mappingRows}</tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <h2>Live Monitor</h2>
        <p id="live-state">No active inputs</p>
      </section>
    </main>
  `;

  updateLiveState(state.latestPressedInputs);
}

export function updateStatus(message: string): void {
  const node = document.querySelector<HTMLElement>("#status-message");
  if (node) {
    node.textContent = message;
  }
}

export function updateLiveState(pressedInputs: number[]): void {
  const node = document.querySelector<HTMLElement>("#live-state");
  if (!node) {
    return;
  }

  if (pressedInputs.length === 0) {
    node.textContent = "No active inputs";
    return;
  }

  const label = [...pressedInputs]
    .sort((a, b) => a - b)
    .map((inputId) => `${INPUT_LABELS[inputId]}(${inputId})`)
    .join(", ");
  node.textContent = label;
}

export function getInputIdFromDataset(target: EventTarget | null): number | null {
  const element = target as HTMLElement | null;
  if (!element) {
    return null;
  }
  const inputId = element.dataset.inputId;
  if (!inputId) {
    return null;
  }

  const parsed = Number(inputId);
  return Number.isNaN(parsed) ? null : parsed;
}
