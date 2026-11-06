# DX TimeShift rev A: independent design review

Date: 2026-11-06. Reviewer: independent design-review agent.

**Scope:** PROJECT_BRIEF.md §3–3.6 checked against:
* the KiCad schematic and PCB
* the Gerbers
* the firmware and its PC tests
* the research findings and the primary documents in `docs/reference/`
* the mechanical drawings and the assembly diagram
* both BOMs
* the web app and the GitHub Pages workflow

README.md and docs/0*.md were being written at the same time by the docs agent. They are only spot-checked here.

## 1. What was run (evidence)

| Check | Command / method | Result |
|---|---|---|
| Netlist export | `kicad-cli sch export netlist --format kicadxml` (kicad/kicad:9.0, private container) | Every net was compared by hand against brief §3.5 (section 2 below). **All match.** |
| ERC | `kicad-cli sch erc --severity-all` (with the standard global sym-lib-table) | **0 errors, 0 warnings** |
| DRC + schematic parity | `kicad-cli pcb drc --schematic-parity --severity-all` | **0 violations, 0 unconnected, 0 parity issues** |
| PCB geometry | pcbnew Python API: outline, holes, pads | Outline 84.0 × 63.0 mm. Holes at (3.5, 3.5) from each corner, centres 77.0 × 56.0 mm, Ø3.2 NPTH. GND pours on F.Cu **and** B.Cu. |
| Gerbers current? | Gerbers regenerated from the current .kicad_pcb and diffed against the zip | Copper, mask and edge files are **identical**. The silkscreen differs only by the `--subtract-soldermask` export flag. The zip holds F/B Cu, F/B Mask, F/B Silk, Edge.Cuts, PTH + NPTH Excellon, drill maps and a job file. **Complete for a 2-layer THT board.** |
| Silkscreen | text list via pcbnew + `renders/top-bare-board.png` | "DX TIMESHIFT rev A — SNARE" / "fits Oberheim DX board 1721A (U701). NOT for DXa (U715)" and "UNPLUG NANO / BEFORE USB" are both on F.Silkscreen. The back silkscreen repeats the model warning and the J1→DIP table. |
| Firmware PC tests | `make -C firmware/sim test` | **147 checks, 0 failures** |
| Firmware build | `arduino-cli compile --fqbn arduino:avr:nano --warnings all` (also `cpu=atmega328old`) | 10354 B flash (33 %), 930 B RAM (45 %). No warnings in the TimeShift files. The shipped `build/arduino.avr.nano/timeshift.ino.hex` is **byte-identical** to a fresh build. |
| Web app | `tsc --noEmit` and `VITE_BASE=/oberheim-dx-timeshift/ vite build` (built into scratch so the webapp agent's `dist/` was not touched) | Passes. The `index.html` asset URLs are prefixed with `/oberheim-dx-timeshift/`. Runtime fetches use `import.meta.env.BASE_URL`. |
| Research spot-check | DX schematic sheets 1 and 4 (`electrongate/dx_proc_1_of_7.jpg`, `dx_proc_4_of_7.jpg`, the same scans as the archive.org PDF), E&MM 1983 review, DX OM 2nd ed. | Section 4 |
| DIP-IDC mapping | 3M Pak 100 DIP datasheet TS-0617-08 (3416-0000), web search | Section 5 |

## 2. Schematic/PCB against brief §3.5: connection by connection

All of the following were read from the exported netlist and from the PCB pad nets.

* **Nano (U2, KiCad `Arduino_Nano_v3.x` pin numbers):**
  * D2 (pin 5) = RST2_IN, D3 (6) = CLK_IN, D4 (7) = FFA2_IN, D5 (8) = FFB2_IN
  * D6 (9) = RST2_OUT, D7 (10) = FFA2_OUT, D8 (11) = FFB2_OUT
  * D9 (12) = MUX_SEL, with R5 10 k to GND
  * D10 (13) / D11 (14) = PPQN_J1 / J2 → JP1 pins 1 and 3. JP1 pins 2 and 4 = GND.
  * D12 (15) = TP_REPLAY → TP1
  * D13 = on-board LED, no-connect
  * A0 (19) = POT_W, via R4 1 k from J2.2, with C6 100 nF to GND
  * +5V (27), GND (4, 29)

  The custom footprint was checked pad by pad. Pads 1–15 (TX1…D12) are on one row, 16–30 (D13…VIN) on the other, D12 is opposite D13 and TX1 is opposite VIN, rows are 15.24 mm apart, and the USB end is on the left. This matches a real Nano mounted components up. ✔
* **74HC157 (U3):**
  * pin 1 S = MUX_SEL; 15 /E = GND; 16 = +5V; 8 = GND
  * channel 1: 2 (1A) = RST2_CHIP, 3 (1B) = RST2_OUT, 4 (1Y) = RST2_PLUG
  * channel 2: 5 / 6 / 7 = FFA2_CHIP / FFA2_OUT / FFA2_PLUG
  * channel 3: 11 / 10 / 9 = FFB2_CHIP / FFB2_OUT / FFB2_PLUG
  * channel 4: 14 and 13 = GND, 12 not connected ✔
* **74HC14 (U4):** J3.1 → R6 10 k → CLK_RC (R7 100 k and C7 1 nF to GND) → pin 1 → pin 2 = pin 3 → pin 4 = CLK_IN → D3 and TP5. Unused inputs 5, 9, 11 and 13 are tied to GND; outputs 6, 8, 10 and 12 are open. 14 = +5V, 7 = GND. ✔
* **U1 (original U701):** the pin functions match the MC14174B / 74C174 pinout given in the task.
  * Pins 1–9, 11, 13, 14 and 16 each have exactly one net to the J1 header pin that lands on the same DIP number.
  * Pins 10, 12 and 15 go **only** to U3 A inputs and R3 / R2 / R1 (plus TP2 on 15).
  * J1 DIP 10, 12 and 15 are driven **only** by U3 Y (plus TP3 on 15). No straight-through path exists. ✔
* **J1 header → DIP:** 1→1, 2→16, 3→2, 4→15, 5→3, 6→14, 7→4, 8→13, 9→5, 10→12, 11→6, 12→11, 13→7, 14→10, 15→8, 16→9. This matches the brief exactly. +5 V is on header pin 2 (DIP 16) and GND on header pin 15 (DIP 8). ✔
* **Other connectors and test points:**
  * J2: 1 GND, 2 wiper, 3 +5 V. J3: 1 CLK, 2 GND.
  * TP1 REPLAY, TP2 RST2 chip, TP3 RST2 plug, TP4 GND, TP5 CLK_IN.
  * C1 10 µF, C2–C5 100 nF on +5V/GND, C6 100 nF pot filter, C7 1 nF clock filter.
  * R1–R4 1 k, R5 and R6 10 k, R7 100 k. ✔
* **Clock input levels:** R791 1 k + R6 10 k + R7 100 k give a high of about 4.5 V. That is above the 74HC14's worst-case VT+ (3.15 V at 4.5 V). The RC is (10 k ∥ 100 k) × 1 nF ≈ 9 µs. The DX CLOCK OUT pulse is ≥ 0.85 ms (findings d3), so no ticks can be lost. Polarity: rising at R791 → two inversions → rising at D3. ✔
* **Decoupling placement:** C2 is 3 mm from U1 pin 16 and C3 is 6 mm from U3 pin 16. C4 and C5 are **not** next to their chips (finding M-4).

## 3. Firmware against the brief and the hardware

* The pin constants in `timeshift.ino` match §3.5 and the schematic nets.
  * INT0 = D2 RST2 rising; INT1 = D3 clock rising.
  * FFA2 and FFB2 are read together in one `PIND` read (PD4/PD5 = D4/D5). ✔
* **Capture timing:** the Z80 writes FFA2/FFB2 in write 1, before RST2 rises in write 2.
  * The ISR samples them at worst about 40 µs after the edge. That figure is the longest interrupts-off section, `tryEnterDelayMode`, at about 20 µs, plus the Timer0 and INT1 ISRs.
  * The levels are held for ≥ 1 ms (findings c3), so the captured level is the new hit's level. ✔
  * Each queued event carries its own level. While DELAY is active, the chip side changing for hit N+1 never affects the replay of hit N, because the snare circuit only sees the B side. ✔
* **Replay:** set FFA2_OUT/FFB2_OUT (digitalWrite ≈ 3–4 µs each), wait 2 µs, then RST2_OUT high for 20 µs, then low.
  * The level setup before RST2 rises is therefore ≥ 5 µs, against the ≥ 1 µs needed.
  * 20 µs is far above the CD4040 reset and CD4013 clock/reset minimum widths (sub-µs at 5 V).
  * Interrupts are enabled during the pulse, so an ISR can only make it *longer*, never shorter. ✔
  * FFA2_OUT/FFB2_OUT are **held** after the replay until the next replay. They are level-sensitive async resets on U204 (DX sch. 4, verified). ✔
* **Mux switching:**
  * *Entering DELAY*, with interrupts off: copy the chip FFA2/FFB2 levels to the B side, set RST2_OUT low, check RST2_IN is low, raise MUX_SEL, empty the queue.
  * *Leaving DELAY*: only when RST2_IN is low and no replay is running (RST2_OUT is always low there, because replay is synchronous). MUX_SEL is never changed while either RST2 is high. ✔
  * Residual race: see N-3.
* **Data safety:**
  * Every ISR-shared value is `volatile`.
  * Multi-byte reads in the main loop (`tickPeriodSum_`, counters, queue slot) are taken with interrupts off.
  * The queue indices are 8-bit, single-writer.
  * `micros()` inside the ISRs is fine. ✔
* **Arithmetic and timing:**
  * Wrap-around: `micros()` wrap is handled by unsigned subtraction (tested). The BPM arithmetic fits in 32 bits for 24/48/96 PPQN. The delay maths is float. ✔
  * Default tempo: 120 BPM (5208 µs per tick at 96 PPQN). ✔
  * PPQN jumpers: open/open = 96, J1 = 48, J2 = 24, both = 96 with a warning. This matches the silkscreen "1-2=48, 3-4=24". ✔
* **Bypass → delay transition:** seamless (no edge on any snare line). **Delay → bypass:** any hits still queued are dropped (documented in firmware/README §1). ✔
* **DX power-up:** the DX holds RST2 high (writes 09h) until the first snare hit. The firmware stays in BYPASS until RST2 falls, so this is safe. ✔

## 4. Research sanity (primary documents)

| Claim (dx-findings.md) | Primary evidence checked | Verdict |
|---|---|---|
| U701 is the bass/snare trigger latch (C174). Pin 15 = RST2, 12 = FFA2, 10 = FFB2. D3/D4/D5 go in on pins 14/13/11. GEN0* is on pin 9 with R733 4.7 k pull-up. Pin 1 is tied to +5. | DX sch. 1 (1721A), U701 block read at full resolution. Labels: D0-3, D1-4, D2-6, D3-14, D4-13, D5-11; 2 RST1, 5 FFA1, 7 FFB1, 15 RST2, 12 FFA2, 10 FFB2; GEN0* to pin 9; pin 1 to +5. | **Supported exactly** |
| RST2 → U207 (4040) RST pin 11, U204 CLK pins 3/11, U208 R pin 4. FFA2 / FFB2 → U204 R pins 4 / 10. | DX sch. 4, snare half | **Supported** |
| CLOCK OUT: Q709 collector pulled up by R791 1 kΩ to +5. Base from COUT through R792 4.7 k. Emitter to GND. Sleeve through R754 10 Ω. | DX sch. 1, bottom-centre block | **Supported exactly.** The R791 lead on the collector side is the jack tip. |
| 96 PPQN | E&MM Sept 1983: "The clock pulse is 96 pulses per quarter note". OM 2nd ed. parameter 03 "(24, 48, 96) … set this to 96 for Oberheim equipment". | **Supported.** The OM 2nd ed. also lists MIDI In/Out, so it describes the MIDI-era DX. The findings already treat 24/48/96 as a variant feature, and the PPQN jumper covers it. |

## 5. DIP-IDC plug mapping and physical orientation

* The 3M Pak 100 DIP datasheet (TS-0617-08; 3416-0000 is now marked **DISCONTINUED**) shows the cover numbering:
  * pin 1 at one corner, pin 16 next to it on the opposite row at the same end;
  * pins 8 and 9 at the other end.
* With 1.27 mm ribbon on a 2.54 mm two-row plug, conductors 1 and 2 must land on the two contacts at one end, i.e. pins 1 and 16.
* Conductor 1 lands on pin 1 when the red stripe is at the pin-1-marked end. That gives the brief's table: 1→1, 2→16, 3→2, 4→15 …
* **No public drawing shows the contact stagger explicitly.** A plug whose first contact is in the other row would give a mirrored map (header 1→DIP 16, 2→DIP 1, … 15→DIP 9, 16→DIP 8). That would put board GND on the DX's GEN0* line.
  * The mandatory cable-only continuity test A in `hardware/mechanical/dip-plug-mapping.pdf` catches this, so no design change is needed.
* **Box header side:** a standard 2×8 IDC socket crimped with its ▲ at the red stripe puts conductor n on header pin n (zig-zag: 1/2 in the first column). The shroud key makes the header end foolproof, provided a keyed socket (3M 89116-0101 is keyed) is used. ✔

## 6. Findings (severity-ranked)

Blocker = must fix before fab or install. Major = must fix before the technician installs it. Minor = should fix. Note = for awareness.

| # | Sev. | Where | Finding / evidence | Recommended fix |
|---|---|---|---|---|
| M-1 | **Major** (safety) | Install / test procedure: docs/03, docs/04, `dip-plug-mapping.pdf`, `stages.ts` Install 2 | **A DIP plug inserted 180° into the DX U701 socket is not checked for before power-on.** The rotation swaps plug 16 (+5 net) with socket 8 (DX GND) and plug 8 with socket 16. The whole TimeShift is then reverse-powered from a PSU limited at about 2.6 A. That destroys U1 (the **original U701**), U3, U4 and the Nano, can vent C1, and loads the DX data bus D0–D5 and GEN0* through the IC clamp diodes. Continuity tests A–D are cable/bench only and cannot detect it. A U701 chip fitted backwards in U1 has the same effect. | **Addressed in the docs** after this review. docs/03 §8 now has paint marks on the plug's pin 1 and the socket notch. docs/03 §8.1 is a MANDATORY ohmmeter check with the DX unplugged: TP4 to U702 pin 8 < 1 Ω; C1 + to U702 pin 16 < 1 Ω; TP4 to U702 pin 16 NOT near 0 Ω; U1 pin 1 to C1 + < 1 Ω. It is repeated in the §13 checklist, recorded in docs/04 §1, and listed as docs/05 item M2. Reviewed: each of the four checks fails if the plug is rotated 180°, so the procedure is adequate. Check 4 runs through the DX's own pin 1 → +5 tie. Optional PCB hardening (partial protection only, see N-8): PTC in the J1 +5 line plus a reverse Schottky across the board rails. |
| M-2 | **Major** (fixed by webapp agent) | `webapp/src/boardModel.ts:98-101`, `stages.ts:360` | The Power stage printed "C5 for U4, C4 for the Nano". The app matched decoupling caps by distance to the footprint anchor, and C5 is 17.2 mm from U4 versus C4 at 17.4 mm. This contradicts netlist.py, the hardware README and the BOM (C4 = U4, C5 = Nano). | **Fixed** by webapp2 after this review: match by exact KiCad reference. Verified in source. |
| m-1 | Minor | `hardware/mechanical/wiring-diagram.svg/pdf` (TimeShift inset) | The inset draws **U1 on the left and U3 to its right**. The real PCB has U3 (74HC157) on the left and U1 in the centre under J1. Both are DIP-16 sockets. A technician who follows the drawing could put the original U701 into U3 and the 74HC157 into U1. The 74HC157 outputs would then drive DX data-bus D1 (pin 4) and GEN0* (pin 9) against the Z80 bus and the 74LS42: **bus contention on the DX**. Silkscreen and the assembly diagram are correct. | Redraw the inset from the real placement (U3 left, U1 under J1, Nano along the bottom, U4 bottom right). Add "U1 = ORIGINAL U701" in bold. |
| m-2 | Minor | PCB placement (`gen_pcb.py` PLACE), hardware/README §4.6 and §5 row 29 | **C4 ("U4 decoupling") is about 19 mm from U4 pin 14. C5 ("Nano decoupling") is about 22 mm from the Nano 5V pin** and actually sits next to U4. The brief asks for 100 nF *next to* each IC. Not functionally critical: U4 switches at about 400 Hz, the Nano has on-board decoupling, and both layers carry a GND pour. But the README's claim "C4 by U4, C5 by the Nano" is not true physically. | Before ordering boards (cheap): move C4 to within 5 mm of U4 pins 14/7, and C5 next to Nano pins 27/29. Re-run DRC. Otherwise correct the README wording. |
| m-3 | Minor | `hardware/exports/bom.csv` J1 "Cable" field vs `docs/bom.csv` | The KiCad BOM names **3M 3416-0000** (datasheet marked DISCONTINUED) / Amphenol 1-1658621-0 as the DIP plug. docs/bom.csv names **Adam Tech FDP-316-T**. The two BOMs disagree, and one names an obsolete part. | Make the KiCad `Cable` field match docs/bom.csv (FDP-316-T, alternative HARTING 09181169622). |
| m-4 | Minor | `firmware/timeshift/timeshift_core.h` `replay()` / `isrSnareHit()` | Replay is a fixed 20 µs pulse triggered only by the RST2 **rising** edge. Consequences: (a) a long RST2 high used to *hold the snare silent* (as at power-up, 09h) would be replayed as a full hit if it happened in DELAY mode; (b) the sound start shifts by (original width − 20 µs), at most about 0.2 ms with FW 1.20. (b) is negligible. (a) depends on firmware behaviour that has not been measured (Q2/Q8). | Extend bench check Q2: record RST2 at STOP/START, song change and pattern change. If any RST2 high pulse is longer than about 1 ms, capture the falling edge too and replay the measured width. |
| m-5 | Minor | `hardware/README.md` §1 | It says `kicad/3dmodels-cache/` "is the download cache". The folder exists locally, but check that it is either committed or listed in .gitignore. The repo has no root .gitignore yet. | Decide, and add a root `.gitignore` (e.g. `firmware/sim/test_timeshift` is already handled; `hardware/kicad/timeshift/*-backups`, `fp-info-cache`). |
| m-6 | Minor (fixed by webapp agent) | `webapp/src/stages.ts:490` | Said "M3 standoffs … just left of U701". The BOM's primary mounting is self-adhesive snap-lock supports, and the mechanical README suggests ZONE A, in front of U701–U704. | **Fixed** by webapp2 (text aligned; the 3D position is marked as simplified). |
| N-1 | Note | DIP plug stagger (section 5) | Conductor 1 → pin 1 versus → pin 16 cannot be confirmed from public drawings. | Already covered by mandatory continuity test A. Keep it mandatory. |
| N-2 | Note | PCB: U4 orientation | U4 is rotated 180° relative to U1 and U3 (notch on the right). Correctly silkscreened and called out on the assembly diagram, but a reversed 74HC14 swaps 14 and 7 (reverse power). | If C4/C5 are moved (m-2), rotate U4 to match the other ICs at the same time. |
| N-3 | Note | `tryEnterDelayMode()` | A window of about 4 µs (digitalWrite of MUX_SEL) sits between the RST2_IN check and the mux switch. A DX RST2 rising edge inside that window gives a short pulse on the original timing, plus a queued delayed copy: one double hit. Probability is about 1e-3 per mode change, and mode changes are rare. | Optional: use direct port reads and writes (PIND / PORTB) so the check and the switch are 2 instructions apart, or test `EIFR & INTF0` after switching. |
| N-4 | Note | Crosstalk on the ribbon | RST2_PLUG (conductor 4, driven by a fast HC output) lies between RST1 (conductor 3, the weak CMOS bass output) and D0. GEN0* is on conductor 16, next to GND only, which is good. | Add to bench check Q4: bass-only pattern with the snare delayed; listen and scope RST1 for glitches. In rev B consider 100–220 Ω series resistors on the 74HC157 Y outputs. |
| N-5 | Note | Nano absent or booting | The 74HC157 B inputs float while the Nano is out of its sockets or in the bootloader. They are unselected (bypass), so the function is unaffected; only a µA-level supply-current change. Opening a serial monitor resets the Nano (DTR), so MUX_SEL drops without regard to RST2. That is debug-only. | Optional rev B: 100 k pull-downs on D6–D8. Document "opening the serial monitor resets the board". |
| N-6 | Note | Brief §3.2 vs §3.6 | §3.2 describes tick counting with sub-tick interpolation. §3.6 (LOCKED) and the firmware use time-based elapsed_us ≥ beats × PPQN × period. The results are equivalent. | Optionally reword §3.2 to point at §3.6. |
| N-7 | Note | `webapp/src/boardModel.ts:16-17` | The procedural fallback board is still 65 × 40 mm. It is only used if board.glb/anchors are missing, and the CI copies both. | Optional: update to 84 × 63. |
| N-8 | Note | Safety, other | **USB back-power** is handled by silkscreen and docs, which is adequate. **Current draw:** Nano about 20–30 mA plus logic and LED, under 40 mA, against a 60 mA budget. ✔ **CMOS protection:** 1 k series resistors on the Nano inputs. The 10 k on the clock input survives a mis-clip onto ±12 V (≤ 1.2 mA clamp current). The pot is ratiometric through 1 k. ✔ **Clock GND lead:** clipping it onto a non-ground point would short that point to the board GND. `stages.ts` already says to check for 0 Ω first; the wiring diagram says the GND wire is optional. **Hardware reverse protection** (PTC + Schottky) protects only partly, because the reversed signal pins still clamp into the DX bus. So the procedural check in M-1 is the primary mitigation. | — |
| N-9 | Note | GitHub Pages workflow | Valid: `permissions` (`pages: write`, `id-token: write`); `pnpm/action-setup@v4` with `package_json_file: webapp/package.json` (pnpm version from `packageManager`); Node 24 with pnpm cache; `configure-pages@v5`; `upload-pages-artifact@v3` (`webapp/dist`); `deploy-pages@v4` with a `github-pages` environment; `VITE_BASE=/oberheim-dx-timeshift/`. `sync-model` needs `hardware/exports/board.glb` (10 MB) and the .kicad_pcb committed, otherwise the app falls back to the procedural model. One-time setting: Pages source = "GitHub Actions" (documented in the workflow header). | — |

**No Blocker was found** in the schematic, PCB, Gerbers or firmware.

## 7. What I fixed myself

Nothing in the deliverables was edited by me. I found no typo-level defects (pin numbers and constants are all correct). Every remaining item belongs to an agent who was still active (hardware2, mechanical2, firmware, webapp2, docs). I routed them instead:

* **webapp2** was told about M-2 and m-6. Both are now **fixed** in `webapp/src/boardModel.ts` and `webapp/src/stages.ts`, and I verified the source.
* **docs** was sent the M-1 in-situ orientation check. It is now in docs/03 §8 and §8.1, docs/04 §1 and §2, and docs/05 M2, using U702 pins 8/16 as the DX reference. Reviewed and accepted.

Only this file (`docs/review/design-review-revA.md`) was created. Scratch outputs (netlist, ERC/DRC reports, rebuilt Gerbers, test build) are outside the repo. Running the sim tests in place built the gitignored `firmware/sim/test_timeshift`.

## 8. Verdict

**Rev A is ready to send for PCB fabrication.** The netlist matches the locked brief pin for pin. ERC and DRC (with parity) are clean, the Gerber zip is complete and current, and the firmware builds and passes its tests against the same pin map.

Recommended (not mandatory) before uploading the Gerbers, because they cost minutes and avoid a rev B:

1. Move C4 next to U4 and C5 next to the Nano (m-2). Optionally rotate U4 to match U1/U3 (N-2).
2. Re-run `build_all.sh` and confirm DRC is clean.

**Conditions before the board goes into a DX:**

1. M-1: the in-situ orientation ohmmeter check is in docs/03 §8.1 and marked mandatory. **Met.** The technician must actually do it and record it in docs/04 §1.
2. m-1: the wiring-diagram inset is redrawn with U1/U3 in their real positions.
3. m-3: the two BOMs name the same, currently available DIP plug.
4. The bench items stay mandatory: Q1 (U701 socketed), continuity tests A–D, Q2 (RST2 waveform, including the long-pulse check in m-4), Q4 (GEN0* integrity and ribbon crosstalk, N-4), Q5 (clock tap), Q7 (+5 V drop).
