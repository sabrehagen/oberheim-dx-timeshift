# 05. Bench verification: every open question

**Where you are in the process:** reference for the whole job. Q0, Q1, Q3 and Q6 are answered
before ordering parts (steps 2 to 5 in [00-start-here.md](00-start-here.md)). Q2 and Q5 are best
answered on the stock DX before building (step 6). The rest are answered during installation and
testing (steps 12 and 13).

> **You will need**
>
> * Multimeter, digital calipers, steel rule, modelling clay, torch
> * Logic analyser (4 MHz or faster, 4 or more channels) and a Pomona 3916A DIP-16 test clip
> * Oscilloscope, 100 MHz or faster, with a short ground lead (for Q4)
> * A camera
> * This document printed, to fill in the form in section 3

The design was finished from schematics, photos and a disassembly of the original firmware. Some
facts could not be confirmed that way. This document lists all of them in one place: from
[research/dx-findings.md](research/dx-findings.md) (Q0 to Q10, section i), and from the READMEs in
[hardware/](../hardware/README.md), [hardware/mechanical/](../hardware/mechanical/README.md) and
[firmware/](../firmware/README.md) (items M1 to M5). For each one you get: why it matters, how to
measure it, what we expect, and what to change if the result is different.

**Safety for every measurement:** read [03-install-in-the-dx.md](03-install-in-the-dx.md) section 1
first. Measurements with the DX powered are made with the lid open; keep away from the transformer,
fuse and line filter on the right-hand side.

## 1. Summary

| ID | Question | When | Blocks |
|---|---|---|---|
| Q0 | Which model, board and firmware? | Before ordering | Everything |
| Q1 | Is U701 socketed? | Before ordering | Reversibility |
| Q2 | What do RST2, FFA2, FFB2 and GEN0* really look like? | Before building (recommended) | Replay timing, loudness |
| Q3 | Free height under the lid, other boards in the way | Before ordering | Board position, ribbon length |
| Q4 | Is GEN0* clean through the ribbon? | During testing | Bass and snare reliability |
| Q5 | Clock tap at R791: polarity, width, rate, present when stopped? | Before building (recommended) | Tempo |
| Q6 | Room behind the rear panel, panel thickness, shaft type | Before drilling | Pot position |
| Q7 | +5 V headroom through U701 pins 16 and 8 | During testing | Supply |
| Q8 | Firmware versions not analysed | With Q2 | Replay timing |
| Q9 | Behaviour at stop and start, large delays | During testing | Musical behaviour only |
| Q10 | Loudness of overlapping delayed snares | During testing | Musical behaviour only |
| M1 | Ribbon and DIP plug mapping | After making the cable (mandatory) | First power-up |
| M2 | DIP plug orientation in the DX socket | After fitting (mandatory) | First power-up |
| M3 | A ground point for the clock lead (Q709 emitter leg) | During installation | Clock noise |
| M4 | Four flat, clear spots for the adhesive supports | Before ordering | Board position |
| M5 | RST2 level after power-up | With Q2 | Entering DELAY after power-on |

## 2. The questions

### Q0. Which model, board and firmware?

* **Why it matters.** The pin numbers are for the plain DX (board 1721A). On a DXa (board 1906) the
  snare lines are on **U715 pins 7 (RST2), 5 (FFA2) and 2 (FFB2)**, not U701 pins 15, 12 and 10. A
  rev A board in a DXa would do nothing useful, or would disturb other signals. The firmware version
  sets the RST2 pulse width (Q2, Q8). Extra boards can take the space the TimeShift needs (Q3).
* **How to measure.** Mains unplugged. Open the lid (two front screws). Photograph the whole main
  board. Read the title silkscreen at the bottom centre. Read the marking on U701 and the labels on
  U713 and U714 (for example "DX 1.4 A" and "DX 1.4 B"). Check the rear and the end panels for MIDI
  jacks. Note any DX SYNC-TO-TAPE board (1760B), Electrongate MIDI board or Stretch ribbons. On a
  Stretch or MIDI-upgraded unit, check by eye that U701 is still on the main board (INFERRED that
  these products leave it alone).
* **Expected.** "OBERHEIM DX PROCESSOR BOARD" (1721A). U701 marked MC14174B (or CD40174 or 74C174).
  ROM labels "DX 1.x". No MIDI jacks, unless a MIDI upgrade is fitted.
