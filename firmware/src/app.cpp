#include "control_pad/app.hpp"

#include <Joystick.h>

#include "control_pad/config.hpp"
#include "control_pad/debounce.hpp"
#include "control_pad/pins.hpp"

namespace control_pad {
namespace {

DebouncedInput g_inputs[kInputCount];

Joystick_ g_gamepad(
    JOYSTICK_DEFAULT_REPORT_ID,
    JOYSTICK_TYPE_GAMEPAD,
    kInputCount,
    0,     // hat switches
    false, // x axis
    false, // y axis
    false, // z axis
    false, // rx axis
    false, // ry axis
    false, // rz axis
    false, // rudder
    false, // throttle
    false, // accelerator
    false, // brake
    false  // steering
);

uint32_t g_next_scan_ms = 0;
uint32_t g_last_report_ms = 0;

void debugPrintChange(uint8_t input_id, bool pressed) {
  if (!kEnableSerialDebug) {
    return;
  }

  Serial.print(F("ID "));
  Serial.print(input_id);
  Serial.print(F(" -> "));
  Serial.println(pressed ? F("PRESSED") : F("RELEASED"));
}

void initializeInputs() {
  for (uint8_t i = 0; i < kInputCount; ++i) {
    configureInputPullup(kInputPins[i]);
  }
}

void initializeState() {
  for (uint8_t i = 0; i < kInputCount; ++i) {
    const bool pressed = readPressedActiveLow(kInputPins[i]);
    g_inputs[i].stable_pressed = pressed;
    g_inputs[i].integrator = pressed ? kDebounceCounts : 0;
    g_gamepad.setButton(i, pressed);
  }
  g_gamepad.sendState();
  g_last_report_ms = millis();
}

bool scanInputs() {
  bool changed = false;

  for (uint8_t i = 0; i < kInputCount; ++i) {
    const bool sample_pressed = readPressedActiveLow(kInputPins[i]);
    if (!updateDebounce(g_inputs[i], sample_pressed)) {
      continue;
    }

    g_gamepad.setButton(i, g_inputs[i].stable_pressed);
    debugPrintChange(i, g_inputs[i].stable_pressed);
    changed = true;
  }

  return changed;
}

void sendReportIfNeeded(bool changed, uint32_t now) {
  if (!changed) {
    return;
  }

  if (kMinReportIntervalMs == 0 || (now - g_last_report_ms) >= kMinReportIntervalMs) {
    g_gamepad.sendState();
    g_last_report_ms = now;
  }
}

} // namespace

void setup() {
  if (kEnableSerialDebug) {
    Serial.begin(kSerialBaud);
    delay(50);
    Serial.println(F("Control Pad firmware start"));
  }

  // Manual report mode. We call sendState() only when state changes.
  g_gamepad.begin(false);

  initializeInputs();
  initializeState();
  g_next_scan_ms = millis() + kScanIntervalMs;
}

void loop() {
  const uint32_t now = millis();
  if ((int32_t)(now - g_next_scan_ms) < 0) {
    return;
  }

  g_next_scan_ms += kScanIntervalMs;
  sendReportIfNeeded(scanInputs(), now);
}

} // namespace control_pad
