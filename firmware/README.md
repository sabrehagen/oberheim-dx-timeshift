# DX TimeShift firmware (Arduino Nano)

This folder holds the program that runs on the Arduino Nano on the DX TimeShift board.
It makes the Oberheim DX snare play later by up to one beat, set with the SNARE DELAY pot.
The rules it follows are in `PROJECT_BRIEF.md` §3.5 (pins) and §3.6 (behaviour).

```
firmware/
  timeshift/
    timeshift.ino          the sketch: pins, interrupts, serial port
    timeshift_core.h       the logic: hit queue, tempo, pot, BYPASS/DELAY switching
    timeshift_config.h     ALL SETTINGS (pulse widths, queue size, default tempo, ...)
    build/arduino.avr.nano/
      timeshift.ino.hex    ready-made program file: flash this if you do not want to compile
  sim/
    test_timeshift.cpp     PC tests for timeshift_core.h (no Arduino needed)
    Makefile               "make test"
    TEST_RESULTS.md        the latest test output
```

## 1. What the firmware does

The DX's CPU starts a snare sound with three wires from chip U701:

* **FFA2** and **FFB2** set how loud it is (soft, medium or loud).
* **RST2** gives a short HIGH pulse (9 µs to 0.2 ms). The sound starts when RST2 falls.

The TimeShift board sits in U701's socket, between U701 and the snare circuit. A switch chip
(74HC157 "mux") decides who drives the snare circuit:

| Pot position | Mux (MUX_SEL, D9) | What happens |
|---|---|---|
| 0 % to 1 % | LOW = **BYPASS** | U701 drives the snare circuit directly. The DX is stock. The firmware only counts hits. |
| above 1 % | HIGH = **DELAY** | The Nano drives the snare circuit. Each hit is stored with its loudness and time, then played again later. |

A blank, crashed or missing Nano also gives BYPASS, because a 10 kΩ resistor pulls MUX_SEL LOW.
The 1 to 2 seconds the Nano spends starting up after power-on are covered the same way.

**How long is "later"?** The delay is measured in beats, not milliseconds. The firmware
measures the tempo from the DX CLOCK OUT signal (96 ticks per beat) and works out:

```
delay = pot position (0..1) x 1 beat
      = pot position x PPQN x (measured time between two clock ticks)
```

Examples: at 120 BPM one beat is 500 ms, so pot at 50 % gives 250 ms. At 90 BPM one beat is
667 ms, so pot at 50 % gives 333 ms.

Step by step:

1. **Capture (interrupt INT0, pin D2).** When RST2 rises, the Nano reads FFA2/FFB2 and
   stores *loudness + time + tick count* in a 32-place queue. The chip stores the edge in
   hardware, so even a 9 µs pulse cannot be missed.
2. **Tempo (interrupt INT1, pin D3).** Every clock tick is counted. The time between ticks
   is averaged over the last 4 ticks.
3. **Replay (main loop).** The program checks the oldest stored hit over and over. When
   `time since the hit ≥ delay`, it copies the DX's own sequence: set FFA2/FFB2, wait 2 µs,
   RST2 HIGH for 20 µs, RST2 LOW. TP1 (D12) goes HIGH at the same moment as RST2.
   The delay is recalculated on every check with the *current* pot setting and the
   *current* tempo. Turning the pot or changing tempo while a hit is waiting therefore
   takes effect at once.
4. **Pot (A0).** The pot is read 100 times per second and averaged over 16 readings.
   A small dead band ("hysteresis") stops electrical noise from moving the delay.
5. **Switching.** To go into DELAY, the Nano first copies the current U701 levels to its
   outputs and then raises MUX_SEL. Nothing changes on the snare lines at the moment of
   switching. To go back to BYPASS, it drops MUX_SEL. It never switches while RST2 is HIGH
   on either side.

**No clock?** If the DX clock has never been seen since power-up (for example you play the
pads with the sequencer stopped), the firmware assumes **120 BPM**. If the clock stops for
more than 2 s, it keeps using the **last measured tempo**.

**Things you may notice when playing:**

* Snares that were already waiting when you press STOP still play after the stop.
* When you turn the pot down quickly, waiting snares can come out a little early, because
  the delay gets shorter while they wait. When the pot reaches 0 (BYPASS), any snare still
  waiting is dropped. From then on the DX plays its own snares directly.
