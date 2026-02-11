# Control Pad Studio

Windows-focused desktop app built with Tauri + TypeScript.

## Features

- Direct HID capture from the Control Pad device
- Per-input action mapping:
  - `none`
  - `key_combo` (ex.: `Ctrl+Alt+1`)
  - `command` (program + args)
- Multiple profiles
- Active profile switching with global hotkeys:
  - `Ctrl + Alt + Shift + 1..9`
- Tray icon behavior and hide-to-tray on close
- Autostart support
- Config persistence on PC (`%APPDATA%\ControlPadStudio\studio-config.json`)

## Development

```powershell
cd studio
npm install
npm test
npm run build
```

For full Tauri desktop run, Rust toolchain is required.

## Notes

- This app is currently targeted to Windows usage.
- HID listener runs in backend (Rust) and keeps working while window is hidden.

## Project Structure

- `frontend/`
  - `main.ts` (entry)
  - `controller.ts` (app orchestration and handlers)
  - `ui.ts` (render and DOM helpers)
  - `state.ts` (runtime state + config helpers)
  - `types.ts`, `constants.ts`
- `src-tauri/src/`
  - `lib.rs` (Tauri bootstrap)
  - `commands.rs` (Tauri commands)
  - `hid_listener.rs` (HID capture loop)
  - `actions.rs` (action execution)
  - `config_store.rs` (config persistence)
  - `models.rs`, `state.rs`
