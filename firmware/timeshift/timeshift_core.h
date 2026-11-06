// ============================================================================
//  DX TimeShift rev A  —  the "brain" (hardware-independent logic)
// ============================================================================
//
//  This file contains everything the TimeShift DECIDES: the hit queue, the
//  tempo measurement, the pot smoothing, BYPASS/DELAY switching and the
//  timing of the replayed snare trigger.
//
//  It deliberately does NOT talk to the Arduino directly. Every time it needs
//  the outside world (the clock in microseconds, a pin, the pot) it calls a
//  small function supplied in a "TimeShiftHal" table (HAL = hardware
//  abstraction layer). The real sketch (timeshift.ino) fills that table with
//  Arduino functions; the PC test program (firmware/sim/) fills it with fake
//  pins and a fake clock. That way the exact same logic is tested on a PC
//  and runs on the Nano.
//
//  Words used below:
//    tick      one pulse of the DX CLOCK OUT signal (96 per beat by default)
//    PPQN      pulses (ticks) per quarter note = per beat: 24, 48 or 96
//    hit       one snare trigger from the DX CPU (a rising edge on RST2)
//    replay    the TimeShift sending that hit to the snare circuit, later
//    BYPASS    the 74HC157 passes the DX's own snare lines straight through
//    DELAY     the 74HC157 passes the TimeShift's (delayed) lines instead
//    ISR       interrupt service routine: a function the chip runs the
//              instant a pin changes, interrupting whatever else it was doing
//
//  Only C++11 is used, so the Arduino compiler (avr-gcc) and a normal PC
//  compiler (g++ -std=c++17) both accept it. No memory is allocated at run
//  time (no new/malloc): everything is a fixed-size variable.
// ============================================================================

#ifndef TIMESHIFT_CORE_H
#define TIMESHIFT_CORE_H

#include <stdint.h>
#include <stdio.h>    // snprintf, for the status line
#include "timeshift_config.h"

static_assert((HIT_QUEUE_DEPTH & (HIT_QUEUE_DEPTH - 1)) == 0,
              "HIT_QUEUE_DEPTH must be a power of two");
static_assert(HIT_QUEUE_DEPTH <= 128, "HIT_QUEUE_DEPTH must be 128 or less");
static_assert((TICK_AVERAGE_TICKS & (TICK_AVERAGE_TICKS - 1)) == 0,
              "TICK_AVERAGE_TICKS must be a power of two");
static_assert(POT_AVERAGE_SAMPLES >= 1 && POT_AVERAGE_SAMPLES <= 64,
              "POT_AVERAGE_SAMPLES must be 1..64");

// ----------------------------------------------------------------------------
//  The connection to the outside world. Every entry must be filled in.
// ----------------------------------------------------------------------------
struct TimeShiftHal {
  uint32_t (*micros)();            // microseconds since power-up (wraps every 71.6 min)
  uint16_t (*readPot)();           // pot wiper, 0 (CCW, zero) .. 1023 (CW, full)
  bool     (*readRst2In)();        // D2: RST2 on the chip side, true = high
  bool     (*readFfa2In)();        // D4: FFA2 on the chip side
  bool     (*readFfb2In)();        // D5: FFB2 on the chip side
  void     (*writeRst2Out)(bool);  // D6: replayed RST2
  void     (*writeFfa2Out)(bool);  // D7: replayed FFA2
  void     (*writeFfb2Out)(bool);  // D8: replayed FFB2
  void     (*writeMuxSel)(bool);   // D9: false = BYPASS, true = DELAY
  void     (*writeTestPoint)(bool);// D12: TP_REPLAY
  void     (*writeLed)(bool);      // D13: LED_ACT
  void     (*delayMicros)(uint16_t);  // short busy-wait (only a few µs)
  void     (*interruptsOff)();     // start of a section the ISRs must not interrupt
  void     (*interruptsOn)();      // end of that section
};

