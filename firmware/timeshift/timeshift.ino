// ============================================================================
//  DX TimeShift rev A  —  snare delay for the Oberheim DX (board 1721A, U701)
//  Arduino Nano (ATmega328P, 5 V, 16 MHz)
// ============================================================================
//
//  WHAT THIS PROGRAM DOES, IN PLAIN WORDS
//  --------------------------------------
//  The DX's computer starts a snare sound by flicking three wires that come
//  out of chip U701:  FFA2 and FFB2 say how loud (soft / medium / loud), and
//  a short HIGH pulse on RST2 says "go". The TimeShift board sits between
//  U701 and the snare circuit.
//
//   * Pot at zero (or this program not running): a switch chip (74HC157)
//     connects U701 straight to the snare circuit. The DX is stock.
//   * Pot turned up: the switch chip connects the snare circuit to THIS
//     program instead. Every time the DX fires the snare, we note the time
//     and the loudness, and fire the snare ourselves a little later.
//
//  "A little later" is a fraction of a BEAT, not a fixed time. We measure the
//  tempo from the DX CLOCK OUT signal (96 ticks per beat), so 50 % on the pot
//  is always half a beat, whatever the tempo:
//
//        delay_us = delay_beats x PPQN x tick_period_us
//
//  Example: 120 BPM, 96 PPQN  ->  one tick = 5 208 µs, one beat = 500 ms.
//           Pot at 50 %       ->  delay = 0.5 x 96 x 5 208 µs = 250 ms.
//
//  WHERE THINGS ARE
//  ----------------
//    timeshift.ino        this file: pins, interrupts, serial port
//    timeshift_core.h     the decision logic (queue, tempo, pot, switching).
//                         The PC tests in firmware/sim/ test this same file.
//    timeshift_config.h   ALL SETTINGS you might want to change (pulse
//                         widths, queue size, default tempo, hysteresis,
//                         maximum delay, clock timeout, ...). Look there first.
//
//  The behaviour follows PROJECT_BRIEF.md §3.5 (pins) and §3.6 (behaviour).
// ============================================================================

#include "timeshift_config.h"
#include "timeshift_core.h"

// ----------------------------------------------------------------------------
//  Pin map  (PROJECT_BRIEF.md §3.5, locked. Do not change without changing
//  the circuit board too.)
// ----------------------------------------------------------------------------
const uint8_t PIN_RST2_IN   = 2;   // INT0. From U701 pin 15. Rising edge = snare hit.
const uint8_t PIN_CLK_IN    = 3;   // INT1. DX clock via 74HC14. Rising edge = 1 tick.
const uint8_t PIN_FFA2_IN   = 4;   // From U701 pin 12. Level bit A.
const uint8_t PIN_FFB2_IN   = 5;   // From U701 pin 10. Level bit B.
const uint8_t PIN_RST2_OUT  = 6;   // Replayed trigger  -> 74HC157 input 1B.
const uint8_t PIN_FFA2_OUT  = 7;   // Replayed level A  -> 74HC157 input 2B.
const uint8_t PIN_FFB2_OUT  = 8;   // Replayed level B  -> 74HC157 input 3B.
const uint8_t PIN_MUX_SEL   = 9;   // 74HC157 S. LOW = bypass (stock), HIGH = delayed.
const uint8_t PIN_PPQN_JP1_12 = 10;  // JP1 position 1-2 (to GND). Fitted = 48 PPQN.
const uint8_t PIN_PPQN_JP1_34 = 11;  // JP1 position 3-4 (to GND). Fitted = 24 PPQN.
const uint8_t PIN_TP_REPLAY = 12;  // Test point TP1: high during each replayed trigger.
const uint8_t PIN_LED_ACT   = 13;  // On-board LED.
const uint8_t PIN_POT       = A0;  // Pot wiper (via 1 kΩ + 100 nF filter).

// D4 and D5 are bits 4 and 5 of the ATmega328P's port D. The snare-hit
// interrupt reads them both in ONE instruction (PIND) so they are sampled at
// exactly the same moment, and much faster than digitalRead().
const uint8_t FFA2_IN_PORTD_BIT = 4;
const uint8_t FFB2_IN_PORTD_BIT = 5;