* At one beat of delay, a snare one beat after the previous one lands on top of the delayed
  copy, and the newer hit cuts the older one off. A stock DX does the same with two hits
  close together.

## 2. Install the tools

You need **one** of these.

### Option A: Arduino IDE (easiest)

1. Download Arduino IDE 2 from <https://www.arduino.cc/en/software> and install it.
2. Start it. Open **Tools → Board → Boards Manager**, search for **"Arduino AVR Boards"** and
   install it. It is often already installed.
3. Open `firmware/timeshift/timeshift.ino` with **File → Open**. The IDE shows three tabs:
   `timeshift.ino`, `timeshift_config.h` and `timeshift_core.h`.

### Option B: arduino-cli (command line)

```sh
curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | BINDIR=$HOME/.local/bin sh
arduino-cli core update-index
arduino-cli core install arduino:avr
```

Clone Nanos with a **CH340** USB chip need a driver on Windows and older macOS. Search for
"CH340 driver" from the chip maker WCH. Linux needs no driver.

## 3. Board settings

| Setting | Value |
|---|---|
| Board | **Arduino Nano** |
| Processor | **ATmega328P** (genuine Nano and most new clones) or **ATmega328P (Old Bootloader)** (many older or cheap clones) |
| Port | the new serial port that appears when you plug in the Nano (`COM3`, `/dev/ttyUSB0`, `/dev/cu.wchusbserial...`) |

**Old Bootloader:** if uploading stops with `avrdude: stk500_getsync(): not in sync` or
`programmer is not responding`, switch Processor to **"ATmega328P (Old Bootloader)"** and try
again. The program is identical for both. Only the upload speed is different (115200 baud for
the new bootloader, 57600 for the old one).

## 4. Flash (program) the Nano

> **Safety first.** The Nano's 5 V pin is connected to the DX's +5 V logic supply through the
> U701 plug. **Never plug the USB cable into the Nano while it sits in an installed TimeShift
> board and the DX is switched OFF.** The USB port would then try to power the whole DX logic
> board through the Nano. Do one of these instead:
> * **Best:** pull the Nano out of its sockets on the TimeShift board and flash it on the bench.
> * Or switch the DX **ON** first, then plug in USB (handy for watching the serial status).
>   Unplug USB before switching the DX off.

### With the Arduino IDE

1. Open `timeshift.ino` and set the board as in section 3.
2. Click **Upload** (the → arrow). Wait for "Done uploading".

### With arduino-cli (compile and upload)

```sh
arduino-cli compile --fqbn arduino:avr:nano:cpu=atmega328 firmware/timeshift
arduino-cli upload  --fqbn arduino:avr:nano:cpu=atmega328 -p /dev/ttyUSB0 firmware/timeshift
# Old bootloader: use  arduino:avr:nano:cpu=atmega328old  in both lines
```

### Flash the ready-made .hex (no compiling)

The compiled program is in `firmware/timeshift/build/arduino.avr.nano/timeshift.ino.hex`.

```sh
# with arduino-cli
arduino-cli upload --fqbn arduino:avr:nano:cpu=atmega328 -p /dev/ttyUSB0 \
    --input-dir firmware/timeshift/build/arduino.avr.nano firmware/timeshift

# or with avrdude directly (comes with the Arduino IDE)
avrdude -c arduino -p atmega328p -P /dev/ttyUSB0 -b 115200 \
    -U flash:w:firmware/timeshift/build/arduino.avr.nano/timeshift.ino.hex:i
# Old bootloader: -b 57600
```

Use `timeshift.ino.hex`. The `with_bootloader` files are only for programming a blank chip
with an ISP programmer.
The `.hex` matches the source files in this folder at the time of the build. If you change a
setting, compile again. The `.hex` will not change by itself.

## 5. PPQN jumpers (JP1)

JP1 is a 2×2 pin header with two shunt positions. The silkscreen reads
**"open=96, 1-2=48, 3-4=24"**. (Do not confuse it with J1 = DX PLUG and J2 = POT connector.)
The firmware reads JP1 **once at power-up**. After moving the shunt, switch the DX off and on
again.