// One captured snare hit, waiting in the queue.
struct SnareHit {
  uint32_t capturedAtUs;     // micros() at the RST2 rising edge
  uint32_t ticksAtCapture;   // tick counter at that moment (for diagnostics)
  uint8_t  levels;           // bit 0 = FFA2, bit 1 = FFB2 (the soft/medium/loud code)
};

// The state of the DX tempo clock as the TimeShift sees it.
enum ClockState : uint8_t {
  CLOCK_NONE = 0,   // never seen a tick since power-up: using DEFAULT_BPM
  CLOCK_RUNNING,    // ticks are arriving
  CLOCK_STOPPED     // ticks stopped more than CLOCK_TIMEOUT_US ago: last tempo kept
};

class TimeShiftCore {
 public:
  // ==========================================================================
  //  Helpers that do not need any state
  // ==========================================================================

  // Turns the PPQN jumper header JP1 into a PPQN number. JP1 has two
  // positions (silkscreen: "open=96, 1-2=48, 3-4=24"):
  //   JP1 1-2  shorts D10 to GND  -> 48 PPQN
  //   JP1 3-4  shorts D11 to GND  -> 24 PPQN
  // "fitted" = shunt on that position (the pin reads LOW). Both fitted is not
  // a valid setting; we then use the safe default 96 and the sketch prints a
  // warning.
  static uint8_t ppqnFromJumpers(bool jp1_12Fitted, bool jp1_34Fitted) {
    if (jp1_12Fitted && !jp1_34Fitted) return 48;
    if (jp1_34Fitted && !jp1_12Fitted) return 24;
    return 96;
  }

  // Short text for the status line, e.g. "JP1 open", "JP1 1-2".
  static const char* jumperLabel(bool jp1_12Fitted, bool jp1_34Fitted) {
    if (jp1_12Fitted && jp1_34Fitted) return "JP1 BOTH-invalid";
    if (jp1_12Fitted) return "JP1 1-2";
    if (jp1_34Fitted) return "JP1 3-4";
    return "JP1 open";
  }

  // Length of one tick at a given tempo, in µs. 120 BPM at 96 PPQN = 5208 µs.
  static uint32_t tickPeriodForBpm(uint16_t bpm, uint8_t ppqn) {
    return (uint32_t)(60000000UL / ((uint32_t)bpm * ppqn));
  }

  // ==========================================================================
  //  Start-up  (brief §3.6 "Boot")
  // ==========================================================================
  // jumperText is shown next to the PPQN in the status line (for example
  // "JP1 open"); it must be a string that never goes away (a literal).
  void begin(const TimeShiftHal* hal, uint8_t ppqn, const char* jumperText = "JP1 ?") {
    hal_ = hal;
    ppqn_ = ppqn;
    jumperText_ = jumperText;

    // All outputs low, mux on BYPASS, LED steady on.
    hal_->writeRst2Out(false);
    hal_->writeFfa2Out(false);
    hal_->writeFfb2Out(false);
    hal_->writeTestPoint(false);
    hal_->writeMuxSel(false);
    hal_->writeLed(true);
    delayMode_ = false;
    replayInProgress_ = false;

    // Empty queue, zero counters.
    queueHead_ = queueTail_ = 0;
    hitsCaptured_ = hitsReplayed_ = hitsDropped_ = 0;

    // Tempo: until the DX clock has been seen, pretend it runs at DEFAULT_BPM.
    const uint32_t p = tickPeriodForBpm(DEFAULT_BPM, ppqn_);
    for (uint8_t i = 0; i < TICK_AVERAGE_TICKS; i++) tickPeriods_[i] = p;
    tickPeriodSum_ = p * TICK_AVERAGE_TICKS;
    tickPeriodIndex_ = 0;
    tickCount_ = 0;
    ticksInThisRun_ = 0;
    clockEverSeen_ = false;
    clockStopped_ = false;
    lastTickUs_ = 0;
    tickCountSeenByLoop_ = 0;

    // Pot: fill the whole average with the current reading so the delay is
    // right from the very first moment (no slow fade-in after power-up).
    const uint32_t now = hal_->micros();
    const uint16_t raw = hal_->readPot();
    for (uint8_t i = 0; i < POT_AVERAGE_SAMPLES; i++) potSamples_[i] = raw;
    potSum_ = (uint32_t)raw * POT_AVERAGE_SAMPLES;
    potIndex_ = 0;
    potCounts_ = snapToEnds(raw);
    lastPotReadUs_ = now;

    // LED bookkeeping.
    hitsSeenByLed_ = 0;
    ledFlashStartUs_ = now;
    ledFlashing_ = false;
    ledOn_ = true;
  }

