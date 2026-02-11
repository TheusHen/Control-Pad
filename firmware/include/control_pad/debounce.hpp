#pragma once

#include <stdint.h>

#include "control_pad/config.hpp"

namespace control_pad {

struct DebouncedInput {
  uint8_t integrator = 0;
  bool stable_pressed = false;
};

bool updateDebounce(DebouncedInput &state, bool sample_pressed);

} // namespace control_pad