// ----------------------------------------------------------------------------
//  The logic itself lives in timeshift_core.h. This is the one instance.
// ----------------------------------------------------------------------------
TimeShiftCore core;

// ----------------------------------------------------------------------------
//  The "HAL" table: small functions that connect the logic to real pins.
// ----------------------------------------------------------------------------
static uint32_t halMicros()               { return micros(); }
static uint16_t halReadPot()              { return (uint16_t)analogRead(PIN_POT); }
static bool     halReadRst2In()           { return digitalRead(PIN_RST2_IN) == HIGH; }
static bool     halReadFfa2In()           { return digitalRead(PIN_FFA2_IN) == HIGH; }
static bool     halReadFfb2In()           { return digitalRead(PIN_FFB2_IN) == HIGH; }
static void     halWriteRst2Out(bool v)   { digitalWrite(PIN_RST2_OUT, v ? HIGH : LOW); }
static void     halWriteFfa2Out(bool v)   { digitalWrite(PIN_FFA2_OUT, v ? HIGH : LOW); }
static void     halWriteFfb2Out(bool v)   { digitalWrite(PIN_FFB2_OUT, v ? HIGH : LOW); }
static void     halWriteMuxSel(bool v)    { digitalWrite(PIN_MUX_SEL, v ? HIGH : LOW); }
static void     halWriteTestPoint(bool v) { digitalWrite(PIN_TP_REPLAY, v ? HIGH : LOW); }
static void     halWriteLed(bool v)       { digitalWrite(PIN_LED_ACT, v ? HIGH : LOW); }
static void     halDelayMicros(uint16_t us) { delayMicroseconds(us); }
// The main loop is the only caller, never an interrupt, so a plain
// "interrupts off / on" pair is correct here (no nesting).
static void     halInterruptsOff()        { noInterrupts(); }
static void     halInterruptsOn()         { interrupts(); }

static const TimeShiftHal hal = {
  halMicros, halReadPot,
  halReadRst2In, halReadFfa2In, halReadFfb2In,
  halWriteRst2Out, halWriteFfa2Out, halWriteFfb2Out,
  halWriteMuxSel, halWriteTestPoint, halWriteLed,
  halDelayMicros, halInterruptsOff, halInterruptsOn,
};

// ----------------------------------------------------------------------------
//  Interrupt routines. Kept as short as possible: note what happened, leave.
// ----------------------------------------------------------------------------

// INT0: RST2 on the chip side went HIGH = the DX just fired the snare.
// The AVR remembers the edge in hardware, so even the DX's shortest 9 µs
// pulse is never missed. FFA2/FFB2 were set by the DX before RST2 rose and
// stay put for at least 1 ms, so reading them now is safe.
void onSnareHit() {
  const uint8_t portD = PIND;   // D4 and D5 sampled together
  const bool levelA = (portD >> FFA2_IN_PORTD_BIT) & 1;
  const bool levelB = (portD >> FFB2_IN_PORTD_BIT) & 1;
  core.isrSnareHit(levelA, levelB, micros());
}

// INT1: one tick of the DX tempo clock.
void onClockTick() {
  core.isrClockTick(micros());
}

// ----------------------------------------------------------------------------
//  Non-blocking serial status.
//  Serial.print() WAITS if its 64-byte send buffer is full, which would delay
//  a snare replay. So we build the whole line in memory once per second and
//  hand it to the serial port a few bytes at a time, only as many as fit
//  without waiting.
// ----------------------------------------------------------------------------
static char     statusLine[160];
static uint8_t  statusLength = 0;   // bytes in statusLine
static uint8_t  statusSent   = 0;   // bytes already handed to Serial
static uint32_t lastStatusUs = 0;

static void serviceStatusLine() {
  const uint32_t now = micros();
  // Time for a new line? Only if the previous one has gone out completely,
  // and only if no snare replay is due in the next few ms (building the
  // text takes about a millisecond; the snare must not wait for it).
  if (statusSent >= statusLength &&
      (uint32_t)(now - lastStatusUs) >= STATUS_INTERVAL_US &&
      !core.replayDueWithin(STATUS_GUARD_US)) {
    lastStatusUs = now;
    core.formatStatus(statusLine, sizeof(statusLine) - 2);
    statusLength = (uint8_t)strlen(statusLine);
    statusLine[statusLength++] = '\r';
    statusLine[statusLength++] = '\n';
    statusSent = 0;
  }
  // Send only what fits right now; the rest goes on the next pass.
  int room = Serial.availableForWrite();
  while (room > 0 && statusSent < statusLength) {
    Serial.write(statusLine[statusSent++]);
    room--;
  }
}

