# 04. Test and calibrate

**Where you are in the process:** step 13 of the order of work in
[00-start-here.md](00-start-here.md). The TimeShift board is installed in the DX
([03-install-in-the-dx.md](03-install-in-the-dx.md)) and the close-up checklist at the end of that
document is complete. This document also explains how to remove the mod.

> **You will need**
>
> * The DX with the TimeShift board installed, lid open and supported
> * Multimeter
> * Oscilloscope (2 channels or more) or logic analyser (4 MHz or faster)
> * A computer with the Arduino IDE (Serial Monitor) and a USB-A to Mini-B cable
> * Headphones or a monitor speaker on the DX outputs
> * A pencil, to fill in the tables in this document

There is no adjustment to make on the board itself. "Calibration" here means confirming that the
measured tempo and delay match what the DX is doing.

> **STOP AND CHECK**
> **Working with the lid open and the mains connected.** The mains transformer, fuse and line
> filter are on the right-hand side of the case. Keep your hands and probes away from that area.
> Clip probes on with the DX switched off where you can, then switch on.

> **STOP AND CHECK**
> **USB rule.** Switch the DX **on first**, then plug USB into the Nano. Unplug USB **before** you
> switch the DX off. Never connect USB while the DX is off.

## 1. Record of the checks before power

Copy the results here from the earlier steps. Do not power the DX until every line says "pass".

| Check | Where it is described | Result (pass / fail) | Initials, date |
|---|---|---|---|
| Continuity test A: cable alone | [02-build-the-board.md](02-build-the-board.md) section 6 | | |
| Continuity test B: 13 straight-through pins | 02 section 6 | | |
| Continuity test C: 3 intercepted pins go to U3 pins 4, 7, 9 and not to U1 | 02 section 6 | | |
| Continuity test D: no short +5 V to GND, DIP 1 not joined to DIP 16 on the bench | 02 section 6 | | |
| Bench self-test, checks 1 to 12 | 02 section 8 | | |
| Reversed-plug check: TP4 to U702 pin 8 under 1 Ω | [03-install-in-the-dx.md](03-install-in-the-dx.md) section 8.1 | | |
| Reversed-plug check: C1 + to U702 pin 16 under 1 Ω | 03 section 8.1 | | |
| Reversed-plug check: TP4 to U702 pin 16 not near 0 Ω | 03 section 8.1 | | |
| Reversed-plug check: U1 pin 1 to C1 + under 1 Ω | 03 section 8.1 | | |
| Close-up checklist | 03 section 13 | | |

## 2. First power-on (pot at zero)

1. Check the SNARE DELAY pot is **fully anticlockwise**.
2. Check **no USB cable** is in the Nano.
3. Connect the mains cable. Have your hand on the power switch.
4. Switch the DX on.
5. **Within 2 seconds:** the DX display must come up as it normally does. If it does not, or you
   see smoke, smell anything hot or hear anything unusual, **switch off at once** and unplug.
   Go to section 9.
6. After about 30 seconds, switch off and unplug. Touch U1, U3, U4 and the Nano with a fingertip.
   None of them should feel warm. If anything is warm, stop and go to section 9.
7. Switch on again. Look at the Nano's "L" LED: it should be **on steady** (BYPASS).
8. Play every pad: BASS, SNARE, HI-HAT, TOMS, PERC, CYMBAL, at SOFT, MEDIUM and LOUD where the
   pads offer it. Then play a stored pattern that uses every voice.
9. **Expect stock behaviour.** Every voice, including the bass (which shares U701), must sound and
   behave exactly as before. The snare must be on time.

If anything is different from stock with the pot at zero, switch off and go to section 9. In
BYPASS the only part between U701 and the DX is the 74HC157, so a difference here points to the
cable, the plug or the board, not the firmware.

## 3. Supply check (Q7)

With the DX playing a busy pattern:

| Measure | Expected | Measured |
|---|---|---|
| TimeShift C1 + lead to TP4 | 4.85 V or more | ______ V |
| DX "+5 TEST PAD" (or U702 pin 16) to DX ground (U702 pin 8) | 4.85 V or more | ______ V |
| Difference between the two | less than 50 mV | ______ mV |

If the difference is 50 mV or more, see Q7 in [05-bench-verification.md](05-bench-verification.md).

## 4. Signals at the test points

The test points are on the TimeShift board (see the assembly diagram in
[02-build-the-board.md](02-build-the-board.md) section 3). Use **TP4** for the probe ground.