* **If different.**
  * **DXa (1906):** do not install rev A. A re-mapped board is needed: intercept U715 pins 7, 5 and 2,
    pass through pins 1, 3, 4, 6 and 8 to 16 (pin 9 is GEN2* on the DXa). That is a change to the
    J1/U1 pin assignment in `hardware/kicad/tools/netlist.py` and a rebuild (hardware/README.md
    section 3). On the DXa, FFA2 and FFB2 drive the level diodes directly (no U204 flip-flops), so
    the capture and replay scheme still fits. DXa logic chips may be soldered rather than socketed
    (INFERRED from one photo), which makes Q1 more likely to fail.
  * **Electrongate MIDI firmware 3.01, or DXa firmware 2.02:** not analysed. Do Q2 carefully.
    Also set JP1 to match edit parameter 03 (24, 48 or 96), or set parameter 03 to 96.

### Q1. Is U701 in a socket?

* **Why it matters.** The mod is reversible only if U701 can be unplugged.
* **How to measure.** Shine a torch along both sides of U701. A socket shows a black plastic frame
  under the chip, the legs enter metal contacts and there are no solder fillets on top. To confirm,
  lever the chip up about 0.5 mm at each end with a small flat screwdriver between chip and socket,
  then press it back.
* **Expected.** Socketed. (INFERRED from photos of two DX units.)
* **If different.** Stop and ask the owner. The only route is to desolder U701 and fit a DIP-16
  socket (TE 1-2199298-4, section D of [bom.md](bom.md)). This is permanent but restorable. Get the
  owner's agreement in writing first.

### Q2. The real trigger waveforms on U701

* **Why it matters.** The firmware replays RST2, FFA2 and FFB2 as the DX firmware writes them. If
  the real pulse width, edge order or level code differs from the analysis, the replay could be
  wrong or the loudness could change.
* **How to measure.** On the **stock** DX (before fitting the TimeShift), with the Pomona 3916A
  clip on U701 and the chip in place. Logic analyser at 4 MHz or faster. Channels: **pin 9**
  (GEN0*), **pin 15** (RST2), **pin 12** (FFA2), **pin 10** (FFB2), and **pin 2** (RST1, bass) for
  reference. Ground to pin 8. Record:
  1. (a) SNARE SOFT, MEDIUM and LOUD pads, three times each.
  2. (b) A pattern with bass and snare on the same step.
  3. (c) Bass alone.
  4. (d) Long RST2 highs: leave the analyser recording through power-up, pattern start and stop,
     and pressing STOP in the middle of a sounding snare. Look for **any RST2 high time longer
     than 1 ms**. The DX might hold RST2 high on purpose to keep the snare silent. Record when it
     happens and how long it lasts.
  (With the TimeShift fitted, the same signals are at U1 pins 9, 15, 12, 10 and 2 on the TimeShift
  board, and TP2 is RST2.)
* **Expected.**
  * Three GEN0* pulses per trigger. GEN0* low for about 1 µs (INFERRED).
  * FFA2/FFB2 change at the first pulse, RST2 rises at the second and falls at the third.
  * RST2 high for about **9 µs** (firmware 1.5) to about **0.2 ms** (firmware 1.20). VERIFIED by
    firmware analysis, TBC here.
  * Levels at the RST2 rising edge (INFERRED): LOUD FFA2 = 1, FFB2 = 1. MEDIUM FFA2 = 0, FFB2 = 1.
    SOFT FFB2 = 0 (FFA2 either).
  * (c) Bass alone: **no** edges on pins 10, 12 or 15.
  * (d) No RST2 high longer than 1 ms during normal playing. A long high at power-up is possible
    (see M5).