  // ==========================================================================
  //  INT0 ISR: called the instant RST2 (chip side) rises = the DX fired a snare.
  //  levelA/levelB are FFA2/FFB2 read at that instant; nowUs = micros().
  //  Interrupts are already off inside an ISR, so no locking is needed here.
  // ==========================================================================
  void isrSnareHit(bool levelA, bool levelB, uint32_t nowUs) {
    hitsCaptured_++;
    // In BYPASS the DX's own trigger already reached the snare through the
    // mux, so we only count it. Nothing is queued.
    if (!delayMode_) return;

    const uint8_t used = (uint8_t)(queueHead_ - queueTail_);
    if (used >= HIT_QUEUE_DEPTH) {   // queue full (should never happen)
      hitsDropped_++;
      return;
    }
    SnareHit& slot = queue_[queueHead_ & (HIT_QUEUE_DEPTH - 1)];
    slot.capturedAtUs = nowUs;
    slot.ticksAtCapture = tickCount_;
    slot.levels = (uint8_t)((levelA ? 1 : 0) | (levelB ? 2 : 0));
    queueHead_ = (uint8_t)(queueHead_ + 1);   // publish the slot last
  }

  // ==========================================================================
  //  INT1 ISR: called on every rising edge of the DX clock.
  //  Counts ticks and keeps a moving average of the last TICK_AVERAGE_TICKS
  //  tick periods.
  // ==========================================================================
  void isrClockTick(uint32_t nowUs) {
    // Is this the start of a new run of ticks? That is the case for the very
    // first tick after power-up, and for the first tick after the main loop
    // declared the clock stopped. The gap before such a tick is a pause, not
    // a tick period, so it must not go into the average. (Using the "stopped"
    // flag rather than comparing times keeps this right even after pauses so
    // long that micros() has wrapped around.)
    bool newRun = (ticksInThisRun_ == 0) || clockStopped_;
    uint32_t dt = 0;
    if (!newRun) {
      dt = nowUs - lastTickUs_;                // wrap-safe unsigned subtraction
      if (dt < MIN_TICK_PERIOD_US) return;     // noise spike: ignore completely
      if (dt > CLOCK_TIMEOUT_US) newRun = true;  // a pause the loop has not flagged yet
    }

    tickCount_++;
    lastTickUs_ = nowUs;
    clockEverSeen_ = true;
    if (newRun) {
      clockStopped_ = false;
      ticksInThisRun_ = 1;
      return;
    }

    if (ticksInThisRun_ == 1) {
      // First real period of this run: fill the whole average with it so a
      // tempo change while stopped is followed immediately.
      for (uint8_t i = 0; i < TICK_AVERAGE_TICKS; i++) tickPeriods_[i] = dt;
      tickPeriodSum_ = dt * TICK_AVERAGE_TICKS;
    } else {
      // Normal moving average: replace the oldest period with the newest.
      tickPeriodSum_ = tickPeriodSum_ - tickPeriods_[tickPeriodIndex_] + dt;
      tickPeriods_[tickPeriodIndex_] = dt;
      tickPeriodIndex_ = (uint8_t)((tickPeriodIndex_ + 1) & (TICK_AVERAGE_TICKS - 1));
    }
    if (ticksInThisRun_ < 255) ticksInThisRun_++;
  }

