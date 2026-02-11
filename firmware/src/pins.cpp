#include "control_pad/pins.hpp"

#include <avr/io.h>

#if !defined(__AVR_ATmega32U4__)
#warning "Control Pad pin map is designed for ATmega32U4."
#endif

namespace control_pad {

void configureInputPullup(const AvrPin &pin) {
  *pin.ddr &= ~pin.bit_mask;
  *pin.port |= pin.bit_mask;
}

bool readPressedActiveLow(const AvrPin &pin) { return ((*pin.pin) & pin.bit_mask) == 0; }

// Mapping from schematic:
// SW_S1..SW_S8  -> PD0..PD7
// SW_S9..SW_S12 -> PF4..PF7
// SW_S13..SW_S14 -> PC6..PC7
// SW_S15 -> PE2
const AvrPin kInputPins[kInputCount] = {
    {&PIND, &DDRD, &PORTD, _BV(0)}, // SW_S1  -> EMERGENCY
    {&PIND, &DDRD, &PORTD, _BV(1)}, // SW_S2  -> RB1
    {&PIND, &DDRD, &PORTD, _BV(2)}, // SW_S3  -> RB2
    {&PIND, &DDRD, &PORTD, _BV(3)}, // SW_S4  -> RB3
    {&PIND, &DDRD, &PORTD, _BV(4)}, // SW_S5  -> RB4
    {&PIND, &DDRD, &PORTD, _BV(5)}, // SW_S6  -> TOGGLE1
    {&PIND, &DDRD, &PORTD, _BV(6)}, // SW_S7  -> TOGGLE2
    {&PIND, &DDRD, &PORTD, _BV(7)}, // SW_S8  -> TOGGLE3
    {&PINF, &DDRF, &PORTF, _BV(4)}, // SW_S9  -> TOGGLE4
    {&PINF, &DDRF, &PORTF, _BV(5)}, // SW_S10 -> TOGGLE5
    {&PINF, &DDRF, &PORTF, _BV(6)}, // SW_S11 -> TOGGLE6
    {&PINF, &DDRF, &PORTF, _BV(7)}, // SW_S12 -> TOGGLE7
    {&PINC, &DDRC, &PORTC, _BV(6)}, // SW_S13 -> TOGGLE8
    {&PINC, &DDRC, &PORTC, _BV(7)}, // SW_S14 -> TOGGLE9
    {&PINE, &DDRE, &PORTE, _BV(2)}  // SW_S15 -> TOGGLE10 (HWB)
};

} // namespace control_pad
