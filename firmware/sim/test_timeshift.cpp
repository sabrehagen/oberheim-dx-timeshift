// ============================================================================
//  DX TimeShift — PC test program for the firmware logic
// ============================================================================
//
//  This program runs the EXACT logic that goes into the Nano
//  (firmware/timeshift/timeshift_core.h + timeshift_config.h) on a PC.
//  Instead of real pins and a real clock it uses a fake "bench":
//
//    * a fake microsecond clock that WE move forward (and can start just
//      before the 32-bit wrap-around),
//    * fake input pins (RST2/FFA2/FFB2 chip side, pot),
//    * fake output pins that record every change with its time stamp,
//    * a fake DX clock generator that calls the tick interrupt at the right
//      moments, at any tempo and PPQN,
//    * snare hits injected by calling the hit interrupt.
//
//  Build and run:  make test     (needs g++ with C++17)
// ============================================================================

#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <string>
#include <vector>

#include "timeshift_core.h"

// ----------------------------------------------------------------------------
//  Tiny test framework
// ----------------------------------------------------------------------------
static int g_checks = 0, g_failures = 0;
static std::string g_currentTest;

#define CHECK(cond, ...)                                                    \
  do {                                                                      \
    g_checks++;                                                             \
    if (!(cond)) {                                                          \
      g_failures++;                                                         \
      std::printf("    FAIL [%s] line %d: %s  -- ", g_currentTest.c_str(), \
                  __LINE__, #cond);                                         \
      std::printf(__VA_ARGS__);                                             \
      std::printf("\n");                                                    \
    }                                                                       \
  } while (0)

#define CHECK_NEAR_MS(actualUs, expectedMs, tolMs, what)                       \
  do {                                                                         \
    double a_ = (double)(actualUs) / 1000.0;                                   \
    std::printf("    %-52s expected %8.3f ms, got %8.3f ms\n", what,           \
                (double)(expectedMs), a_);                                     \
    CHECK(std::fabs(a_ - (double)(expectedMs)) <= (double)(tolMs),             \
          "%s: expected %.3f ms +/- %.3f, got %.3f ms", what,                 \
          (double)(expectedMs), (double)(tolMs), a_);                          \
  } while (0)

// ----------------------------------------------------------------------------
//  The fake bench
// ----------------------------------------------------------------------------
struct Replay {        // one replayed trigger seen on RST2_OUT (rising edge)
  uint32_t atUs;
  bool ffa, ffb, muxSel;
};
struct PinChange {
  uint32_t atUs;
  const char* pin;
  bool value;
};

namespace bench {
uint32_t nowUs = 0;
uint16_t pot = 0;
bool rst2In = false, ffa2In = false, ffb2In = false;
bool rst2Out = false, ffa2Out = false, ffb2Out = false, muxSel = false,
     testPoint = false, led = false;
bool irqOff = false;
int lockViolations = 0;   // nested or unbalanced interruptsOff/On
std::vector<Replay> replays;
std::vector<PinChange> log;

// Fake DX clock generator
bool clockOn = false;
double tickPeriodUs = 0;     // may be fractional, like the real DX
double nextTickUs = 0;       // absolute, in "unwrapped" µs since the test start
double unwrappedNow = 0;     // nowUs without wrapping, for the generator
uint32_t startUs = 0;

void record(const char* pin, bool v) { log.push_back({nowUs, pin, v}); }

uint32_t micros() { return nowUs; }
uint16_t readPot() { return pot; }
bool readRst2In() { return rst2In; }
bool readFfa2In() { return ffa2In; }
bool readFfb2In() { return ffb2In; }
void writeRst2Out(bool v) {
  if (v && !rst2Out) replays.push_back({nowUs, ffa2Out, ffb2Out, muxSel});
  if (v != rst2Out) record("RST2_OUT", v);
  rst2Out = v;
}
void writeFfa2Out(bool v) { if (v != ffa2Out) record("FFA2_OUT", v); ffa2Out = v; }
void writeFfb2Out(bool v) { if (v != ffb2Out) record("FFB2_OUT", v); ffb2Out = v; }
void writeMuxSel(bool v) {
  if (v != muxSel) {
    record("MUX_SEL", v);
    // The brief forbids changing MUX_SEL while either RST2 is high.
    if (rst2In || rst2Out) lockViolations += 1000;
  }
  muxSel = v;
}
void writeTestPoint(bool v) { if (v != testPoint) record("TP_REPLAY", v); testPoint = v; }
void writeLed(bool v) { led = v; }
void delayMicros(uint16_t us) { nowUs += us; unwrappedNow += us; }
void interruptsOff() { if (irqOff) lockViolations++; irqOff = true; }
void interruptsOn() { if (!irqOff) lockViolations++; irqOff = false; }

const TimeShiftHal hal = {
    micros,       readPot,      readRst2In,     readFfa2In,
    readFfb2In,   writeRst2Out, writeFfa2Out,   writeFfb2Out,
    writeMuxSel,  writeTestPoint, writeLed,     delayMicros,
    interruptsOff, interruptsOn,
};

void reset(uint32_t start) {
  nowUs = startUs = start;
  unwrappedNow = 0;
  pot = 0;
  rst2In = ffa2In = ffb2In = false;
  rst2Out = ffa2Out = ffb2Out = muxSel = testPoint = led = false;
  irqOff = false;
  lockViolations = 0;
  replays.clear();
  log.clear();
  clockOn = false;
}
}  // namespace bench

// ----------------------------------------------------------------------------
//  Simulation driver
// ----------------------------------------------------------------------------
static TimeShiftCore core;
static const uint32_t STEP_US = 10;   // main loop is called every 10 µs

static double bpmToTickUs(double bpm, int ppqn) { return 60e6 / (bpm * ppqn); }

static void startTest(const char* name, uint8_t ppqn, uint16_t pot,
                      uint32_t startUs = 1000) {
  g_currentTest = name;
  std::printf("\n[%s]\n", name);
  bench::reset(startUs);
  bench::pot = pot;
  core = TimeShiftCore();
  core.begin(&bench::hal, ppqn,
             TimeShiftCore::jumperLabel(ppqn == 48, ppqn == 24));
}

static void startClock(double bpm, int ppqn) {
  bench::clockOn = true;
  bench::tickPeriodUs = bpmToTickUs(bpm, ppqn);
  bench::nextTickUs = bench::unwrappedNow;   // first tick right now
}
static void changeTempo(double bpm, int ppqn) {   // takes effect from the next tick
  bench::tickPeriodUs = bpmToTickUs(bpm, ppqn);
}
static void stopClock() { bench::clockOn = false; }

// Advance simulated time, calling the tick ISR when due and the main loop
// every STEP_US.
static void runFor(double us) {
  const double end = bench::unwrappedNow + us;
  while (bench::unwrappedNow < end) {
    const double step = std::min<double>(STEP_US, end - bench::unwrappedNow);
    const double target = bench::unwrappedNow + step;
    // Fire any clock ticks falling inside this step at their exact time.
    while (bench::clockOn && bench::nextTickUs <= target) {
      const uint32_t tickAt =
          bench::startUs + (uint32_t)(uint64_t)std::llround(bench::nextTickUs);
      core.isrClockTick(tickAt);
      bench::nextTickUs += bench::tickPeriodUs;
    }
    bench::unwrappedNow = target;
    bench::nowUs = bench::startUs + (uint32_t)(uint64_t)std::llround(target);
    core.update();
  }
}

// A snare hit as the DX does it: levels set, RST2 high ~9 µs, RST2 low.
// Returns the capture time stamp.
static uint32_t snareHit(bool ffa, bool ffb) {
  bench::ffa2In = ffa;
  bench::ffb2In = ffb;
  bench::rst2In = true;
  const uint32_t t = bench::nowUs;
  core.isrSnareHit(ffa, ffb, t);   // INT0 fires on the rising edge
  runFor(10);                      // RST2 stays high ~9 µs (FW 1.5)
  bench::rst2In = false;
  return t;
}

static size_t replayCount() { return bench::replays.size(); }

static void checkNoLockProblems() {
  CHECK(bench::lockViolations == 0, "interrupt lock / MUX_SEL violations = %d",
        bench::lockViolations);
  CHECK(!bench::irqOff, "interrupts left disabled");
}

// ============================================================================
//  The tests
// ============================================================================

// (a) 120 BPM, pot 50 % -> replay 250 ms after the hit (+/- 1 ms)
static void test_a_basic_half_beat() {
  startTest("a: 120 BPM, pot 50 % -> 250 ms", 96, 512);
  startClock(120, 96);
  runFor(200000);   // let the tempo settle
  CHECK(core.isDelayMode(), "should be in DELAY mode");
  CHECK(bench::muxSel, "MUX_SEL should be HIGH in DELAY mode");
  const uint32_t t0 = snareHit(true, true);
  runFor(400000);
  CHECK(replayCount() == 1, "expected 1 replay, got %zu", replayCount());
  if (replayCount() == 1) {
    CHECK_NEAR_MS(bench::replays[0].atUs - t0, 250.0, 1.0, "replay delay");
    CHECK(bench::replays[0].ffa && bench::replays[0].ffb, "levels not preserved");
  }
  // RST2_OUT pulse width >= 10 µs and TP_REPLAY mirrors it.
  uint32_t riseAt = 0, fallAt = 0, tpRise = 0;
  for (const auto& c : bench::log) {
    if (!std::strcmp(c.pin, "RST2_OUT") && c.value) riseAt = c.atUs;
    if (!std::strcmp(c.pin, "RST2_OUT") && !c.value) fallAt = c.atUs;
    if (!std::strcmp(c.pin, "TP_REPLAY") && c.value) tpRise = c.atUs;
  }
  std::printf("    RST2_OUT high for %u us, TP_REPLAY rose with it: %s\n",
              fallAt - riseAt, tpRise == riseAt ? "yes" : "no");
  CHECK(fallAt - riseAt >= 10, "RST2_OUT pulse %u us < 10 us", fallAt - riseAt);
  CHECK(tpRise == riseAt, "TP_REPLAY not pulsed with RST2_OUT");
  CHECK(core.hitsCaptured() == 1 && core.hitsReplayed() == 1, "counters");
  checkNoLockProblems();
}

// (b) tempo change while a hit is waiting: the delay follows the measured
//     tick period (brief §3.6: delay_us = delay_beats x PPQN x tick_period_us,
//     evaluated continuously with the CURRENT period).
static void test_b_tempo_change() {
  startTest("b1: tempo 120 -> 60 BPM 100 ms after the hit, pot 100 %", 96, 1023);
  startClock(120, 96);
  runFor(200000);
  uint32_t t0 = snareHit(true, false);
  runFor(100000);
  CHECK(replayCount() == 0, "replayed too early");
  changeTempo(60, 96);
  runFor(1500000);
  CHECK(replayCount() == 1, "expected 1 replay, got %zu", replayCount());
  if (replayCount() == 1)
    CHECK_NEAR_MS(bench::replays[0].atUs - t0, 1000.0, 1.0,
                  "1 beat at the NEW tempo (60 BPM)");
  checkNoLockProblems();

  startTest("b2: tempo 60 -> 120 BPM 300 ms after the hit, pot 100 %", 96, 1023);
  startClock(60, 96);
  runFor(200000);
  t0 = snareHit(false, true);
  runFor(300000);
  CHECK(replayCount() == 0, "replayed too early");
  changeTempo(120, 96);
  runFor(1500000);
  CHECK(replayCount() == 1, "expected 1 replay, got %zu", replayCount());
  if (replayCount() == 1)
    CHECK_NEAR_MS(bench::replays[0].atUs - t0, 500.0, 1.0,
                  "1 beat at the NEW tempo (120 BPM)");
  checkNoLockProblems();

  startTest("b3: tempo 120 -> 200 BPM after the new delay already passed", 96, 1023);
  startClock(120, 96);
  runFor(200000);
  t0 = snareHit(true, true);
  runFor(400000);    // 400 ms waited; 1 beat at 200 BPM = 300 ms -> due at once
  changeTempo(200, 96);
  runFor(100000);
  CHECK(replayCount() == 1, "expected 1 replay, got %zu", replayCount());
  if (replayCount() == 1) {
    const double ms = (bench::replays[0].atUs - t0) / 1000.0;
    std::printf("    fired %.3f ms after the hit (as soon as the new tempo was measured)\n", ms);
    CHECK(ms > 400.0 && ms < 430.0, "expected shortly after 400 ms, got %.3f", ms);
  }
  checkNoLockProblems();
}

// (c) overlapping hits: several hits waiting at once all come out, in order,
//     each with its own level.
static void test_c_overlapping() {
  startTest("c1: 4 overlapping hits at 1 beat (500 ms), 120 BPM", 96, 1023);
  startClock(120, 96);
  runFor(200000);
  struct { double atMs; bool a, b; } hits[] = {
      {0, false, false}, {100, false, true}, {200, true, true}, {230, true, false}};
  uint32_t t[4];
  double clock = 0;
  for (int i = 0; i < 4; i++) {
    runFor((hits[i].atMs - clock) * 1000.0);
    clock = hits[i].atMs;
    t[i] = snareHit(hits[i].a, hits[i].b);
    clock += 0.010;
  }
  std::printf("    queue length after 4 hits: %u\n", core.queueLength());
  CHECK(core.queueLength() == 4, "queue length %u", core.queueLength());
  runFor(1000000);
  CHECK(replayCount() == 4, "expected 4 replays, got %zu", replayCount());
  for (size_t i = 0; i < replayCount() && i < 4; i++) {
    char what[64];
    std::snprintf(what, sizeof what, "hit %zu (FFA2=%d FFB2=%d) delay", i,
                  hits[i].a, hits[i].b);
    CHECK_NEAR_MS(bench::replays[i].atUs - t[i], 500.0, 1.0, what);
    CHECK(bench::replays[i].ffa == hits[i].a && bench::replays[i].ffb == hits[i].b,
          "hit %zu replayed with wrong levels", i);
    if (i > 0) CHECK(bench::replays[i].atUs > bench::replays[i - 1].atUs, "order");
  }
  checkNoLockProblems();

  startTest("c2: queue full -> 32 kept, extra hit dropped and counted", 96, 1023);
  startClock(120, 96);
  runFor(200000);
  for (int i = 0; i < HIT_QUEUE_DEPTH + 1; i++) { snareHit(true, true); runFor(2000); }
  std::printf("    captured=%u queued=%u dropped=%u\n", (unsigned)core.hitsCaptured(),
              core.queueLength(), (unsigned)core.hitsDropped());
  CHECK(core.queueLength() == HIT_QUEUE_DEPTH, "queue %u", core.queueLength());
  CHECK(core.hitsDropped() == 1, "dropped %u", (unsigned)core.hitsDropped());
  runFor(1000000);
  CHECK(replayCount() == HIT_QUEUE_DEPTH, "replays %zu", replayCount());
  checkNoLockProblems();
}

// (d) pot at zero: BYPASS, no replay from the firmware.
static void test_d_bypass() {
  startTest("d1: pot 0 -> BYPASS, hits counted but never replayed", 96, 0);
  startClock(120, 96);
  runFor(200000);
  CHECK(!core.isDelayMode(), "should be BYPASS");
  CHECK(!bench::muxSel, "MUX_SEL must stay LOW");
  CHECK(bench::led, "LED should be steady ON in BYPASS");
  for (int i = 0; i < 5; i++) { snareHit(true, true); runFor(100000); }
  runFor(2000000);
  CHECK(replayCount() == 0, "firmware replayed %zu hits in BYPASS", replayCount());
  CHECK(core.hitsCaptured() == 5, "captured %u", (unsigned)core.hitsCaptured());
  CHECK(bench::led, "LED should still be steady ON");
  std::printf("    5 hits captured, %zu replayed, MUX_SEL=%d, LED=%d\n", replayCount(),
              bench::muxSel, bench::led);
  checkNoLockProblems();

  startTest("d2: 1 % threshold: pot 10/1023 at power-up = BYPASS", 96, 10);
  runFor(300000);
  CHECK(!core.isDelayMode(), "10/1023 should be BYPASS");
  checkNoLockProblems();
  startTest("d2: 1 % threshold: pot 11/1023 at power-up = DELAY", 96, 11);
  runFor(300000);
  CHECK(core.isDelayMode(), "11/1023 should be DELAY");
  std::printf("    10 counts -> BYPASS, 11 counts -> DELAY\n");
  bench::pot = 0;
  runFor(300000);
  CHECK(!core.isDelayMode(), "0 should be BYPASS");
  checkNoLockProblems();

  startTest("d3: pot turned to 0 while hits are queued -> nothing replayed once in BYPASS", 96, 1023);
  startClock(120, 96);
  runFor(200000);
  snareHit(true, true);
  runFor(50000);
  snareHit(false, true);
  runFor(50000);
  bench::pot = 0;
  // While the 16-reading pot average slides down to 0 (~0.16 s) the delay
  // shrinks, so hits already waiting may come out early. Keep hitting the
  // snare all the way until BYPASS is reached.
  while (core.isDelayMode()) { snareHit(true, true); runFor(2000); }
  const size_t replaysAtBypass = replayCount();
  const uint8_t queuedAtBypass = core.queueLength();
  for (int i = 0; i < 5; i++) { snareHit(true, true); runFor(100000); }
  runFor(2000000);
  std::printf("    replayed during the pot ramp: %zu; after BYPASS: %zu; queue: %u\n",
              replaysAtBypass, replayCount() - replaysAtBypass, queuedAtBypass);
  CHECK(!bench::muxSel, "MUX_SEL must be LOW");
  CHECK(replayCount() == replaysAtBypass, "replayed %zu after BYPASS",
        replayCount() - replaysAtBypass);
  CHECK(queuedAtBypass == 0 && core.queueLength() == 0, "queue not flushed");
  checkNoLockProblems();
}

// (e) no clock ever: 120 BPM is assumed.
static void test_e_no_clock() {
  startTest("e: no clock ever seen -> 120 BPM default", 96, 1023);
  runFor(100000);
  CHECK(core.clockState() == CLOCK_NONE, "clock state should be NONE");
  uint32_t t0 = snareHit(true, true);
  runFor(800000);
  CHECK(replayCount() == 1, "expected 1 replay, got %zu", replayCount());
  if (replayCount() == 1)
    CHECK_NEAR_MS(bench::replays[0].atUs - t0, 500.0, 1.0, "pot 100 % = 1 beat at 120 BPM");
  bench::pot = 512;
  runFor(300000);
  t0 = snareHit(true, true);
  runFor(800000);
  CHECK(replayCount() == 2, "expected 2 replays, got %zu", replayCount());
  if (replayCount() == 2)
    CHECK_NEAR_MS(bench::replays[1].atUs - t0, 250.0, 1.0, "pot 50 % = half beat at 120 BPM");
  char status[160];
  core.formatStatus(status, sizeof status);
  std::printf("    status: %s\n", status);
  CHECK(std::strstr(status, "bpm=120.0") && std::strstr(status, "clock=NONE"),
        "status line should show bpm=120.0 clock=NONE");
  checkNoLockProblems();
}

// (f) micros() wrap-around (every 71.6 minutes on the Nano).
static void test_f_wraparound() {
  // Start 300 ms before micros() wraps from 0xFFFFFFFF to 0.
  startTest("f1: hit 100 ms before micros() wraps, replay after the wrap", 96, 512,
            0xFFFFFFFFu - 300000u);
  startClock(120, 96);
  runFor(200000);   // the clock ticks keep running across the wrap below
  const uint32_t t0 = snareHit(true, false);
  std::printf("    hit captured at micros() = %u (wrap at 4294967295)\n", t0);
  runFor(400000);
  CHECK(replayCount() == 1, "expected 1 replay, got %zu", replayCount());
  if (replayCount() == 1) {
    std::printf("    replayed at micros() = %u\n", bench::replays[0].atUs);
    CHECK(bench::replays[0].atUs < t0, "replay should be after the wrap");
    CHECK_NEAR_MS((uint32_t)(bench::replays[0].atUs - t0), 250.0, 1.0, "delay across wrap");
  }
  CHECK(std::llabs((long long)core.averageTickPeriodUs() - 5208) <= 1,
        "tick period measured across the wrap: %u", (unsigned)core.averageTickPeriodUs());
  CHECK(core.clockState() == CLOCK_RUNNING, "clock should be RUNNING");
  checkNoLockProblems();

  startTest("f2: clock stopped just before the wrap is still seen as stopped", 96, 512,
            0xFFFFFFFFu - 3000000u);
  startClock(120, 96);
  runFor(500000);
  stopClock();
  runFor(5000000);   // 5 s of silence, crossing the wrap
  std::printf("    clock state after 5 s silence across the wrap: %s\n",
              core.clockState() == CLOCK_STOPPED ? "STOP" : "not STOP");
  CHECK(core.clockState() == CLOCK_STOPPED, "clock should be STOPPED");
  CHECK(std::llabs((long long)core.averageTickPeriodUs() - 5208) <= 1,
        "last tick period must be kept: %u", (unsigned)core.averageTickPeriodUs());
  checkNoLockProblems();
}

// (g) PPQN 24 / 48 / 96 all give the same musical delay.
static void test_g_ppqn() {
  g_currentTest = "g0: PPQN jumper JP1";
  std::printf("\n[%s]\n", g_currentTest.c_str());
  CHECK(TimeShiftCore::ppqnFromJumpers(false, false) == 96, "JP1 open");
  CHECK(TimeShiftCore::ppqnFromJumpers(true, false) == 48, "JP1 1-2");
  CHECK(TimeShiftCore::ppqnFromJumpers(false, true) == 24, "JP1 3-4");
  CHECK(TimeShiftCore::ppqnFromJumpers(true, true) == 96, "both fitted -> safe default");
  CHECK(!std::strcmp(TimeShiftCore::jumperLabel(false, false), "JP1 open"), "label open");
  CHECK(!std::strcmp(TimeShiftCore::jumperLabel(true, false), "JP1 1-2"), "label 1-2");
  CHECK(!std::strcmp(TimeShiftCore::jumperLabel(false, true), "JP1 3-4"), "label 3-4");
  std::printf("    JP1 open=96, 1-2=48, 3-4=24, both=96 (invalid -> default)\n");

  const int ppqns[] = {24, 48, 96};
  for (int ppqn : ppqns) {
    char name[96];
    std::snprintf(name, sizeof name, "g: PPQN %d at 120 BPM pot 50 %% and 90 BPM pot 100 %%", ppqn);
    startTest(name, (uint8_t)ppqn, 512);
    startClock(120, ppqn);
    runFor(300000);
    uint32_t t0 = snareHit(true, true);
    runFor(400000);
    CHECK(replayCount() == 1, "expected 1 replay, got %zu", replayCount());
    if (replayCount() == 1) CHECK_NEAR_MS(bench::replays[0].atUs - t0, 250.0, 1.0, "120 BPM, 50 %");

    changeTempo(90, ppqn);
    bench::pot = 1023;
    runFor(500000);
    t0 = snareHit(true, true);
    runFor(1000000);
    CHECK(replayCount() == 2, "expected 2 replays, got %zu", replayCount());
    if (replayCount() == 2)
      CHECK_NEAR_MS(bench::replays[1].atUs - t0, 60000.0 / 90.0, 1.0, "90 BPM, 100 %");
    // Default tempo also scales with PPQN when no clock was ever seen.
    TimeShiftCore fresh;
    fresh.begin(&bench::hal, (uint8_t)ppqn);
    CHECK(std::llabs((long long)fresh.averageTickPeriodUs() * ppqn - 500000) <= ppqn,
          "default beat at PPQN %d = %u us", ppqn,
          (unsigned)(fresh.averageTickPeriodUs() * ppqn));
    checkNoLockProblems();
  }
}

// ---- Extra checks beyond (a)..(g) ------------------------------------------

// The glitch-free switching sequence of brief §3.6.
static void test_h_switching_sequence() {
  startTest("h1: entering DELAY copies chip levels BEFORE raising MUX_SEL", 96, 0);
  bench::ffa2In = true;
  bench::ffb2In = false;
  runFor(20000);
  bench::log.clear();
  bench::pot = 800;
  runFor(50000);
  CHECK(core.isDelayMode(), "should be DELAY");
  int idxA = -1, idxMux = -1;
  for (size_t i = 0; i < bench::log.size(); i++) {
    if (!std::strcmp(bench::log[i].pin, "FFA2_OUT") && idxA < 0) idxA = (int)i;
    if (!std::strcmp(bench::log[i].pin, "MUX_SEL") && idxMux < 0) idxMux = (int)i;
  }
  CHECK(idxA >= 0 && idxMux > idxA, "FFA2_OUT must be set before MUX_SEL rises");
  CHECK(bench::ffa2Out == true && bench::ffb2Out == false && !bench::rst2Out,
        "outputs should mirror the chip side");
  std::printf("    order: FFA2_OUT set at log #%d, MUX_SEL raised at log #%d\n", idxA, idxMux);
  checkNoLockProblems();

  startTest("h2: MUX_SEL never changes while chip-side RST2 is high", 96, 0);
  bench::rst2In = true;           // DX is in the middle of a (long) trigger
  bench::pot = 800;
  runFor(50000);
  CHECK(!core.isDelayMode() && !bench::muxSel, "must wait while RST2 is high");
  bench::rst2In = false;
  runFor(100);
  CHECK(core.isDelayMode() && bench::muxSel, "should switch once RST2 is low");
  bench::rst2In = true;
  bench::pot = 0;
  runFor(300000);   // long enough for the pot average to reach 0
  CHECK(core.potCounts() == 0, "pot should read 0 by now");
  CHECK(core.isDelayMode() && bench::muxSel, "must not leave DELAY while RST2 is high");
  bench::rst2In = false;
  runFor(100);
  CHECK(!core.isDelayMode() && !bench::muxSel, "should leave DELAY once RST2 is low");
  std::printf("    switching waited for RST2 low in both directions\n");
  checkNoLockProblems();
}

// Pot noise must not move the delay (hysteresis).
static void test_i_pot_hysteresis() {
  startTest("i: pot noise of +/-3 counts does not change the delay", 96, 600);
  runFor(300000);
  const uint16_t before = core.potCounts();
  for (int i = 0; i < 200; i++) {
    bench::pot = (uint16_t)(600 + ((i * 5) % 7) - 3);   // 597..603
    runFor(10000);
  }
  std::printf("    accepted pot value before %u, after noise %u\n", before, core.potCounts());
  CHECK(core.potCounts() == before, "pot value moved from %u to %u", before, core.potCounts());
  bench::pot = 1023;
  runFor(300000);
  CHECK(core.potCounts() == 1023, "full CW must reach exactly 1023, got %u", core.potCounts());
  checkNoLockProblems();
}

// Hits older than 4 s are dropped; a stopped clock keeps the last tempo.
static void test_j_age_and_stop() {
  startTest("j1: very slow clock (12.5 BPM): hit waits > 4 s -> dropped", 24, 1023);
  startClock(12.5, 24);   // one beat = 4.8 s
  runFor(1000000);
  snareHit(true, true);
  runFor(6000000);
  CHECK(replayCount() == 0, "should have been dropped, got %zu replays", replayCount());
  CHECK(core.hitsDropped() == 1, "dropped=%u", (unsigned)core.hitsDropped());
  std::printf("    replays=%zu dropped=%u\n", replayCount(), (unsigned)core.hitsDropped());
  checkNoLockProblems();

  startTest("j2: clock stops (DX STOP), hand-played pad uses the last tempo (100 BPM)", 96, 1023);
  startClock(100, 96);
  runFor(300000);
  stopClock();
  runFor(3000000);
  CHECK(core.clockState() == CLOCK_STOPPED, "clock should be STOP");
  const uint32_t t0 = snareHit(true, true);
  runFor(1000000);
  CHECK(replayCount() == 1, "expected 1 replay");
  if (replayCount() == 1) CHECK_NEAR_MS(bench::replays[0].atUs - t0, 600.0, 1.0, "1 beat at 100 BPM");
  // Clock restarts at a new tempo: the pause is not mistaken for a tick period.
  startClock(150, 96);
  runFor(100000);
  CHECK(core.clockState() == CLOCK_RUNNING, "clock should be RUN again");
  CHECK(std::llabs((long long)core.averageTickPeriodUs() - 4167) <= 1,
        "period after restart %u (want 4167)", (unsigned)core.averageTickPeriodUs());
  checkNoLockProblems();
}

// Status line contents.
static void test_k_status() {
  startTest("k: status line", 96, 512);
  startClock(120, 96);
  runFor(200000);
  snareHit(true, true);
  runFor(10000);
  char status[160];
  core.formatStatus(status, sizeof status);
  std::printf("    %s\n", status);
  CHECK(std::strstr(status, "mode=DELAY"), "mode");
  CHECK(std::strstr(status, "pot=50.0%"), "pot");
  CHECK(std::strstr(status, "delay=250.2ms"), "delay");
  CHECK(std::strstr(status, "ppqn=96 (JP1 open)"), "ppqn");
  CHECK(std::strstr(status, "bpm=120.0"), "bpm");
  CHECK(std::strstr(status, "clock=RUN"), "clock");
  CHECK(std::strstr(status, "queue=1"), "queue");
  CHECK(std::strstr(status, "hits=1 replayed=0 dropped=0"), "counters");
  CHECK(std::strlen(status) < 158, "line too long for the sketch buffer");
  // The sketch postpones building this line when a replay is <= 5 ms away.
  const bool farAway = core.replayDueWithin(STATUS_GUARD_US);
  runFor(236000);   // now ~246 ms after the hit, replay due at ~250 ms
  const bool close = core.replayDueWithin(STATUS_GUARD_US);
  std::printf("    replay due within 5 ms? right after the hit: %s, 4 ms before: %s\n",
              farAway ? "yes" : "no", close ? "yes" : "no");
  CHECK(!farAway && close, "replayDueWithin");
  checkNoLockProblems();
}

int main() {
  std::printf("DX TimeShift firmware logic tests (timeshift_core.h)\n");
  std::printf("Main loop simulated every %u us. Tolerance on delays: +/-1 ms.\n",
              (unsigned)STEP_US);
  test_a_basic_half_beat();
  test_b_tempo_change();
  test_c_overlapping();
  test_d_bypass();
  test_e_no_clock();
  test_f_wraparound();
  test_g_ppqn();
  test_h_switching_sequence();
  test_i_pot_hysteresis();
  test_j_age_and_stop();
  test_k_status();
  std::printf("\n%d checks, %d failures\n", g_checks, g_failures);
  std::printf(g_failures == 0 ? "ALL TESTS PASSED\n" : "SOME TESTS FAILED\n");
  return g_failures == 0 ? 0 : 1;
}