  // ==========================================================================
  //  Main loop work. Call this as often as possible (thousands of times per
  //  second). It never waits for anything except the ~25 µs replay pulse.
  // ==========================================================================
  void update() {
    const uint32_t now = hal_->micros();

    // 1. Most time-critical first: is the oldest queued hit due?
    serviceQueue(now);

    // 2. Has the clock stopped?
    watchClock(now);

    // 3. Read the pot about 100 times per second.
    if ((uint32_t)(now - lastPotReadUs_) >= POT_READ_INTERVAL_US) {
      lastPotReadUs_ = now;
      readPot();
    }

    // 4. Switch BYPASS <-> DELAY if the pot asks for it (retried every loop
    //    until it is safe to switch).
    const bool wantDelay = potCounts_ > bypassThresholdCounts();
    if (wantDelay && !delayMode_) tryEnterDelayMode();
    if (!wantDelay && delayMode_) tryLeaveDelayMode();

    // 5. The LED.
    updateLed(now);
  }

  // ==========================================================================
  //  Status for the serial monitor. Writes one line (no line ending) into buf.
  //  Example:
  //  mode=DELAY pot=50.0% delay=250.0ms ppqn=96 (JP1 open) bpm=120.0 clock=RUN queue=1 hits=12 replayed=11 dropped=0
  // ==========================================================================
  void formatStatus(char* buf, unsigned bufSize) const {
    uint32_t sum, captured, dropped;
    uint8_t used;
    hal_->interruptsOff();
    sum = tickPeriodSum_;
    captured = hitsCaptured_;
    dropped = hitsDropped_;
    used = (uint8_t)(queueHead_ - queueTail_);
    hal_->interruptsOn();

    const uint32_t pot10 = (uint32_t)potCounts_ * 1000UL / 1023UL;          // 0..1000
    // BPM = 60 000 000 / (PPQN x tick period). x10 for one decimal place.
    // Written as (600 000 000 / PPQN) x TICK_AVERAGE_TICKS / sum to stay
    // inside 32-bit whole numbers; "+ sum/2" rounds to nearest.
    const uint32_t bpm10 =
        ((600000000UL / ppqn_) * TICK_AVERAGE_TICKS + sum / 2) / sum;
    const uint32_t dly10 = delayMode_ ? (uint32_t)(delayUs(sum) / 100.0f + 0.5f) : 0;  // ms x 10
    static const char* const clockNames[] = {"NONE", "RUN", "STOP"};

    snprintf(buf, bufSize,
             "mode=%s pot=%lu.%lu%% delay=%lu.%lums ppqn=%u (%s) bpm=%lu.%lu clock=%s "
             "queue=%u hits=%lu replayed=%lu dropped=%lu",
             delayMode_ ? "DELAY" : "BYPASS",
             (unsigned long)(pot10 / 10), (unsigned long)(pot10 % 10),
             (unsigned long)(dly10 / 10), (unsigned long)(dly10 % 10),
             (unsigned)ppqn_, jumperText_,
             (unsigned long)(bpm10 / 10), (unsigned long)(bpm10 % 10),
             clockNames[clockState()],
             (unsigned)used,
             (unsigned long)captured, (unsigned long)hitsReplayed_,
             (unsigned long)dropped);
  }

  // ==========================================================================
  //  Read-only views (used by the tests and the status line)
  // ==========================================================================
  bool       isDelayMode() const { return delayMode_; }
  uint8_t    ppqn() const { return ppqn_; }
  uint16_t   potCounts() const { return potCounts_; }
  ClockState clockState() const {
    if (!clockEverSeen_) return CLOCK_NONE;
    return clockStopped_ ? CLOCK_STOPPED : CLOCK_RUNNING;
  }
  uint8_t queueLength() const {
    hal_->interruptsOff();
    const uint8_t n = (uint8_t)(queueHead_ - queueTail_);
    hal_->interruptsOn();
    return n;
  }
  uint32_t hitsCaptured() const { return readAtomic32(hitsCaptured_); }
  uint32_t hitsReplayed() const { return hitsReplayed_; }
  uint32_t hitsDropped() const { return readAtomic32(hitsDropped_); }
  uint32_t averageTickPeriodUs() const {
    return readAtomic32(tickPeriodSum_) / TICK_AVERAGE_TICKS;
  }
  // True if a queued hit will be due within the next windowUs microseconds.
  // The sketch uses this to postpone slow jobs (formatting the status line)
  // so they can never make a replay late.
  bool replayDueWithin(uint32_t windowUs) const {
    if (!delayMode_) return false;
    hal_->interruptsOff();
    const bool empty = (queueHead_ == queueTail_);
    const uint32_t capturedAt = empty ? 0 : queue_[queueTail_ & (HIT_QUEUE_DEPTH - 1)].capturedAtUs;
    const uint32_t periodSum = tickPeriodSum_;
    hal_->interruptsOn();
    if (empty) return false;
    const uint32_t elapsed = hal_->micros() - capturedAt;
    return (float)elapsed + (float)windowUs >= delayUs(periodSum);
  }