| JP1 shunt | Nano pin pulled to GND | PPQN | Status shows | Use when |
|---|---|---|---|---|
| none (open) | none | **96** | `ppqn=96 (JP1 open)` | plain DX (always 96), or any DX with edit parameter 03 = 96 **(default)** |
| on 1-2 | D10 | 48 | `ppqn=48 (JP1 1-2)` | DXa / Stretch / MIDI-retrofit DX with parameter 03 = 48 |
| on 3-4 | D11 | 24 | `ppqn=24 (JP1 3-4)` | DXa / Stretch / MIDI-retrofit DX with parameter 03 = 24, or slaved to MIDI clock |
| on 1-2 **and** 3-4 | D10 and D11 | 96 | `ppqn=96 (JP1 BOTH-invalid)` | not valid. The firmware uses 96 and prints a WARNING at start-up |

## 6. Lights and test point

| What | Where | Meaning |
|---|---|---|
| LED steady ON | Nano "L" LED (D13) | BYPASS mode (pot at zero). Also lit from power-up until the first pot reading. |
| LED off, short 30 ms flash per snare | D13 | DELAY mode. Each flash is one captured snare hit. |
| LED never lights at all | D13 | see Troubleshooting |
| TP1 (TP_REPLAY, D12) | test point | goes HIGH for about 20 µs each time the Nano plays a delayed snare. Put a scope on TP1 and TP2 (RST2 from U701): the time between the TP2 pulse and the TP1 pulse is the delay. |

## 7. The serial status line

1. Connect USB (read the safety box in section 4 first).
2. Arduino IDE: **Tools → Serial Monitor**, set **115200 baud**.
   arduino-cli: `arduino-cli monitor -p /dev/ttyUSB0 -c baudrate=115200`.
3. A start-up banner appears, then **one line per second**:

```
mode=DELAY pot=50.0% delay=250.2ms ppqn=96 (JP1 open) bpm=120.0 clock=RUN queue=1 hits=12 replayed=11 dropped=0
```

| Field | Meaning |
|---|---|
| `mode` | `BYPASS` = stock DX, the Nano is only watching. `DELAY` = the Nano plays the snare. |
| `pot` | Pot position after smoothing, 0.0 % to 100.0 %. 1 % or less means BYPASS. |
| `delay` | The delay in use right now, in milliseconds (0.0 in BYPASS). It changes with the pot and the tempo. |
| `ppqn` | Clock ticks per beat, from jumper JP1, followed by the shunt position the firmware read: `(JP1 open)`, `(JP1 1-2)` or `(JP1 3-4)`. |
| `bpm` | Tempo the firmware has measured from the DX clock. It should match the DX display to within about 0.5 BPM. |
| `clock` | `NONE` = no clock tick since power-up (120 BPM assumed). `RUN` = ticks are arriving. `STOP` = no tick for more than 2 s (last tempo kept). |
| `queue` | Snare hits waiting to be played (0 to 32). |
| `hits` | Snare hits seen from U701 since power-up. This counts in BYPASS too. |
| `replayed` | Delayed snares the Nano has played since power-up. |
| `dropped` | Hits thrown away: the queue was full, or a hit waited more than 4 s. This should stay at 0. |

The serial port never makes a snare late. The firmware builds the text only when no snare is
due within 5 ms. It sends the text a few characters at a time, only as fast as the port can take
them.

### What the serial line shows when everything works

DX switched on, pot at zero, sequencer stopped:

```
DX TimeShift rev A - snare delay - Oberheim DX board 1721A (U701)
PPQN jumper JP1 open -> 96 PPQN   (open=96, 1-2=48, 3-4=24)
mode=BYPASS pot=0.0% delay=0.0ms ppqn=96 (JP1 open) bpm=120.0 clock=NONE queue=0 hits=0 replayed=0 dropped=0
```

Press START on a pattern at 120 BPM with a snare on beats 2 and 4. `clock` changes to `RUN`
and `hits` counts up (still BYPASS, so `replayed` stays 0):

```
mode=BYPASS pot=0.0% delay=0.0ms ppqn=96 (JP1 open) bpm=120.0 clock=RUN queue=0 hits=4 replayed=0 dropped=0
```

Turn the SNARE DELAY pot to the middle. The LED goes out and flashes on every snare. The snare
now sounds half a beat late:

```
mode=DELAY pot=50.0% delay=250.2ms ppqn=96 (JP1 open) bpm=120.0 clock=RUN queue=1 hits=9 replayed=8 dropped=0
mode=DELAY pot=50.0% delay=250.2ms ppqn=96 (JP1 open) bpm=120.0 clock=RUN queue=0 hits=11 replayed=11 dropped=0
```