| Test point | Signal | Expected in BYPASS (pot at 0) | Expected in DELAY (pot above 1 %) | Status of the expectation |
|---|---|---|---|---|
| **TP2** | RST2 from the original U701 (chip side, U1 pin 15) | One positive pulse per snare hit, high for about **9 µs** (firmware 1.5) to about **0.2 ms** (firmware 1.20) | The same | Pulse width TBC (Q2). After power-up RST2 may sit high until the first snare is played (INFERRED from the firmware's power-up write, TBC). |
| **TP3** | RST2 to the DX snare (plug side, U3 pin 4, DIP 15) | An exact copy of TP2, at the same moment | A **20 µs** pulse, later than the TP2 pulse by the delay. Nothing at the moment of the TP2 pulse. | 20 µs is set by the firmware (`RST2_PULSE_US`) |
| **TP1** | REPLAY marker (Nano D12) | No pulses | A short high pulse at the same moment as each TP3 pulse | Firmware |
| **TP5** | Conditioned clock (Nano D3) | Rising edge every **5.21 ms** at 120 BPM (96 PPQN). High for roughly **0.85 ms or more**. Same polarity as R791. | The same | Period VERIFIED (96 PPQN). Pulse width and polarity TBC (Q5). Whether it runs while the sequencer is stopped: TBC (Q5). |
| **TP4** | Ground | 0 V | 0 V | |
| U3 pin 1 | MUX_SEL (Nano D9) | About 0 V | About 5 V | |
| U3 pin 7, U3 pin 9 | FFA2 and FFB2 to the DX (DIP 12, DIP 10) | Follow U1 pins 12 and 10 at once | Change only when a delayed hit is replayed, then held | Level code TBC (Q2) |

**Measuring the delay.** Put channel 1 on TP2 and channel 2 on TP1, and trigger on channel 1. The
time from the TP2 rising edge to the TP1 rising edge is the delay.

**Recording the stock waveforms (Q2).** If you have not yet recorded RST2, FFA2 and FFB2 on the stock
DX, do it now with the pot at zero: TP2 is RST2, U1 pin 12 is FFA2, U1 pin 10 is FFB2, U1 pin 9 is
GEN0*. The exact procedure and what to record is in
[05-bench-verification.md](05-bench-verification.md), Q2.

## 5. Serial line and tempo check

1. With the DX **on**, plug USB into the Nano. Open the Serial Monitor at **115200 baud**.
   (The computer's ground is now joined to the DX ground. You may hear a little hum on the outputs
   while USB is connected. Unplug USB when you are done.)
2. You see one status line per second, for example:

```
mode=DELAY pot=50.0% delay=250.2ms ppqn=96 bpm=120.0 clock=RUN queue=1 hits=12 replayed=11 dropped=0
```

The meaning of every field is in [firmware/README.md](../firmware/README.md) section 7.

3. Run a pattern at each tempo below and compare `bpm` with the DX tempo display. They should agree
   to within about 0.5 BPM.

| DX tempo display | `bpm` on the serial line | `clock` | OK? |
|---|---|---|---|
| 60 | | RUN | |
| 120 | | RUN | |
| 200 | | RUN | |

4. Press STOP. Note what `clock` shows after 3 seconds: `STOP` means the DX stops sending clock ticks
   when stopped; `RUN` means it keeps sending them. This answers part of Q5. Write it down.

If `bpm` is 2 or 4 times too high or too low, the PPQN jumper does not match the DX (section 8).

## 6. Delay tests

### 6.1 Knob sweep

1. Set the DX to **120 BPM**. Program or choose a pattern with a snare on beats 2 and 4.
2. Scope: channel 1 on TP2, channel 2 on TP1.
3. For each pot position, read the serial `delay=` value and measure TP2 to TP1 on the scope.

| Pot (serial `pot=`) | Expected at 120 BPM | Serial `delay=` | Measured TP2 to TP1 | LED |
|---|---|---|---|---|
| 0 % (fully anticlockwise) | 0 (BYPASS) | 0.0 ms | (no TP1 pulse) | steady on |
| about 1 % | BYPASS or a few ms | | | |
| 25 % | about 125 ms | | | flash per snare |
| 50 % (half way) | about **250 ms** | | | flash per snare |
| 75 % | about 375 ms | | | flash per snare |
| 100 % (fully clockwise) | **500 ms** (exactly 1 beat) | | | flash per snare |

4. Change the tempo to **90 BPM** and check: half way about **333 ms**, full **667 ms**.
5. Listen: at 50 % the snare should land half a beat late (on the "and" after beats 2 and 4). At
   100 % it lands exactly on the next beat.
6. While a pattern plays, change the tempo up and down. The delay in beats must stay the same.

### 6.2 Loudness

1. Pot at 0. Play the SNARE pad at SOFT, MEDIUM and LOUD. Listen.
2. Pot at 50 %. Play the same three. Each delayed snare must have the same loudness as in BYPASS.
3. With a scope on U3 pin 7 (FFA2 to the DX) and U3 pin 9 (FFB2 to the DX), check that the
   delayed levels match the levels on U1 pins 12 and 10 at the original hit.

### 6.3 Overlap (fast snare pattern)

1. Program a snare on every 16th note at 120 BPM (one every 125 ms). Pot fully clockwise (1 beat).
2. Watch the serial line: `queue` should sit around 4, `replayed` should follow `hits`, and
   `dropped` must stay **0**.
3. Listen: the same 16th-note pattern, one beat later, with no missing or extra hits.
4. Q10: program a SOFT snare and a LOUD snare one 16th apart. At 1-beat delay, compare by ear with
   BYPASS. They should sound the same, only later.

### 6.4 Return to bypass

1. Play a pattern with the pot at 50 %.
2. Turn the pot quickly to fully anticlockwise.
3. Expect: the LED goes steady, `mode=BYPASS`, and the snare is back on time. A snare that was
   waiting at the moment of switching is not played. There must be no double hits, no stuck
   snare and no click.
4. Turn the pot up again. The delay must come back.

### 6.5 Stop, start and no clock

1. Pot at 100 %. Press STOP just after a snare. The last snare(s) still play, up to one beat after
   STOP. This is expected.
2. With the sequencer stopped, play the SNARE pad by hand with the pot at 50 %. The delay is half a
   beat at the last measured tempo, or at 120 BPM (250 ms) if no clock has been seen since power-up.
3. Switch the DX off and on with the pot already at 50 %. Play the snare pad. If the first snare
   after power-up comes out undelayed and the following ones are delayed, write it down: that is
   the "RST2 high after power-up" behaviour listed in section 4 (TBC).

### 6.6 Bass and GEN0* check (Q4)

1. Run a busy pattern with bass and snare on the same steps for **10 minutes**, first in BYPASS,
   then with the pot at 50 %.
2. Listen for missing or extra **bass** hits. The bass shares U701, and its write strobe (GEN0*)
   now runs through the ribbon.
3. With a scope (100 MHz or faster, short ground lead), look at **U1 pin 9** (GEN0* at the chip on
   the TimeShift board). The edges must be clean, with no ringing back across 2.5 V.
4. Put a second channel on U1 pin 2 (RST1, bass) and trigger on TP3. When the snare fires there
   must be no glitch on RST1. (RST1 and RST2 run on neighbouring ribbon conductors; see Q4 in
   [05-bench-verification.md](05-bench-verification.md).)

## 7. Results summary

| Test | Pass / fail | Notes |
|---|---|---|
| Stock behaviour with pot at 0 (section 2) | | |
| Supply (section 3) | | |
| Tempo matches display (section 5) | | |
| Knob sweep 120 BPM (6.1) | | |
| Knob sweep 90 BPM (6.1) | | |
| Loudness preserved (6.2) | | |
| Overlap, `dropped` = 0 (6.3) | | |
| Return to bypass (6.4) | | |
| Stop and no-clock behaviour (6.5) | | |
| Bass and GEN0* (6.6) | | |

Copy the answers to the open questions into the form in
[05-bench-verification.md](05-bench-verification.md).

## 8. PPQN jumper JP1

The plain DX always sends **96** clock ticks per beat, so JP1 stays open (shunt parked on one pin).
Only a DXa, Stretch DX or MIDI-upgraded DX can be set to 48 or 24 (edit parameter 03). The firmware
reads JP1 **once at power-up**: after moving the shunt, switch the DX off and on again.

| JP1 1-2 (Nano D10) | JP1 3-4 (Nano D11) | PPQN | Use when |
|---|---|---|---|
| open | open | **96** | Plain DX (default), or any DX with parameter 03 = 96 |
| closed | open | 48 | DX clock out set to 48 (parameter 03 = 48) |
| open | closed | 24 | DX clock out set to 24, or slaved to MIDI clock |
| closed | closed | 96 | Not valid. The firmware uses 96 and prints a warning. |

The silkscreen next to JP1 reads "open=96, 1-2=48, 3-4=24", and the serial banner reports the
PPQN it is using.

## 9. Troubleshooting

| Symptom | Likely cause | Check |
|---|---|---|
| **DX display does not come up**, or anything gets warm, at power-on | DIP plug reversed or offset in the U701 socket; short on the board; wrong ribbon | Switch off and unplug at once. Repeat the reversed-plug check ([03](03-install-in-the-dx.md) section 8.1) and continuity tests A to D. Look for bent plug pins. |
| DX behaves oddly (wrong sounds, random bass or snare hits) with the pot at 0 | Bad cable, bent pin in the U701 socket, U701 not fully seated in U1, GEN0* disturbed by the ribbon | Reseat the DIP plug and U701. Repeat the continuity tests. Do the GEN0* check (6.6). Shorten the ribbon. |
| **No LED at all**, DX on | No 5 V on the board, or the Nano is not running | Measure C1 + to TP4. Check the plug orientation. Check the Nano is fully seated, USB end to the left. Reflash the Nano (out of the board). |
| LED steady, snare never delayed, `pot=0.0%` | The Nano does not see the pot | J2 wiring: pin 1 GND (lug 1, CCW), pin 2 wiper, pin 3 +5 V (lug 3, CW). Measure A0 (R4's Nano end) to TP4: it should go from 0 V to 5 V as you turn the pot. |
| Pot works backwards (delay at anticlockwise) | Lugs 1 and 3 swapped | Swap the black and red wires at the pot. |
| `mode=DELAY` but the snare is not delayed | MUX_SEL does not reach U3 | U3 pin 1 should be about 5 V in DELAY. Check R5 and U3's orientation. |
| `mode=DELAY` but it never left BYPASS after power-up until the first snare | RST2 sitting high after power-up (see section 4) | Expected behaviour if confirmed. Play one snare. Record it under Q2. |
| `hits=0` while the snare plays | RST2 from U701 does not reach D2 | Is U701 in U1? TP2 should pulse. Check R1. Is this really a 1721A board and not a DXa? |
| `hits` counts but the snare is **silent** in DELAY | The replayed trigger does not reach the DX | TP1 should pulse, then TP3 the same. Check U3 and the ribbon conductor 4 (DIP 15). |
| Snare is silent in **BYPASS** too | DIP 15 path broken | TP3 should copy TP2. Check U3 pin 2 to pin 4 path, ribbon conductor 4, and the plug pin 15. |
| Snare plays **twice** (on time and delayed) | Something joins U1 pins 10/12/15 straight to the plug | Continuity test C. Look for solder bridges near U1, U3 and R1 to R3. |
| Delayed snare has the **wrong loudness** | FFA2 or FFB2 path wrong | Compare U3 pins 7 and 9 with U1 pins 12 and 10. Check R2, R3 and Nano D4, D5, D7, D8. |
| Bass sounds wrong or misses hits | GEN0* (U701 pin 9) disturbed, or a bass line (DIP 2, 5, 7) open | GEN0* scope check (6.6). Continuity rows 3, 9, 13, 16. Keep the ribbon 15 cm or shorter. |
| `bpm` is 2× or 4× the display, delay too short | JP1 set to a **lower** PPQN than the DX sends (for example a shunt fitted on a plain DX, which always sends 96) | Plain DX: JP1 open. Other models: match parameter 03, or set parameter 03 to 96. Power-cycle after moving the shunt. |
| `bpm` is ½ or ¼ of the display, delay too long, `dropped` may rise | JP1 set to a **higher** PPQN than the DX sends (for example JP1 open = 96, but the DX is set to 24 or slaved to MIDI) | As above |
| `clock=NONE` while the sequencer runs | No clock at D3 | Is the grabber on the R791 lead that reads 0 Ω to the CLOCK OUT tip? TP5 should pulse every 5.2 ms at 120 BPM. Check R6, R7, C7 and U4 (notch right). |
| `bpm` jumps about | Noisy clock lead | Twist the clock and ground wires. Keep the lead away from the transformer. Check C7. |
| `pot=` flickers between two values | Noise on the pot lead | Twist the three pot wires. Check C6. Raise `POT_HYSTERESIS_COUNTS` (firmware/README.md section 8). |
| Hum on the outputs only while USB is connected | Ground loop through the computer | Normal. Unplug USB when you are not using the serial monitor. |
| Upload fails: `stk500_getsync(): not in sync` | Clone Nano with the old bootloader, or a driver problem | Flash the Nano out of the board. Choose "ATmega328P (Old Bootloader)". Install the CH340 driver. |

More firmware-side troubleshooting is in [firmware/README.md](../firmware/README.md) section 11.

## 10. How to remove the mod (return the DX to stock)

1. Save your patterns to cassette. Switch the DX off and **unplug the mains**. Wait one minute.
   Put on the wrist strap.
2. Open the lid (two screws at the front).
3. Unplug the pot lead from J2 and the clock lead from J3.
4. Unclip the grabber from the R791 lead (or desolder the tack-soldered wire, using a small amount
   of heat). If you used the black ground clip, remove it too.
5. Pull the DIP plug straight up out of the DX's U701 socket, a little at each end.
6. Lift the original **U701** chip out of U1 on the TimeShift board, a little at each end.
7. Push U701 back into the DX's U701 socket, **notch at the same end as in your original photo**.
   Check every leg is in its contact.
8. Unclip the TimeShift board from its supports. To remove the adhesive feet, peel them off slowly;
   clean any residue with a little isopropyl alcohol.
9. The pot can stay in the panel (it is connected to nothing), or you can remove it. The 7.5 mm hole
   remains; a small panel blanking plug sized for the hole can cover it.
10. Close the lid, power on, and check every voice, including the bass, at every level.

The DX is now electrically stock. The only remaining change is the hole in the rear panel.
