#pragma once

#include <stdint.h>

namespace control_pad {

constexpr uint8_t kInputCount = 15;

// Scan and debounce tuning.
constexpr uint16_t kScanIntervalMs = 1;
constexpr uint8_t kDebounceCounts = 12;
constexpr uint16_t kMinReportIntervalMs = 0;

// Optional serial logs.
constexpr bool kEnableSerialDebug = false;
constexpr uint32_t kSerialBaud = 115200;

// Logical IDs consumed by Studio.
enum InputId : uint8_t {
  EMERGENCY = 0,
  RB1 = 1,
  RB2 = 2,
  RB3 = 3,
  RB4 = 4,
  TOGGLE1 = 5,
  TOGGLE2 = 6,
  TOGGLE3 = 7,
  TOGGLE4 = 8,
  TOGGLE5 = 9,
  TOGGLE6 = 10,
  TOGGLE7 = 11,
  TOGGLE8 = 12,
  TOGGLE9 = 13,
  TOGGLE10 = 14
};

} // namespace control_pad