Signs of a healthy board: `bpm` matches the DX display, `replayed` follows `hits` (at most
`queue` behind), and `dropped` stays 0. A pot at exactly half turn shows 50.0 % and about
250 ms because 512 of 1023 is 50.05 %.

## 8. Changing settings

All settings are in **`firmware/timeshift/timeshift_config.h`** (a tab in the Arduino IDE).
Each one has a comment that explains it. Change the number, save, and upload again. The PC tests
use the same file. After a change, run `make test` in `firmware/sim` if you can.

| Setting | Default | What it does |
|---|---|---|
| `LEVEL_SETUP_US` | 2 | µs between setting FFA2/FFB2 and raising RST2 |
| `RST2_PULSE_US` | 20 | µs the replayed RST2 stays HIGH (keep it between 10 and 200) |
| `HIT_QUEUE_DEPTH` | 32 | how many hits can wait at once (power of two) |
| `MAX_HIT_AGE_US` | 4 000 000 | hits older than this (4 s) are dropped |
| `MAX_DELAY_BEATS` | 1.0 | delay at full pot, in beats (0.5 = finer control over half a beat) |
| `BYPASS_BELOW_PERCENT` | 1 | pot at or below this % = BYPASS |
| `POT_READ_INTERVAL_US` | 10 000 | pot read every 10 ms (100 Hz) |
| `POT_AVERAGE_SAMPLES` | 16 | pot readings averaged |
| `POT_HYSTERESIS_COUNTS` | 4 | dead band in ADC steps (0..1023). Raise it if `pot=` flickers. |
| `DEFAULT_BPM` | 120 | tempo assumed when no clock has ever been seen |
| `CLOCK_TIMEOUT_US` | 2 000 000 | no tick for this long = clock `STOP` |
| `MIN_TICK_PERIOD_US` | 1 000 | ticks closer than 1 ms are treated as noise |
| `TICK_AVERAGE_TICKS` | 4 | tick periods averaged for the tempo |
| `LED_FLASH_US` | 30 000 | LED flash length per hit in DELAY mode |
| `SERIAL_BAUD` | 115200 | serial monitor speed |
| `STATUS_INTERVAL_US` | 1 000 000 | status line every second |
| `STATUS_GUARD_US` | 5 000 | status text is not built when a replay is due within this time |

The pin numbers are at the top of `timeshift.ino`. They match the circuit board, so do not change
them unless the board changes.

## 9. PC tests (optional)

The logic in `timeshift_core.h` is tested on a PC against a simulated DX. The tests cover tempo,
tempo changes, overlapping hits, bypass, no clock, the micros() wrap-around every 71.6 minutes,
24/48/96 PPQN, glitch-free switching, hysteresis and more.

```sh
cd firmware/sim
make test        # needs g++ (C++17) and make
```

Latest result: **150 checks, 0 failures**. The full output is in `sim/TEST_RESULTS.md`.

## 10. Build size

`arduino-cli 1.5.1`, core `arduino:avr 1.8.8`, `--fqbn arduino:avr:nano:cpu=atmega328`, compiled
with `--warnings all`. There are no warnings in the TimeShift files.

```
Sketch uses 10426 bytes (33%) of program storage space. Maximum is 30720 bytes.
Global variables use 986 bytes (48%) of dynamic memory, leaving 1062 bytes for local variables. Maximum is 2048 bytes.
```

The firmware never uses `new`/`malloc`. All memory is fixed at compile time.

## 11. Troubleshooting

