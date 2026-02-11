#include <unity.h>

#include "control_pad/debounce.hpp"

using namespace control_pad;

void test_debounce_transitions_to_pressed_after_threshold() {
  DebouncedInput input{};

  for (uint8_t i = 0; i < kDebounceCounts - 1; ++i) {
    bool changed = updateDebounce(input, true);
    TEST_ASSERT_FALSE(changed);
    TEST_ASSERT_FALSE(input.stable_pressed);
  }

  bool changed = updateDebounce(input, true);
  TEST_ASSERT_TRUE(changed);
  TEST_ASSERT_TRUE(input.stable_pressed);
}

void test_debounce_transitions_to_released_after_threshold() {
  DebouncedInput input{};
  input.stable_pressed = true;
  input.integrator = kDebounceCounts;

  for (uint8_t i = 0; i < kDebounceCounts - 1; ++i) {
    bool changed = updateDebounce(input, false);
    TEST_ASSERT_FALSE(changed);
    TEST_ASSERT_TRUE(input.stable_pressed);
  }

  bool changed = updateDebounce(input, false);
  TEST_ASSERT_TRUE(changed);
  TEST_ASSERT_FALSE(input.stable_pressed);
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_debounce_transitions_to_pressed_after_threshold);
  RUN_TEST(test_debounce_transitions_to_released_after_threshold);
  return UNITY_END();
}
