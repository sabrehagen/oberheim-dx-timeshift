// ============================================================================
//  DX TimeShift rev A  —  SETTINGS FILE
// ============================================================================
//
//  Every number you might want to change lives in THIS file. In the Arduino
//  IDE it shows up as a tab called "timeshift_config.h" next to the main
//  sketch. The same file is used by the PC test program in firmware/sim/,
//  so the tests always check the exact numbers that go into the Nano.
//
//  After changing anything here:
//    1. (optional, needs a PC with g++)  cd firmware/sim && make test
//    2. Upload the sketch to the Nano again.
//
//  Units are in the name of each constant:  _US = microseconds (µs),
//  _MS = milliseconds, _BPM = beats per minute, _COUNTS = ADC steps (0..1023).
//  1 second = 1 000 ms = 1 000 000 µs.
// ============================================================================

#ifndef TIMESHIFT_CONFIG_H
#define TIMESHIFT_CONFIG_H

#include <stdint.h>

// ---------------------------------------------------------------------------
//  Replayed trigger pulse (what the TimeShift sends to the DX snare circuit)
// ---------------------------------------------------------------------------

// How long the level lines FFA2/FFB2 are set BEFORE the RST2 trigger line goes
// high. The DX's own CPU does this too ("write 1" happens before "write 2").
// The snare circuit needs at least ~1 µs. Brief §3.6: 2 µs.
static const uint16_t LEVEL_SETUP_US = 2;

// How long the replayed RST2 trigger stays HIGH. While RST2 is high the snare
// sample counter is held at the start; the sound starts when RST2 falls.
// The stock DX makes this 9 µs (firmware 1.5) to 200 µs (firmware 1.20).
// Brief §3.6: 20 µs. Keep it between 10 and 200.
static const uint16_t RST2_PULSE_US = 20;

// ---------------------------------------------------------------------------
//  Hit queue
// ---------------------------------------------------------------------------

// How many snare hits can wait in the queue at the same time. At a delay of
// one beat you would need 32 snare hits inside one beat to fill it, which a
// DX cannot even play. MUST be a power of two (8, 16, 32, 64). Each slot uses
// 9 bytes of the Nano's 2048 bytes of RAM.
static const uint8_t HIT_QUEUE_DEPTH = 32;

// A hit that has waited longer than this is thrown away instead of being
// played. It is a safety net: with correct settings no hit ever waits this
// long (one beat at the DX's slowest tempo of 25 BPM is 2.4 s). Brief: 4 s.
static const uint32_t MAX_HIT_AGE_US = 4000000UL;

// ---------------------------------------------------------------------------
//  Delay range (the panel pot)
// ---------------------------------------------------------------------------

// Delay with the pot turned fully clockwise, in beats (quarter notes).
// 1.0 = one beat, as the project brief requires. 0.5 would make the whole
// pot range cover half a beat (finer control).
static const float MAX_DELAY_BEATS = 1.0f;

// Pot positions at or below this percentage count as "zero": the board
// switches to BYPASS and the DX behaves exactly as stock. Brief: 1 %.
static const uint8_t BYPASS_BELOW_PERCENT = 1;

// How often the pot is read. 10 000 µs = 100 times per second (brief: ~100 Hz).
static const uint32_t POT_READ_INTERVAL_US = 10000UL;

// How many pot readings are averaged. More = smoother but slower to follow
// the knob. 16 readings at 100 Hz = the last 0.16 s. Brief: 16.
static const uint8_t POT_AVERAGE_SAMPLES = 16;

// Hysteresis ("dead band") in ADC steps (the ADC reads 0..1023). The delay
// value only changes when the averaged pot reading has moved by MORE than
// this many steps, so electrical noise cannot make the delay wobble.
// 4 steps = 0.4 % of the pot travel. Raise to 6..8 if the serial status shows
// "pot=" jumping while nobody touches the knob.
static const uint16_t POT_HYSTERESIS_COUNTS = 4;

// ---------------------------------------------------------------------------
//  Tempo clock
// ---------------------------------------------------------------------------

// Tempo assumed when the DX clock has NEVER been seen since power-up
// (sequencer never started, pads played by hand). Brief: 120 BPM.
static const uint16_t DEFAULT_BPM = 120;

// If no clock tick arrives for this long, the clock is shown as "STOP".
// The last measured tempo is KEPT and still used for the delay.
// Brief: 2 s. (The slowest real tick, 25 BPM at 24 PPQN, is 0.1 s apart.)
static const uint32_t CLOCK_TIMEOUT_US = 2000000UL;

// Ticks closer together than this are treated as electrical noise and
// ignored. 1 000 µs = 1 kHz, which is faster than any DX setting
// (250 BPM x 96 PPQN = 400 ticks per second = one every 2 500 µs).
static const uint32_t MIN_TICK_PERIOD_US = 1000UL;

// The tick period is averaged over this many ticks (brief: 4). Must be a
// power of two.
static const uint8_t TICK_AVERAGE_TICKS = 4;

// ---------------------------------------------------------------------------
//  Lamp and serial port
// ---------------------------------------------------------------------------

// In DELAY mode the on-board LED (D13) blinks ON for this long on every snare
// hit the board captures. In BYPASS mode it is on steadily.
static const uint32_t LED_FLASH_US = 30000UL;   // 30 ms

// Serial monitor speed. Set the Arduino Serial Monitor to the same number.
static const uint32_t SERIAL_BAUD = 115200UL;

// How often the one-line status is printed.
static const uint32_t STATUS_INTERVAL_US = 1000000UL;  // once per second

// Building the status text takes the Nano roughly a millisecond. It is
// postponed whenever a snare replay is due within this window, so printing
// can never make a snare late.
static const uint32_t STATUS_GUARD_US = 5000UL;  // 5 ms

#endif  // TIMESHIFT_CONFIG_H