* **If different.**
  * **RST2 width outside 9 µs to 0.2 ms:** the capture still works (the AVR stores the edge in
    hardware). If you want the replay to match, change `RST2_PULSE_US` in
    `firmware/timeshift/timeshift_config.h` (keep it between 10 and 200 µs) and reflash.
  * **FFA2/FFB2 change after RST2 rises** (different edge order): the firmware reads the levels at
    the RST2 rising edge, so it would store the old levels. The firmware would need to read them at
    the RST2 falling edge instead (a code change in `timeshift_core.h` and `timeshift.ino`).
  * **RST2 held high for longer than 1 ms** (reviewer finding m-4): the firmware treats every RST2
    rising edge as a normal hit and replays it as a 20 µs pulse. A long "hold silent" high would
    therefore be replayed as a short hit, and the snare would sound when the DX meant it to be
    silent. The firmware would need a change (a constant and logic to recognise and replay long
    highs). Record the times and report it before using DELAY mode.
  * **Edges on the snare lines during bass-only writes:** each RST2 rising edge would be stored as
    a hit. A firmware filter would be needed. Report it before using the mod.
  * **A different level code:** no change needed. The levels are copied bit for bit. Update the table
    in [01-theory-of-operation.md](01-theory-of-operation.md) section 2.3.

### Q3. Free height under the lid, and other boards in the way

* **Why it matters.** It decides where the board can go and how long the ribbon must be. The board
  with the Nano on its headers needs about **32 mm** of height on its 12.7 mm supports
  ([hardware/mechanical/README.md](../hardware/mechanical/README.md)). A stacked "Option A" adapter
  directly on U701 is not part of rev A.
* **How to measure.** Roll a column of modelling clay about 40 mm tall (a 10 mm ball, as in the
  findings, only proves 10 mm). Stand it on a slip of paper at the planned board position (ZONE A on
  the wiring diagram) and close the lid gently. Open it and measure the squashed height. Repeat on top
  of U701. Photograph any boards above or next to U701 and ZONE A.
* **Expected.** Unknown. The only clue (INFERRED): the Electrongate MIDI board stands about 22 mm
  above the board in the CPU area with the lid closed, so some areas have at least about 25 mm.
* **If different (less than 32 mm in ZONE A).**
  * Try ZONE B (front right, near R791). That needs a 20 to 25 cm ribbon, so do Q4 first.
  * Lower supports: the 10 mm M3 nylon standoffs in section D of [bom.md](bom.md) save about 2.7 mm,
    but need a mounting point.
  * The findings also suggest the inside of the rear panel as a possible mounting area (not designed
    for in rev A; check the space).
  * If nothing fits, a lower-profile board (rev B) is needed.

### Q4. Is GEN0* clean through the ribbon?

* **Why it matters.** GEN0* clocks U701 on its rising edge. With the TimeShift fitted it runs from
  the DX through the ribbon to U701 in U1. Ringing could clock U701 twice and corrupt **bass** and
  snare triggers.
* **How to measure.** TimeShift fitted, pot at 0 (BYPASS). Scope at **U1 pin 9** on the TimeShift
  board (the chip side), 100 MHz or faster, short ground lead to TP4. Look at the rising edges. Then
  run a busy pattern with bass and snare for 10 minutes and listen for missing or extra hits.
* **Also check for crosstalk in the ribbon** (reviewer note). The bass trigger **RST1 (DIP pin 2,
  ribbon conductor 3)** runs right next to the snare trigger on the plug side, **RST2 (DIP pin 15,
  ribbon conductor 4)**. Put a second channel on **U1 pin 2** (RST1) and trigger the scope on
  **TP3** (RST2 plug side). Fire snares, in BYPASS and in DELAY, and look at RST1 at each RST2 edge.
* **Expected.** Clean edges that cross 2.5 V once, with no ringing back across 2.5 V. No missing or
  extra hits. No glitch on RST1 when the snare fires.