  // The delay that would be applied right now, in µs (0 in BYPASS).
  float currentDelayUs() const {
    return delayMode_ ? delayUs(readAtomic32(tickPeriodSum_)) : 0.0f;
  }

 private:
  // ==========================================================================
  //  The scheduler (brief §3.6): replay the oldest hit when it is due.
  //
  //  delay_us = delay_beats x PPQN x tick_period_us
  //
  //  The CURRENT pot setting and the CURRENT measured tick period are used
  //  every time we check, so the delay follows tempo changes and pot moves
  //  continuously (it is not frozen at the moment of the hit). All hits share
  //  the same delay, so the oldest hit is always the first one due: hits come
  //  out in the order they went in.
  // ==========================================================================
  void serviceQueue(uint32_t now) {
    if (!delayMode_) return;

    // Copy what we need from the ISR-shared variables in one go, with the
    // interrupts held off so we never see a half-written value.
    SnareHit hit = {0, 0, 0};
    uint32_t periodSum;
    hal_->interruptsOff();
    const bool empty = (queueHead_ == queueTail_);
    if (!empty) hit = queue_[queueTail_ & (HIT_QUEUE_DEPTH - 1)];
    periodSum = tickPeriodSum_;
    hal_->interruptsOn();
    if (empty) return;

    // Elapsed time since the hit. Unsigned subtraction gives the right answer
    // even when micros() has wrapped from 4 294 967 295 back to 0 in between.
    const uint32_t elapsed = now - hit.capturedAtUs;

    if (elapsed > MAX_HIT_AGE_US) {           // safety net: too old, discard
      popQueue();
      hal_->interruptsOff();
      hitsDropped_++;
      hal_->interruptsOn();
      return;
    }
    if ((float)elapsed >= delayUs(periodSum)) {
      replay(hit.levels);
      popQueue();
      hitsReplayed_++;
    }
  }

  // delay_us = delay_beats x PPQN x tick_period_us, with
  // tick_period_us = periodSum / TICK_AVERAGE_TICKS.
  float delayUs(uint32_t periodSum) const {
    float beats = (float)potCounts_ * (MAX_DELAY_BEATS / 1023.0f);
    if (beats > MAX_DELAY_BEATS) beats = MAX_DELAY_BEATS;   // clamp
    return beats * (float)ppqn_ * ((float)periodSum / (float)TICK_AVERAGE_TICKS);
  }

  void popQueue() {
    // Only the main loop writes queueTail_, and an 8-bit write is a single
    // instruction on the AVR, so this needs no lock.
    queueTail_ = (uint8_t)(queueTail_ + 1);
  }

  // Send one hit to the snare circuit: exactly the order the DX CPU uses.
  //   1. set the level lines   2. wait   3. RST2 high   4. wait   5. RST2 low
  // The sound starts at step 5. TP_REPLAY (D12) mirrors RST2_OUT for a scope.
  void replay(uint8_t levels) {
    replayInProgress_ = true;
    hal_->writeFfa2Out((levels & 1) != 0);
    hal_->writeFfb2Out((levels & 2) != 0);
    hal_->delayMicros(LEVEL_SETUP_US);
    hal_->writeRst2Out(true);
    hal_->writeTestPoint(true);
    hal_->delayMicros(RST2_PULSE_US);
    hal_->writeRst2Out(false);
    hal_->writeTestPoint(false);
    // FFA2_OUT / FFB2_OUT stay where they are until the next replay: the
    // snare circuit needs them held for the whole sound, as the DX does.
    replayInProgress_ = false;
  }