| Symptom | Likely cause | What to check |
|---|---|---|
| **No LED at all**, DX on | No 5 V on the board, or the Nano is not running | Check the 16-way plug: pin 1 marking, orientation in the U701 socket, and the ribbon mapping (continuity test, see the build guide). Measure 5 V between the Nano's 5V and GND pins. Check that the Nano is fully seated. Flash the firmware again. |
| LED steady ON, **snare never delayed**, `pot=0.0%` | The Nano does not see the pot | J2 (POT connector) wiring: pin 1 GND (CCW lug), pin 2 wiper, pin 3 +5 V (CW lug). Measure A0: it should go from 0 V to 5 V as you turn the pot. Check the 1 kΩ resistor. |
| `mode=DELAY` but the snare sounds **not delayed** | MUX_SEL does not reach the 74HC157 | Measure 74HC157 pin 1: it should be about 5 V in DELAY. Check D9, the 10 kΩ pull-down, and that U3 is fitted the right way round. |
| `mode=DELAY`, `hits=0` while the snare plays | RST2 from U701 does not reach D2 | Is the original U701 chip in socket U1 on the TimeShift board? Check U1 pin 15 → 1 kΩ → D2 (TP2). Is this a **DXa**? It uses U715, not U701, and this board does not fit it. |
| `hits` counts but the snare is **silent** in DELAY | Replayed trigger does not reach the DX | Scope TP1: pulses about 20 µs. Then TP3 (plug side pin 15): the same pulses? Check 74HC157 1B/1Y and the ribbon. |
| Snare plays **twice** (direct and delayed) | Something bypasses the mux | U701 pins 10/12/15 must NOT go straight through to the plug. Check for solder bridges and for a wrong ribbon or plug pin-out. |
| Delayed snare has the **wrong loudness** | FFA2/FFB2 swapped or missing | Check D4/D5 (inputs) and D7/D8 → 2B/3B (outputs). Play SOFT, MEDIUM and LOUD pads and compare with BYPASS. |
| `bpm` is **2× or 4×** the DX display, delay too **short** | JP1 is set to a **lower** PPQN than the DX actually sends | Example: shunt on JP1 3-4 (24 PPQN) but the DX sends 96 → `bpm` shows 4× (480 instead of 120) and the delay is ¼ of what it should be. With JP1 1-2 (48) and a 96 PPQN DX it is 2×. Fix: plain DX → remove the shunt (JP1 open = 96). DXa/Stretch/MIDI → set JP1 to match edit parameter 03, or set parameter 03 to 96. Power-cycle after moving the shunt. |
| `bpm` is **½ or ¼** of the display, delay too **long**, `dropped` may rise | JP1 is set to a **higher** PPQN than the DX actually sends | Example: JP1 open (96 PPQN) but a DXa/Stretch/MIDI DX sends 24 (parameter 03 = 24, or slaved to MIDI clock) → `bpm` shows ¼ (30 instead of 120) and the delay is 4× too long. With a 48 PPQN DX it is ½. Fix: put the shunt on JP1 3-4 for 24, or JP1 1-2 for 48, or set parameter 03 to 96. Power-cycle. |
| `clock=NONE` while the sequencer runs | No clock signal at D3 | J3 lead clipped to the R791 lead on the Q709 side? Check 74HC14 U4 and TP5 (should pulse every 5.2 ms at 120 BPM). |
| `bpm` jumps about | Noisy clock lead | Keep the J3 lead short and twisted with its ground wire. Check the 10 kΩ / 100 kΩ / 1 nF parts at the 74HC14 input. |
| `pot=` flickers between two values | Electrical noise on the pot lead | Check the 100 nF filter capacitor. Twist the three pot wires. Raise `POT_HYSTERESIS_COUNTS` to 6 to 8. |
| Upload fails: `stk500_getsync(): not in sync` | Clone Nano with the old bootloader, or a driver problem | Select **ATmega328P (Old Bootloader)**. Install the CH340 driver. Use a data USB cable (some cables only charge). |
| Bass drum glitches after fitting | Not a firmware problem: the U701 write strobe (GEN0*) is disturbed by the ribbon | See findings Q4: keep the ribbon ≤ 15 cm and scope U701 pin 9. |
| Serial monitor shows garbage | Wrong speed | Set 115200 baud. |

### Known limits (to check on the bench)

* **Long RST2 highs are replayed as normal hits.** The firmware captures the RST2 *rising*
  edge and always replays a fixed 20 µs pulse. It does not measure how long the DX kept RST2
  high. The stock firmware analysed so far holds RST2 high for 9 µs to 0.2 ms. If the bench
  check (findings Q2, logic analyser on U701 pin 15) ever shows the DX holding RST2 high for
  **more than about 1 ms** (for example to keep the snare silent), the TimeShift would turn
  that into an ordinary delayed snare hit. The fix would be a firmware change: time how long
  RST2_IN stays high, then either skip such events or replay them with the same high time.
  Report it if you see it.
* **Mode-switch race of a few µs.** When the pot crosses the 1 % point, the firmware checks
  that RST2 is low and then changes MUX_SEL. There are about 4 µs between the check and the
  switch (one `digitalRead` plus one `digitalWrite`). If the DX's own RST2 rises in exactly
  that window while switching **into** DELAY, the direct trigger can be cut short and the same
  hit is then also replayed after the delay. That gives one doubled snare at the moment you turn
  the pot up. It cannot happen while the pot is left alone.