* **If different.** Shorten the ribbon (never longer than 15 cm without this check passing). Route
  it away from other cables. A glitch on RST1 when the snare fires is crosstalk between conductors 3
  and 4; a shorter ribbon reduces it. If it is still not clean, GEN0* must be re-buffered on the TimeShift
  board with a 74HC14 (the findings' suggestion). That is a rev B board change.

### Q5. The clock tap at R791

* **Why it matters.** The delay is set in beats using the measured tick period.
* **How to measure.** Scope or logic analyser on the R791 lead on the Q709-collector side (the lead
  with 0 Ω to the CLOCK OUT jack tip when the DX is off). With the TimeShift fitted, TP5 shows the
  same signal after conditioning. Record: (1) DX stopped; (2) playing at 120 BPM; (3) whether pulses
  continue when stopped; (4) the pulse width and polarity. On a DXa, Stretch or MIDI-upgraded DX,
  also note edit parameter 03 (clock out rate).
* **Expected.** Idles **low**, 0/5 V. A **rising edge every 5.21 ms at 120 BPM** (96 PPQN). High for
  about 0.85 ms or more. The rate (96 PPQN) is VERIFIED; the polarity and width are from the firmware
  analysis (TBC). Whether pulses continue when stopped is unknown.
* **If different.**
  * **Opposite polarity:** no change needed for the delay, because only the time between ticks is
    used. If you want rising edges anyway, the edge is set in `attachInterrupt(..., onClockTick,
    RISING)` in `firmware/timeshift/timeshift.ino`.
  * **No pulses when stopped:** nothing to change. The firmware keeps the last tempo (`clock=STOP`).
  * **Different rate (48 or 24):** set JP1 to match (see [04-test-and-calibrate.md](04-test-and-calibrate.md)
    section 8), or set parameter 03 to 96.
  * **No pulses at R791 at all:** recheck the part references. The alternative tap is R792 on the
    U710 side (signal COUT, opposite polarity, falling edge = tick).
  * **Extra edges or noise:** check C7 and the lead routing. `MIN_TICK_PERIOD_US` (1 ms) in
    `timeshift_config.h` already ignores ticks closer than 1 ms.

### Q6. Room behind the rear panel

* **Why it matters.** Drilling is the one permanent change. The tuning-pot board, its screws and
  the board-mounted jacks are all close to the candidate hole.
* **How to measure.** Follow the 14-item checklist in
  [03-install-in-the-dx.md](03-install-in-the-dx.md) section 10.1 (the same as
  [hardware/mechanical/README.md](../hardware/mechanical/README.md)). Also measure the existing
  tuning shafts (diameter, knurled or slotted, length) and the panel thickness at a jack hole.
* **Expected.** Panel 3.6 mm thick or less. At least **25 mm** free depth behind the hole and
  **12 mm** free radius around it. A free band behind the panel tall enough for the 17 mm pot body.
  All defaults in the template are photo estimates (about ±3 mm).
* **If different.** Move the hole sideways with `new_hole_right_of_snare_mm`, or use the second
  candidate position to the right of the BASS pot. If the band is under about 19 mm, use a 9 mm-class
  pot with a threaded bushing and change the `pot` block in `panel_measurements.json`, then
  regenerate. Never drill while the template says "DO NOT DRILL".

### Q7. +5 V headroom

* **Why it matters.** The board takes its power through U701 socket pins 16 and 8. Too much voltage
  drop or a weak DX supply could upset the DX logic.
* **How to measure.** TimeShift running, DX playing a dense pattern. Measure +5 V at the DX
  "+5 TEST PAD" and at U701 pin 16 (on the TimeShift board: C1 + to TP4). Optionally scope the lowest
  point of the ripple on C723 (+), the unregulated supply.
* **Expected.** Both 4.85 V or more. Difference less than **50 mV**. The ripple minimum on C723 stays
  at least 3 V above the +5 V output at the lowest mains voltage you expect.
* **If different.**
  * **Drop of 50 mV or more:** add a separate 2-wire power lead from the DX "+5 TEST PAD" and ground
    to the TimeShift board. Rev A has no power header for this; the wires would be soldered to C1's
    leads. Discuss this with the owner, and list it as a rev B change (a power header).
  * **+5 V low on the DX itself:** that is a DX power-supply service matter (the +5 V is set by
    trimmer T701, DX schematic sheet 3), outside this project.

### Q8. Firmware versions not analysed

* **Why it matters.** Only firmware 1.20 and 1.5 were analysed. The photo of one DX shows 1.4. The
  Electrongate MIDI upgrade uses 3.01. The DXa uses 2.02.
* **How to measure.** Covered by Q2, on your unit.
* **Expected.** The findings recommend that the TimeShift tolerate RST2 high times from 1 µs to
  5 ms and any FFA/FFB order. The firmware captures on the RST2 rising edge only, so the width does
  not affect capture. The edge-order caveat in Q2 applies.
* **If different.** As Q2.

### Q9. Stop, start and large delays

* **Why it matters.** Musical behaviour only, no risk of damage.
* **How to measure.** [04-test-and-calibrate.md](04-test-and-calibrate.md) section 6.5.
* **Expected.** Snares queued before STOP still play after STOP. At delays close to 1 beat, a delayed
  snare can land on the next snare and cut it off (or be cut off).
* **If different / if the owner dislikes it.** The findings suggest a firmware option: drop the
  queue when no clock tick has been seen for more than 125 ms (the DX's own auto-stop time). Rev A
  firmware does not do this; it would be a code change.

### Q10. Loudness of overlapping delayed snares

* **Why it matters.** On the DX (1721A), FFA2 and FFB2 also act as resets while they are high. A
  level change could affect a delayed snare that is still sounding.
* **How to measure.** By ear: SOFT then LOUD snares one 16th apart, pot at 1 beat, compared with
  BYPASS ([04-test-and-calibrate.md](04-test-and-calibrate.md) section 6.3).
* **Expected.** Identical to BYPASS, only later, because the full three-wire history is replayed.
* **If different.** Record it with a logic analyser on U3 pins 4, 7 and 9 and compare with U1 pins
  15, 12 and 10. Report it before changing anything.

### M1. Ribbon and DIP plug mapping (from hardware/README.md)

* **Why it matters.** A wrong cable puts signals, or +5 V, on the wrong DX pins.
* **How to measure.** Continuity tests A to D in [02-build-the-board.md](02-build-the-board.md)
  section 6 (and the sheet `hardware/mechanical/dip-plug-mapping.pdf`).
* **Expected.** Conductor 1 to DIP 1, 2 to 16, 3 to 2, 4 to 15, 5 to 3, 6 to 14, 7 to 4, 8 to 13,
  9 to 5, 10 to 12, 11 to 6, 12 to 11, 13 to 7, 14 to 10, 15 to 8, 16 to 9.
* **If different.** Make a new cable with a standard DIP-16 IDC plug. Do not try to rewire the
  mapping by hand.

### M2. DIP plug orientation in the DX socket

* **Why it matters.** A plug turned 180° puts the DX +5 V onto the TimeShift ground and the DX
  ground onto the TimeShift +5 V. That would destroy the original U701 chip, U3, U4 and the Nano.
  The cable tests cannot catch this.
* **How to measure.** The four resistance checks in [03-install-in-the-dx.md](03-install-in-the-dx.md)
  section 8.1, DX unplugged.
* **Expected.** TP4 to U702 pin 8 under 1 Ω. C1 + to U702 pin 16 under 1 Ω. TP4 to U702 pin 16 not
  near 0 Ω. U1 pin 1 to C1 + under 1 Ω.
* **If different.** Do not power up. Pull the plug, check the pin 1 marks, refit, measure again.

### M3. A ground point for the clock lead

* **Why it matters.** The clock lead's ground wire is optional, but if used it must go to real DX
  ground. The web walkthrough suggests the Q709 emitter; the schematic shows the emitter is grounded,
  but which leg of Q709 is the emitter on the board is TBC.
* **How to measure.** DX unplugged. Meter on resistance: the candidate point to U702 pin 8 (or to
  TP4 with the TimeShift fitted).
* **Expected.** Less than 1 Ω.
* **If different.** Use another point that passes, or leave the ground wire unconnected and insulated.

### M4. Four clear spots for the adhesive supports

* **Why it matters.** The self-adhesive supports need flat, clean, component-free spots on the DX
  board at the four corners of the 84 × 63 mm board (holes on 77 × 56 mm centres), and the tallest
  DX part under the board must clear its underside.
* **How to measure.** Hold the board (or a card template of the same size) in ZONE A and look.
* **Expected.** Unknown (the DX positions on the wiring diagram are scaled from the parts layout,
  about ±3 mm).
* **If different.** Shift the board within the zone, use the M3 standoff alternative with a bracket,
  or use ZONE B (after Q4).

### M5. RST2 level after power-up

* **Why it matters.** At power-up the DX firmware writes 09h to U701, which holds RST2 high
  (VERIFIED, firmware 1.20). If RST2 stays high until the first snare, the TimeShift cannot switch
  into DELAY until then, because it never switches while RST2 is high. The first snare after
  power-on would then play undelayed. (INFERRED from the firmware and the switching rule.)
* **How to measure.** After power-on, before playing any snare, measure TP2 (or U701 pin 15 on the
  stock DX). Then do [04-test-and-calibrate.md](04-test-and-calibrate.md) section 6.5 step 3.
* **Expected.** Unknown.
* **If different / if confirmed.** Harmless. Document it for the owner. A firmware change could
  allow the first switch while RST2 is held high from power-up, but that needs care and testing.

## 3. Results form

Fill this in by hand. Give a copy to the owner and keep one with the DX.

**Unit and technician**

| Item | Value |
|---|---|
| DX serial number | |
| Main board title and drawing number (Q0) | |
| U701 marking (Q0) | |
| ROM labels U713 / U714 (Q0, Q8) | |
| MIDI jacks? Stretch? SYNC-TO-TAPE 1760B? Electrongate MIDI board? (Q0, Q3) | |
| Technician | |
| Date | |

**Measurements**

| ID | Measurement | Expected | Result | Pass / fail | Initials |
|---|---|---|---|---|---|
| Q1 | U701 socketed? | Yes | | | |
| Q2 | GEN0* pulses per snare trigger | 3 | | | |
| Q2 | GEN0* low time | about 1 µs | ______ µs | | |
| Q2 | RST2 high time | 9 µs to 0.2 ms | ______ | | |
| Q2 | Order: FFA2/FFB2 change before RST2 rises? | Yes | | | |
| Q2 | SOFT: FFA2 / FFB2 at RST2 rising edge | x / 0 | ____ / ____ | | |
| Q2 | MEDIUM: FFA2 / FFB2 | 0 / 1 | ____ / ____ | | |
| Q2 | LOUD: FFA2 / FFB2 | 1 / 1 | ____ / ____ | | |
| Q2 | Edges on pins 10/12/15 during bass-only writes? | None | | | |
| Q2 | Any RST2 high longer than 1 ms? When, and how long? | None in normal playing | | | |
| Q3 | Free height at the board position, lid closed | 32 mm or more | ______ mm | | |
| Q3 | Free height above U701, lid closed | (record) | ______ mm | | |
| Q4 | GEN0* at U1 pin 9: clean edges? | Yes | | | |
| Q4 | 10-minute busy pattern: missing or extra hits? | None | | | |
| Q4 | Glitch on RST1 (U1 pin 2) when RST2 (TP3) fires? | None | | | |
| Q5 | Clock at R791 (Q709 side): idle level | Low (0 V) | | | |
| Q5 | Clock: active edge | Rising | | | |
| Q5 | Clock period at 120 BPM | 5.21 ms | ______ ms | | |
| Q5 | Clock high time | about 0.85 ms or more | ______ ms | | |
| Q5 | Clock present while stopped? | (record) | | | |
| Q5 | Edit parameter 03 (DXa, Stretch, MIDI units only) | 96 | | | |
| Q6 | HI-HAT to SNARE pitch | (record) | ______ mm | | |
| Q6 | SNARE to BASS pitch | (record) | ______ mm | | |
| Q6 | Tuning shaft diameter / type / length | (record) | ______ | | |
| Q6 | Panel thickness | 3.6 mm or less | ______ mm | | |
| Q6 | Tuning-pot board bottom below SNARE centre | (record) | ______ mm | | |
| Q6 | Jack body top below SNARE centre | (record) | ______ mm | | |
| Q6 | Free depth behind the hole | 25 mm or more | ______ mm | | |
| Q6 | Free radius around the hole | 12 mm or more | ______ mm | | |
| Q6 | Chosen hole: below SNARE / right of SNARE | (record) | ______ / ______ mm | | |
| Q6 | Template STATUS line before drilling | "generated from measured values" | | | |
| Q7 | +5 V at the DX "+5 TEST PAD" | 4.85 V or more | ______ V | | |
| Q7 | +5 V at U701 pin 16 (C1 + to TP4) | 4.85 V or more | ______ V | | |
| Q7 | Difference | less than 50 mV | ______ mV | | |
| Q7 | C723 ripple minimum above +5 V output | 3 V or more | ______ V | | |
| Q9 | Snares after STOP | Play (expected) | | | |
| Q10 | SOFT then LOUD, 1 beat delay, same as BYPASS? | Yes | | | |
| M1 | Continuity tests A, B, C, D | All pass | | | |
| M2 | Reversed-plug checks (4 readings) | All pass | | | |
| M3 | Clock ground point to U702 pin 8 | under 1 Ω (or not used) | ______ Ω | | |
| M4 | Four clear support spots found? | Yes | | | |
| M5 | TP2 level after power-up, before any snare | (record) | | | |

**Notes and photos taken**

&nbsp;

&nbsp;

&nbsp;