  // --------------------------------------------------------------------------
  //  BYPASS <-> DELAY switching (brief §3.6), glitch-free:
  //  the mux select line is only changed while RST2 is LOW on both sides, and
  //  with interrupts off so a hit cannot sneak in half-way through.
  // --------------------------------------------------------------------------
  void tryEnterDelayMode() {
    hal_->interruptsOff();
    // Make the "delayed" side of the mux show exactly what the "direct" side
    // shows right now, so switching over causes no change at all on the
    // snare lines. (The mux is still on BYPASS, so these writes are not
    // heard yet.)
    hal_->writeFfa2Out(hal_->readFfa2In());
    hal_->writeFfb2Out(hal_->readFfb2In());
    hal_->writeRst2Out(false);
    // Check RST2 as late as possible, right before switching.
    if (hal_->readRst2In()) {          // the DX is mid-trigger: try next loop
      hal_->interruptsOn();
      return;
    }
    hal_->writeMuxSel(true);           // now the snare listens to us
    queueTail_ = queueHead_;           // start with an empty queue
    delayMode_ = true;
    hal_->interruptsOn();
  }

  void tryLeaveDelayMode() {
    hal_->interruptsOff();
    if (replayInProgress_ || hal_->readRst2In()) {
      hal_->interruptsOn();
      return;                          // not safe yet: try next loop
    }
    hal_->writeMuxSel(false);          // DX drives the snare directly again
    delayMode_ = false;
    // Hits still waiting are discarded: with the pot at zero the user wants
    // the stock DX, and the DX's own triggers now pass straight through.
    queueTail_ = queueHead_;
    hal_->interruptsOn();
    hal_->writeRst2Out(false);
    hal_->writeFfa2Out(false);
    hal_->writeFfb2Out(false);
  }

  // --------------------------------------------------------------------------
  //  Pot: 16-reading moving average, then hysteresis.
  // --------------------------------------------------------------------------
  void readPot() {
    const uint16_t raw = hal_->readPot();
    potSum_ = potSum_ - potSamples_[potIndex_] + raw;
    potSamples_[potIndex_] = raw;
    potIndex_ = (uint8_t)((potIndex_ + 1) % POT_AVERAGE_SAMPLES);
    const uint16_t avg = (uint16_t)((potSum_ + POT_AVERAGE_SAMPLES / 2) / POT_AVERAGE_SAMPLES);

    // Only accept the new value if it moved by more than the dead band.
    const uint16_t diff = avg > potCounts_ ? avg - potCounts_ : potCounts_ - avg;
    if (diff > POT_HYSTERESIS_COUNTS) potCounts_ = snapToEnds(avg);
    // Always allow the two ends to be reached exactly (0 % and 100 %).
    else if (avg <= POT_HYSTERESIS_COUNTS) potCounts_ = 0;
    else if (avg >= 1023 - POT_HYSTERESIS_COUNTS) potCounts_ = 1023;
  }

  static uint16_t snapToEnds(uint16_t v) {
    if (v <= POT_HYSTERESIS_COUNTS) return 0;
    if (v >= 1023 - POT_HYSTERESIS_COUNTS) return 1023;
    return v;
  }

  // Pot readings at or below this count mean BYPASS (1 % of 1023 = 10).
  static uint16_t bypassThresholdCounts() {
    return (uint16_t)(1023UL * BYPASS_BELOW_PERCENT / 100UL);
  }