// ----------------------------------------------------------------------------
//  setup(): runs once at power-up  (brief §3.6 "Boot")
// ----------------------------------------------------------------------------
void setup() {
  // Outputs: set LOW first, then make them outputs, so they never glitch high.
  // MUX_SEL LOW = BYPASS: the DX is stock until we decide otherwise. (The
  // 10 kΩ pull-down on the board already holds it LOW while we boot.)
  const uint8_t outputs[] = {PIN_RST2_OUT, PIN_FFA2_OUT, PIN_FFB2_OUT,
                             PIN_MUX_SEL, PIN_TP_REPLAY, PIN_LED_ACT};
  for (uint8_t i = 0; i < sizeof(outputs); i++) {
    digitalWrite(outputs[i], LOW);
    pinMode(outputs[i], OUTPUT);
  }

  // Inputs. The DX lines are driven by real logic outputs: no pull-ups.
  pinMode(PIN_RST2_IN, INPUT);
  pinMode(PIN_CLK_IN, INPUT);
  pinMode(PIN_FFA2_IN, INPUT);
  pinMode(PIN_FFB2_IN, INPUT);
  // PPQN jumper header JP1 (silkscreen "open=96, 1-2=48, 3-4=24"): a shunt
  // shorts the pin to GND; the internal pull-up makes an open position read
  // HIGH.
  pinMode(PIN_PPQN_JP1_12, INPUT_PULLUP);
  pinMode(PIN_PPQN_JP1_34, INPUT_PULLUP);

  // Read the PPQN jumpers once (brief: "read PPQN jumpers once").
  delayMicroseconds(100);   // let the pull-ups charge the pins
  const bool jp1_12 = digitalRead(PIN_PPQN_JP1_12) == LOW;   // shunt on 1-2?
  const bool jp1_34 = digitalRead(PIN_PPQN_JP1_34) == LOW;   // shunt on 3-4?
  const uint8_t ppqn = TimeShiftCore::ppqnFromJumpers(jp1_12, jp1_34);
  const char* jumperText = TimeShiftCore::jumperLabel(jp1_12, jp1_34);

  // Start the logic: outputs low, BYPASS, LED steady on.
  core.begin(&hal, ppqn, jumperText);

  // Banner (setup is allowed to wait; nothing is playing yet).
  Serial.begin(SERIAL_BAUD);
  Serial.println();
  Serial.println(F("DX TimeShift rev A - snare delay - Oberheim DX board 1721A (U701)"));
  Serial.print(F("PPQN jumper "));
  Serial.print(jumperText);
  Serial.print(F(" -> "));
  Serial.print(ppqn);
  Serial.println(F(" PPQN   (open=96, 1-2=48, 3-4=24)"));
  if (jp1_12 && jp1_34) {
    Serial.println(F("WARNING: JP1 has shunts on BOTH 1-2 and 3-4. That is not a valid"));
    Serial.println(F("         setting; using 96 PPQN. Fit at most ONE shunt."));
  }
  Serial.flush();

  // Attach the interrupts last, when everything else is ready. Clear any
  // edge the hardware may have remembered while we were booting.
  EIFR = _BV(INTF0) | _BV(INTF1);
  attachInterrupt(digitalPinToInterrupt(PIN_RST2_IN), onSnareHit, RISING);
  attachInterrupt(digitalPinToInterrupt(PIN_CLK_IN), onClockTick, RISING);
}

// ----------------------------------------------------------------------------
//  loop(): runs over and over, thousands of times per second.
//  Nothing in here waits, apart from the ~25 µs replay pulse itself.
// ----------------------------------------------------------------------------
void loop() {
  core.update();          // replay due hits, watch clock, read pot, switch mode, LED
  serviceStatusLine();    // a few bytes of the status line, never waits
}
