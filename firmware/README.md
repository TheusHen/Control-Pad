# Control Pad Firmware (ATmega32U4, C++)

This firmware sends all 15 physical controls as **Gamepad HID buttons**.

## Input IDs

- `0` = `EMERGENCY`
- `1..4` = `RB1..RB4`
- `5..14` = `TOGGLE1..TOGGLE10`

## Stack

- Framework: Arduino (C++)
- Target: ATmega32U4 (`leonardo` profile in PlatformIO)
- HID: `MHeironimus/Joystick` (Gamepad type)

## Build / Flash

```powershell
cd firmware
pio run
pio run -t upload
```

## Tests

```powershell
cd firmware
pio test -e native
```

## Notes

- Debounce is implemented in firmware with integrator logic (`12` scan counts at `1 ms` scan by default).
- Inputs use `INPUT_PULLUP` and are treated as **active-low**.
- Pin mapping is centralized in `src/pins.cpp` (`kInputPins`) for quick adjustment to PCB routing.
- Code is split by responsibility:
  - `include/control_pad/config.hpp`
  - `include/control_pad/pins.hpp`
  - `include/control_pad/debounce.hpp`
  - `src/app.cpp`
  - `src/pins.cpp`
  - `src/debounce.cpp`
