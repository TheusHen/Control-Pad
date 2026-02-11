#pragma once

#include <stdint.h>

#include "control_pad/config.hpp"

namespace control_pad {

struct AvrPin {
  volatile uint8_t *pin;
  volatile uint8_t *ddr;
  volatile uint8_t *port;
  uint8_t bit_mask;
};

extern const AvrPin kInputPins[kInputCount];

void configureInputPullup(const AvrPin &pin);
bool readPressedActiveLow(const AvrPin &pin);

} // namespace control_pad
