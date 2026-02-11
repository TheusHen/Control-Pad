#include "control_pad/debounce.hpp"

namespace control_pad {

bool updateDebounce(DebouncedInput &state, bool sample_pressed) {
  if (sample_pressed) {
    if (state.integrator < kDebounceCounts) {
      state.integrator++;
    }
  } else if (state.integrator > 0) {
    state.integrator--;
  }

  bool stable = state.stable_pressed;
  if (state.integrator == kDebounceCounts) {
    stable = true;
  } else if (state.integrator == 0) {
    stable = false;
  }

  if (stable == state.stable_pressed) {
    return false;
  }

  state.stable_pressed = stable;
  return true;
}

} // namespace control_pad
