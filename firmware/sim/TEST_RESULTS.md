# DX TimeShift firmware logic: test results

These are the results of the PC tests in `firmware/sim/`. They run the exact logic
that goes into the Nano (`firmware/timeshift/timeshift_core.h` with the settings in
`firmware/timeshift/timeshift_config.h`) against a simulated DX: a fake microsecond clock,
fake pins and a fake DX clock generator. The main loop is simulated every 10 µs.

How to reproduce (Linux/macOS, needs g++ and make):

```
cd firmware/sim
make test
```

| Test | What it proves |
|---|---|
| a | 120 BPM, pot 50 % → replay 250 ms after the hit (±1 ms); RST2_OUT pulse ≥ 10 µs; TP_REPLAY pulses with it |
| b1–b3 | Tempo change while a hit waits: the delay follows the measured tick period (slow-down, speed-up, and speed-up past the new due time) |
| c1–c2 | Overlapping hits replay in order with their own soft/medium/loud levels; a full 32-slot queue drops (and counts) the 33rd hit |
| d1–d3 | Pot at 0 → BYPASS: MUX_SEL low, LED steady, hits counted but never replayed; 1 % threshold; turning the pot to 0 flushes the queue |
| e | No clock ever seen → 120 BPM default (500 ms at 100 %, 250 ms at 50 %), status shows `clock=NONE bpm=120.0` |
| f1–f2 | micros() wrap-around (every 71.6 min): delay and tick period correct across the wrap; a stopped clock stays STOP across the wrap |
| g0–g | PPQN jumper JP1 decoding (open=96, 1-2=48, 3-4=24) and status labels; PPQN 24/48/96 give the same musical delay (120 BPM 50 % = 250 ms, 90 BPM 100 % = 666.7 ms) and the same default tempo |
| h1–h2 | Glitch-free switching: levels copied before MUX_SEL rises; MUX_SEL never changes while RST2 is high |
| i | Pot noise of ±3 counts does not move the delay (hysteresis); full CW reaches exactly 100 % |
| j1–j2 | Hits older than 4 s are dropped; after STOP the last tempo is kept; a clock restart is not confused by the pause |
| k | Status line contents; the status text is postponed when a replay is due within 5 ms |

Every test also checks that interrupts are never left disabled or locked twice, and that
MUX_SEL never changes while either RST2 line is high.

## Output of `make test`

```
make: Entering directory '/home/jackson/repositories/sabrehagen/oberheim-dx-timeshift/firmware/sim'
./test_timeshift
DX TimeShift firmware logic tests (timeshift_core.h)
Main loop simulated every 10 us. Tolerance on delays: +/-1 ms.

[a: 120 BPM, pot 50 % -> 250 ms]
    replay delay                                         expected  250.000 ms, got  250.262 ms
    RST2_OUT high for 20 us, TP_REPLAY rose with it: yes

[b1: tempo 120 -> 60 BPM 100 ms after the hit, pot 100 %]
    1 beat at the NEW tempo (60 BPM)                     expected 1000.000 ms, got 1000.012 ms

[b2: tempo 60 -> 120 BPM 300 ms after the hit, pot 100 %]
    1 beat at the NEW tempo (120 BPM)                    expected  500.000 ms, got  500.022 ms

[b3: tempo 120 -> 200 BPM after the new delay already passed]
    fired 410.422 ms after the hit (as soon as the new tempo was measured)

[c1: 4 overlapping hits at 1 beat (500 ms), 120 BPM]
    queue length after 4 hits: 4
    hit 0 (FFA2=0 FFB2=0) delay                          expected  500.000 ms, got  500.022 ms
    hit 1 (FFA2=0 FFB2=1) delay                          expected  500.000 ms, got  499.994 ms
    hit 2 (FFA2=1 FFB2=1) delay                          expected  500.000 ms, got  499.996 ms
    hit 3 (FFA2=1 FFB2=0) delay                          expected  500.000 ms, got  499.998 ms

[c2: queue full -> 32 kept, extra hit dropped and counted]
    captured=33 queued=32 dropped=1

[d1: pot 0 -> BYPASS, hits counted but never replayed]
    5 hits captured, 0 replayed, MUX_SEL=0, LED=1

[d2: 1 % threshold: pot 10/1023 at power-up = BYPASS]

[d2: 1 % threshold: pot 11/1023 at power-up = DELAY]
    10 counts -> BYPASS, 11 counts -> DELAY

[d3: pot turned to 0 while hits are queued -> nothing replayed once in BYPASS]
    replayed during the pot ramp: 36; after BYPASS: 0; queue: 0

[e: no clock ever seen -> 120 BPM default]
    pot 100 % = 1 beat at 120 BPM                        expected  500.000 ms, got  499.972 ms
    pot 50 % = half beat at 120 BPM                      expected  250.000 ms, got  250.232 ms
    status: mode=DELAY pot=50.0% delay=250.2ms ppqn=96 (JP1 open) bpm=120.0 clock=NONE queue=0 hits=2 replayed=2 dropped=0

[f1: hit 100 ms before micros() wraps, replay after the wrap]
    hit captured at micros() = 4294867295 (wrap at 4294967295)
    replayed at micros() = 150261
    delay across wrap                                    expected  250.000 ms, got  250.262 ms

[f2: clock stopped just before the wrap is still seen as stopped]
    clock state after 5 s silence across the wrap: STOP

[g0: PPQN jumper JP1]
    JP1 open=96, 1-2=48, 3-4=24, both=96 (invalid -> default)

[g: PPQN 24 at 120 BPM pot 50 % and 90 BPM pot 100 %]
    120 BPM, 50 %                                        expected  250.000 ms, got  250.252 ms
    90 BPM, 100 %                                        expected  666.667 ms, got  666.672 ms

[g: PPQN 48 at 120 BPM pot 50 % and 90 BPM pot 100 %]
    120 BPM, 50 %                                        expected  250.000 ms, got  250.252 ms
    90 BPM, 100 %                                        expected  666.667 ms, got  666.662 ms

[g: PPQN 96 at 120 BPM pot 50 % and 90 BPM pot 100 %]
    120 BPM, 50 %                                        expected  250.000 ms, got  250.252 ms
    90 BPM, 100 %                                        expected  666.667 ms, got  666.682 ms

[h1: entering DELAY copies chip levels BEFORE raising MUX_SEL]
    order: FFA2_OUT set at log #0, MUX_SEL raised at log #1

[h2: MUX_SEL never changes while chip-side RST2 is high]
    switching waited for RST2 low in both directions

[i: pot noise of +/-3 counts does not change the delay]
    accepted pot value before 600, after noise 600

[j1: very slow clock (12.5 BPM): hit waits > 4 s -> dropped]
    replays=0 dropped=1

[j2: clock stops (DX STOP), hand-played pad uses the last tempo (100 BPM)]
    1 beat at 100 BPM                                    expected  600.000 ms, got  600.002 ms

[k: status line]
    mode=DELAY pot=50.0% delay=250.2ms ppqn=96 (JP1 open) bpm=120.0 clock=RUN queue=1 hits=1 replayed=0 dropped=0
    replay due within 5 ms? right after the hit: no, 4 ms before: yes

150 checks, 0 failures
ALL TESTS PASSED
make: Leaving directory '/home/jackson/repositories/sabrehagen/oberheim-dx-timeshift/firmware/sim'
```