  // --------------------------------------------------------------------------
  //  Clock watchdog: declare the clock stopped after CLOCK_TIMEOUT_US of
  //  silence. The tick period is NOT reset: the last tempo stays in use.
  // --------------------------------------------------------------------------
  void watchClock(uint32_t now) {
    hal_->interruptsOff();
    const uint32_t ticks = tickCount_;
    const uint32_t last = lastTickUs_;
    if (ticks != tickCountSeenByLoop_) {
      tickCountSeenByLoop_ = ticks;    // new ticks arrived: clock is alive
    } else if (clockEverSeen_ && !clockStopped_ &&
               (uint32_t)(now - last) > CLOCK_TIMEOUT_US) {
      clockStopped_ = true;            // latched until the next tick arrives
    }
    hal_->interruptsOn();
  }

  // --------------------------------------------------------------------------
  //  LED: steady ON in BYPASS. In DELAY: normally off, 30 ms flash per hit.
  // --------------------------------------------------------------------------
  void updateLed(uint32_t now) {
    const uint32_t captured = readAtomic32(hitsCaptured_);
    bool on;
    if (!delayMode_) {
      hitsSeenByLed_ = captured;       // hits in BYPASS do not flash
      ledFlashing_ = false;
      on = true;
    } else {
      if (captured != hitsSeenByLed_) {  // a new hit since last time: flash
        hitsSeenByLed_ = captured;
        ledFlashStartUs_ = now;
        ledFlashing_ = true;
      }
      if (ledFlashing_ && (uint32_t)(now - ledFlashStartUs_) >= LED_FLASH_US) {
        ledFlashing_ = false;
      }
      on = ledFlashing_;
    }
    if (on != ledOn_) {                // only touch the pin when it changes
      ledOn_ = on;
      hal_->writeLed(on);
    }
  }

  // A 32-bit read is four separate byte reads on the AVR. If an ISR changed
  // the value between them we would read garbage, so hold interrupts off.
  uint32_t readAtomic32(const volatile uint32_t& v) const {
    hal_->interruptsOff();
    const uint32_t copy = v;
    hal_->interruptsOn();
    return copy;
  }

  // ==========================================================================
  //  State. "volatile" marks variables that an ISR changes behind the main
  //  loop's back, so the compiler must re-read them every time.
  // ==========================================================================
  const TimeShiftHal* hal_ = nullptr;
  uint8_t ppqn_ = 96;
  const char* jumperText_ = "JP1 ?";

  // Mode
  volatile bool delayMode_ = false;   // read by the INT0 ISR
  bool replayInProgress_ = false;

  // Hit queue: a ring buffer. The ISR writes at queueHead_, the loop reads at
  // queueTail_. Both counters run freely 0..255 and wrap; (head - tail) is
  // the number of waiting hits.
  SnareHit queue_[HIT_QUEUE_DEPTH];
  volatile uint8_t queueHead_ = 0;
  volatile uint8_t queueTail_ = 0;

  // Counters for the status line
  volatile uint32_t hitsCaptured_ = 0;
  volatile uint32_t hitsDropped_ = 0;
  uint32_t hitsReplayed_ = 0;

  // Tempo clock (written by the INT1 ISR)
  volatile uint32_t tickCount_ = 0;
  volatile uint32_t lastTickUs_ = 0;
  volatile uint32_t tickPeriods_[TICK_AVERAGE_TICKS] = {};
  volatile uint32_t tickPeriodSum_ = 0;
  volatile uint8_t  tickPeriodIndex_ = 0;
  volatile uint8_t  ticksInThisRun_ = 0;
  volatile bool     clockEverSeen_ = false;
  volatile bool     clockStopped_ = false;
  uint32_t tickCountSeenByLoop_ = 0;

  // Pot
  uint16_t potSamples_[POT_AVERAGE_SAMPLES] = {};
  uint32_t potSum_ = 0;
  uint8_t  potIndex_ = 0;
  uint16_t potCounts_ = 0;           // smoothed, after hysteresis, 0..1023
  uint32_t lastPotReadUs_ = 0;

  // LED
  uint32_t hitsSeenByLed_ = 0;
  uint32_t ledFlashStartUs_ = 0;
  bool     ledFlashing_ = false;
  bool     ledOn_ = true;
};

#endif  // TIMESHIFT_CORE_H
