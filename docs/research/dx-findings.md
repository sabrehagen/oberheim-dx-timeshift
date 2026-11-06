# Oberheim DX: verified facts for the DX TimeShift (snare) interposer

Research agent report, Revision A, 2026-11-06.
The source documents are in `docs/reference/` (see `docs/reference/INDEX.md`).

## How to read this document

Every technical statement carries one of these tags:

* **VERIFIED**: read directly from a primary source. The source is cited: a schematic
  sheet, layout drawing, manual page, photo, or the static disassembly of the original
  firmware.
* **INFERRED**: the research agent's reasoning from verified facts. It is probably right
  but it is **not** fact. Each one is listed as a bench check in §i.
* **TO-BE-CONFIRMED (TBC)**: unknown. The exact bench measurement that settles it is
  given.

Citation shorthand:
* "DX sch. N" = DX Processor Board schematic, drawing **1721A**, sheet N of 7.
  `oberheim-dx_archive-org_Oberheim_DX.pdf` PDF page N+2 (sheet 1 = p3 … sheet 7 = p9),
  or `electrongate/dx_proc_N_of_7.jpg`.
* "DX layout" = "Parts Layout, DX Processor Board Rev C" (PDF p10,
  `electrongate/dx_proc_board_layout.jpg`).
* "DX switch sch." = DX Switch Board schematic **1722A** (PDF p1).
* "DXa sch. N" = DX "A" Processor Board schematic **1906**, sheet N (`electrongate/dxa_pN.jpg`).
* "OM2 pN" = DX Owner's Manual, 2nd ed. (Jan 1985), PDF page N.
* "Photo WM" = `photos/wikimedia_Oberheim-DX_processor_board.jpg` (CC BY-SA 3.0).
* "Photo EG-S" = `photos/electrongate_stretch_w_midi_installed.JPG`.
* "FW 1.20" / "FW 1.5" = static disassembly of Electrongate ROM images DX130A/B.BIN (the
  header string inside reads "DX1.20 [C]1983 OBERHEIM") and DX15A/B.BIN. The method is in
  the Appendix.

---

## 0. Headline: the baseline architecture in PROJECT_BRIEF.md was wrong

1. **The Oberheim DX has no voice cards, no card-edge slots and no backplane.**
   All six voices (BASS, SNARE, HIHAT, TOMS, PERC, CYMBAL) are built directly on the
   single "DX Processor Board". VERIFIED: the DX layout drawing shows voice sections
   labelled BASS/SNARE/HIHAT/TOMS/PERC/CYMBAL on the one board. Electrongate's DMX/DX
   comparison table says "Removable voice cards: DMX Yes, DX **No**"
   (`web-pages/electrongate_dmxfiles_comparison.html`). Photo WM shows the same thing.
   A card-edge riser cannot be built.
2. **The snare is not triggered by a single short strobe with a data byte.** The CPU
   writes three **latched logic levels**, `RST2`, `FFA2` and `FFB2`, into a hex D
   flip-flop **U701** (Motorola MC14174B, a CMOS 74C174 equivalent, 16-pin DIP). The
   bass shares this chip. Those three wires run across the board to the snare circuit.
   VERIFIED: DX sch. 1 and DX sch. 4. The flip-flop chip itself is the "capture latch":
   its outputs hold their state until the next write.
3. **New interception point:** the **U701 DIP-16 socket**. The original U701 is unplugged
   and moved onto the TimeShift board, and the TimeShift board plugs into the empty socket
   (directly or by a short ribbon with a DIP-16 plug). 13 of the 16 pins pass straight
   through. Only the three snare outputs (pins 10, 12, 15) are intercepted. This is the
   same technique Oberheim used for the Stretch expander and Electrongate uses for its MIDI
   upgrades (§g).
4. PROJECT_BRIEF.md §3 has been updated and marked "CHANGED BY RESEARCH".

---

## 0.1 First identify which model you have (this changes the pin numbers)

| Model | How to recognise it | Snare trigger latch | Snare pins on that latch | Source |
|---|---|---|---|---|
| **DX** (1983, no MIDI) | No MIDI jacks. Main board silkscreen "OBERHEIM DX PROCESSOR BOARD", drawing 1721A. Function buttons the same size as drum pads. | **U701**, clocked by `GEN0*` (I/O write to port 10h) | **pin 15 = RST2, pin 12 = FFA2, pin 10 = FFB2** | VERIFIED DX sch. 1 |
| **DXa** (factory MIDI, 1984–85) | MIDI IN/OUT on the rear. Smaller function buttons. Board drawing 1906 "DX 'A' Processor Board". | **U715**, clocked by `GEN2*` (port 70h) | **pin 7 = RST2, pin 5 = FFA2, pin 2 = FFB2** | VERIFIED DXa sch. 1 |
| DX + Stretch, or DX + Electrongate MIDI upgrade | Extra 4-voice panel on the left, and/or MIDI jacks in the right end panel | Same as the DX (U701) | Same as the DX | INFERRED: neither product touches U701 (they use the Z80, RAM and U722 sockets per the install pages). TBC: check visually that U701 is still on the main board. |

The rest of this document describes the **DX (drawing 1721A)** unless it says "DXa".
The user's description ("1983, Z80-based") matches the DX. **TBC step 0:** open the unit,
photograph the main board and read the title silkscreen and the ROM labels (U713/U714).

---

## a. Physical architecture

| # | Fact | Tag | Source |
|---|---|---|---|
| a1 | One main PCB, the **DX Processor Board**. It carries the Z80 (U712), 2 OS EPROMs (U713/U714), 4×6116 RAM (U715–U718), the tempo timer, the cassette/sync circuits, the PSU regulators, **and all six voices**. | VERIFIED | DX layout. DX sch. 1–7. Photo WM. |
| a2 | The board lies flat on the bottom of the case. The rear edge carries the board-mounted 1/4" jacks, which come through the rear panel. The sloping front panel (switch board + slider "pot board") is a separate assembly on the hinged lid. It connects by ribbon cables: connector **C** (20-way, audio to the sliders) and connector **G** (digital: buttons, LEDs, display). | VERIFIED | Photo WM (blue ribbons from the main board to the lid). DX layout (connectors C, G). DX sch. 1 (C/G pin lists). |
| a3 | **No voice cards, no card-edge slots, no backplane, no voice-card connectors.** | VERIFIED | DX layout. Electrongate comparison table. |
| a4 | Snare voice location: the **second voice column from the left** on the main board, parts **U201–U209**, Q201/Q202, jumpers SJ1/SJ2/SJ3, label "SNARE" at the bottom of the column. The snare EPROM **U206** (2764, "DX SNARE 64" in Photo WM) is **socketed**. | VERIFIED | DX layout. Photo WM. |
| a5 | U701/U702/U703 (voice trigger latches) sit in a row of three 16-pin DIPs **just below the two 470 µF capacitors C701/C702, left of U704 (74LS244) and the Z80 U712**, near the middle of the board. | VERIFIED | DX layout. Photo WM (the chips are marked MC14174BCP, date code 8321). |
| a6 | U701–U703 **appear to be in DIP sockets** in two different units (black socket bodies visible around the pins). The Z80, OS ROMs and RAMs are socketed. The voice EPROMs are socketed. In Photo WM the snare's CD4040 (U207) and CD4013 (U208) also appear socketed. | Z80/ROM/RAM/EPROM sockets: **VERIFIED** (Electrongate install text "Remove the Z80 processor (U712) from its socket"). U701 socket: **INFERRED from photos, TBC.** | Photo WM. Photo EG-S. `web-pages/electrongate_dmxfiles_dxmidi_installation.html` |
| a7 | On the **DXa** the logic ICs may be soldered directly to the board. A CD4013 in the Electrongate DXa close-up looks soldered. | INFERRED, TBC | `photos/electrongate_dxa_bass_mod.jpg` |
| a8 | Precedent: the Oberheim **Stretch** expander connects to the DX by "Two ribbon cables … The cables plug into IC sockets on the DX main board" (one into a 6116 RAM socket, one into the U722 socket). | VERIFIED | `web-pages/electrongate_obfiles_stretch_install.html`. Stretch sch. 3 (`electrongate/str3.jpg`, U405 6116 on cable "D" pins). Electrongate DX MIDI page ("Connect ribbon cable J4 to socket U722"). |
| a9 | Optional boards that may already sit in the area above or near U701: the Oberheim **"DX SYNC-TO-TAPE" board 1760B**, on standoffs over the U705–U714 area (Photo WM), and the **Electrongate MIDI board**, on 1/2" + 3/8" standoffs over the CPU area (Photo EG-S). | VERIFIED (photos) | Photo WM. Photo EG-S. Electrongate install text. |
| a10 | Vertical clearance between the top of U701 and the underside of the closed lid (sliders and pot board) | **TBC** | See Q3 in §i. INFERRED lower bound: the Electrongate MIDI board stands about 22 mm (1/2" + 3/8" standoffs) above the board in the neighbouring CPU area with the lid closed, so some area near U701 has at least about 25 mm. Whether the lid's slider bodies are above U701 is unknown. |
| a11 | Rear-panel tuning pots: a **separate small PCB behind the rear panel**, wired by an **8-wire harness to header "D"** at the left edge of the main board. | VERIFIED | Photo WM (white 8-way connector and coloured harness). DX layout (header D at the left edge). DX sch. 4–7 (D1…D8). |

**Physical architecture: the bottom line.** The interposer cannot be a riser card. It
must be either:
* **Option A, stacked adapter:** a small PCB with machined DIP-16 male pins underneath
  (they plug into the U701 socket) and a DIP-16 socket on top (it holds the original
  MC14174B), with the TimeShift electronics on the same PCB. This needs the clearance in
  a10.
* **Option B, ribbon (recommended until a10 is measured):** a 16-way DIP-plug ribbon
  (for example 3M/TE DIP-16 IDC plug, 10–15 cm long) from the U701 socket to the
  TimeShift PCB. The TimeShift PCB carries the original MC14174B in its own socket. It
  can be mounted wherever there is room (standoffs, or the inside of the rear panel).
  Electrongate's DMX MIDI kit does exactly this with the DMX's voice-trigger 74C174
  (IC 20) (§g).

---

## b. The snare "slot" pinout, now the **U701 socket pinout** (DX)

### b1. U701: MC14174B / 74C174 hex D flip-flop, DIP-16 (VERIFIED, DX sch. 1)

| U701 pin | Function (74C174/4174) | DX net (DX sch. 1) | Used by | Notes |
|---|---|---|---|---|
| 1 | CLR̅ | tied to **+5 V** | — | Never cleared |
| 2 | Q1 | **RST1** | BASS voice | |
| 3 | D1 | data bus **D0** | | |
| 4 | D2 | data bus **D1** | | |
| 5 | Q2 | **FFA1** | BASS | |
| 6 | D3 | data bus **D2** | | |
| 7 | Q3 | **FFB1** | BASS | |
| 8 | VSS | **GND** | | |
| 9 | CLK (rising edge) | **GEN0*** (4.7 kΩ R733 pull-up to +5) | | Comes from U709 (74LS42) output 1 = Z80 I/O write with A6..A4 = 001 (port 10h, used as `OUT (10h)` by the firmware) |
| 10 | Q4 | **FFB2** | **SNARE** | → U204 pin 10 (async reset R of flip-flop "FFB") |
| 11 | D4 | data bus **D5** | | |
| 12 | Q5 | **FFA2** | **SNARE** | → U204 pin 4 (async reset R of flip-flop "FFA") |
| 13 | D5 | data bus **D4** | | |
| 14 | D6 | data bus **D3** | | |
| 15 | Q6 | **RST2** | **SNARE** | → U207 (CD4040) pin 11 RST, U208 pin 4 (R of the "SCARRY" flip-flop), U204 pin 3 and pin 11 (CLK of both FFA/FFB flip-flops) |
| 16 | VDD | **+5 V** | | |

Port byte for `OUT (10h),A` (VERIFIED, DX sch. 1. Confirmed by FW 1.20/1.5, which pack the
bits this way and write 09h at reset = RST1 and RST2 high):
`D0=RST1, D1=FFA1, D2=FFB1, D3=RST2, D4=FFA2, D5=FFB2, D6/D7 unused.`

**DXa (VERIFIED, DXa sch. 1):** U715 (C174), clock pin 9 = `GEN2*` (74LS42 U735 output 7
= port 70h). D0→pin 2 **FFB2**, D1→pin 5 **FFA2**, D2→pin 7 **RST2**, D3→pin 15 FFB1,
D4→pin 12 FFA1, D5→pin 10 RST1.

### b2. Answers to the specific questions in the task

| Question | Answer | Tag |
|---|---|---|
| Data bus lines used by the snare | **None directly.** The snare circuit never sees the Z80 data bus. The CPU writes bits **D3, D4, D5** of an `OUT (10h)` byte into U701. The snare circuit receives the three latched outputs. | VERIFIED DX sch. 1, 4 |
| What the 3 bits mean | **RST2** = reset/start (held high = voice held at sample address 0; the falling edge starts playback). **FFA2**, **FFB2** = level select (3 levels: soft/medium/loud. FFA also drives the EPROM A11 sample-half select through jumper SJ2). | Circuit: VERIFIED DX sch. 4. "Snare drum, with three volume levels": VERIFIED OM2 p15. Exact bit-to-level code: **INFERRED, TBC** (b3). |
| Card strobe / select line | No per-card strobe exists. The write strobe for U701 is **GEN0*** (active-low pulse, about 1 µs, latched on its **rising** edge). It is decoded from IOWR* + A4..A6 by U709 74LS42. | VERIFIED DX sch. 1. Pulse width about 1 µs is **INFERRED** (Z80 I/O write cycle at about 2.46 MHz). TBC with a scope. |
| Which Z80 I/O generates it | `OUT (10h),A` (any port 10h–1Fh or 90h–9Fh decodes the same; A0–A3 and A7 are not decoded) | VERIFIED DX sch. 1 (decode). FW 1.20/1.5 use port 10h. |
| +5 V, GND | U701 pin 16 / pin 8 | VERIFIED |
| Other rails | The snare voice uses +12 V and −12 V for U205 (AM6070 DAC) and U202 (TL082). They are **not** present on the U701 socket and are not needed. | VERIFIED DX sch. 4 |
| Audio out | U202 pin 7 → connector **C pin 15 "SNARE"** (to the front-panel slider/mixer) and the rear SNARE direct-out jack. Not touched by this project. | VERIFIED DX sch. 1 (C15 SNARE), sch. 4 |
| Tuning / pitch | Snare 555 (U209) pin 5 (control voltage) ← R244 3.3 kΩ ← R2 470 Ω ← **header D pin 2** = wiper of the rear SNARE tuning pot. The pot ends are on **D4 = +5 V** and **D5 = GND**. Header D: D1 bass, D2 snare, D3 hi-hat, D6 toms, D7 cymbal, D8 perc, D4 +5 V, D5 GND. | VERIFIED DX sch. 4–7 |

### b3. Level code (INFERRED from DX sch. 4 and DXa sch. 4, TBC)

In both boards a "low" on the FFA path pulls the DAC reference node down through
1.5 kΩ + diode (medium level), and a "low" on the FFB path pulls it down through
15 Ω + diode (soft level). Expected (INFERRED):

| Pad | FFA2 | FFB2 |
|---|---|---|
| LOUD | 1 | 1 |
| MEDIUM | 0 | 1 |
| SOFT | x | 0 |

TBC: logic analyser on U701 pins 10/12/15 while pressing SNARE SOFT, MEDIUM, LOUD
(each 3 times). Record the levels at the RST2 rising edge.

---

## c. What happens in the snare circuit when the CPU triggers it (DX)

### c1. Circuit (VERIFIED, DX sch. 4)

* **U209 NE555** astable = sample clock `SCLOCK`. Its frequency is set by the rear
  tuning pot through pin 5.
* **U208 (CD4013), second half (pins 8–13)** divides SCLOCK by 2 → SA0 and clocks the
  **U207 CD4040** 12-bit address counter (SA1–SA12). Its reset R (pin 10) = **SCARRY**.
  When SCARRY is high the divider stops.
* **U208, first half (pins 1–6)** = "SCARRY" end-of-sample flip-flop: D=+5 V, CLK ← SA11
  or SA12 (jumper SJ3, through C213 330 pF / R241 4.7 kΩ edge network), **R (pin 4) ←
  RST2**, Q (pin 1) = SCARRY. SCARRY also drives the EPROM U206 enable pins (20/22)
  through SJ2. At the end of the sample the EPROM is disabled and the counter stops.
* **U207 CD4040 RST (pin 11) ← RST2**: **level-sensitive** reset. While RST2 is high the
  address counter is held at 0.
* **U204 (CD4013) "FFA" (pins 1–6)**: D=+5 V, **CLK (pin 3) ← RST2**, S=GND,
  **R (pin 4) ← FFA2**. Q (pin 1) → SJ2 (EPROM A11, sample-half select). Q̄ (pin 2) →
  R225 1.5 kΩ / D204 → DAC reference node (medium attenuation).
* **U204 "FFB" (pins 8–13)**: D=+5 V, **CLK (pin 11) ← RST2**, S=GND,
  **R (pin 10) ← FFB2**. Q̄ (pin 12) → R224 15 Ω / D201 → DAC reference node (soft
  attenuation).
* U206 2764 EPROM → **U205 AM6070** companding DAC (its reference current through R226
  5.6 kΩ sets the level) → U202 TL082 filter/buffer → C15 "SNARE".

**DXa difference (VERIFIED, DXa sch. 4):** there are no U204 flip-flops. FFA2/FFB2 drive
the attenuation diodes (R207 1.5 kΩ/D202, R206 15 Ω/D201) **directly**, so the level is a
**held level for the whole sound**. RST2 resets the CD4040 (U204 on the DXa) and the
SCARRY flip-flop, as on the DX.

### c2. Answers

| Question | Answer | Tag |
|---|---|---|
| Latch type | The "latch" is **U701, an edge-triggered hex D flip-flop** (MC14174B/74C174), clocked on the **rising edge of GEN0***. It is not transparent. On the snare side, **U204 is a 4013 edge-triggered D flip-flop** clocked by the **rising edge of RST2**, with **level-sensitive async resets** from FFA2/FFB2. | VERIFIED DX sch. 1, 4. Photo WM (MC14174B). |
| What resets the address counter | **RST2 high** (CD4040 pin 11, level-sensitive). RST2 high also clears SCARRY (U208 pin 4), which re-enables the divider and the EPROM. **Playback starts on the falling edge of RST2.** | VERIFIED DX sch. 4 (circuit). "Starts on falling edge" is INFERRED from the circuit and confirmed by the firmware sequence in c3. |
| Retrigger logic | No separate retrigger logic. A new RST2 pulse simply resets the counter, so a new hit **cuts off** the previous snare. | VERIFIED circuit. Behaviour corroborated by E&MM 1983 for toms ("causes the first tom to cut off sharply"). |
| Volume latched or held? | **DX:** captured into U204 at the RST2 rising edge, **but** FFA2/FFB2 also act as asynchronous resets for as long as they are high. They must therefore be presented as **held levels**, exactly like the original. **DXa:** purely held levels. On both, U701 already holds them until the next `OUT (10h)`. | VERIFIED circuit |
| Edge- or level-triggered | Both. The RST2 **rising** edge clocks the level flip-flops (DX). RST2 **high** holds the counter in reset (level). RST2 **falling** releases it and the sound starts. | VERIFIED circuit |
| Minimum pulse width that reliably triggers | It must satisfy CD4040 reset pulse width and CD4013 clock/reset pulse widths at VDD = 5 V. Typical 4000-series datasheet minima are a few hundred ns. **The shortest pulse the stock firmware produces is about 9 µs** (c3). **Recommendation: replay RST2 high for ≥ 10 µs, and present FFA2/FFB2 ≥ 1 µs before the RST2 rising edge.** | The datasheet figures are **INFERRED** (datasheets not downloaded). The 9 µs figure is **VERIFIED by firmware analysis** (FW 1.5) but is a calculation: **TBC with a logic analyser.** |

### c3. The trigger sequence the firmware actually performs (VERIFIED by static disassembly; timing TBC)

Both ROM versions analysed write the voice latches (ports 10h, 20h, 70h) **only** through
one routine, which performs **three writes** for each trigger event:

```
write 1:  RST2 = 0 (or its previous value), FFA2/FFB2 = new level bits
write 2:  RST2 = 1 for every voice being triggered   ← U204 clocked; counter reset
write 3:  RST2 = 0                                    ← counter released → SOUND STARTS
```

* **FW 1.5** (routine at ROM-B offset 08F4h, executed at CPU address 68F4h): write 2 and
  write 3 are `OUT (C),A ; POP AF ; OUT (C),A`. That is 22 T-states between GEN0* rising
  edges = **≈ 9.0 µs RST2 high** at 2.4576 MHz.
* **FW 1.20** (file DX130, routine at 15C2h–1652h): each "write" rewrites ports 10h, 20h
  and 70h in turn, so RST2 stays high for about 550 T-states = **≈ 0.2 ms** (hand count,
  approximate).
* Interrupts are disabled (`DI`) during the sequence.
* At power-up the firmware writes 09h to ports 10h/20h/70h (RST held high on all voices).
  VERIFIED FW 1.20 address 0044h.
* Writes for *other* voices (e.g. bass on the same port) rewrite the snare bits with
  their **unchanged** shadow values, so they cause **no edges** on RST2/FFA2/FFB2.
  VERIFIED by reading the routine's masking logic in FW 1.20/1.5. **TBC on the bench.**
* The Z80 clock is a **4.9 MHz crystal ÷ 2** (U720 oscillator, U721 74LS74), about
  2.46 MHz. VERIFIED DX sch. 1. The exact 2.4576 MHz is **INFERRED** from the DMX
  service manual (PDF p7, "2.456 MHz", same circuit) and from the tempo arithmetic in d2.

**Consequence for the design (INFERRED):** to make the snare play exactly as stock, only
later, the TimeShift board must **reproduce the 3-wire level history (RST2, FFA2, FFB2)
shifted in time.** A simple, faithful scheme:

* **Capture:** treat each RST2 rising edge as an event. Use an AVR external interrupt
  (INT0) in rising-edge mode. The edge flag is latched in hardware, so a 9 µs pulse
  cannot be missed even if the ISR is delayed. Read FFA2/FFB2 from U701's outputs in the
  ISR. They are stable from write 1 until the next trigger sequence, which is ≥ 1 ms
  later (the sequencer tick at 250 BPM is 2.5 ms; FW 1.20 does sequencer work every
  second 96-PPQN interrupt).
* **Replay:** at time t + delay, set FFA2/FFB2, wait ≥ 1 µs, raise RST2 for ≥ 10 µs, then
  lower it. Keep FFA2/FFB2 held until the next replayed event.
* A separate 74HC574 "capture latch" (brief §3.1) is **not needed**, because U701 already
  holds the data. A 74HC74 "edge flag" is optional (belt and braces).
* For pot = 0 and for fail-safe behaviour, use a **2:1 multiplexer** (e.g. 74HC157). It
  selects either the U701 outputs (bypass) or the MCU outputs (delayed), with the select
  line pulled to "bypass" by a resistor. Then a blank, unprogrammed or crashed MCU leaves
  the DX stock, with about 10 ns of added latency.

---

## d. Tempo clock

### d1. CLOCK OUT / CLOCK IN hardware (VERIFIED, DX sch. 1)

* **CLOCK OUT jack:** tip ← collector of **Q709** (NPN, emitter to GND), pulled up to
  +5 V by **R791 1 kΩ**. Base ← **R792 4.7 kΩ** ← **COUT** = **U710 pin 2** (MC14174/74C174
  hex D flip-flop, data bit D5, clocked by `CASO*` = I/O write to port 50h). The jack
  sleeve goes to ground through R754 10 Ω.
  * Output level: about 0 V / +5 V, **inverted** relative to COUT, 1 kΩ source impedance
    when high. VERIFIED circuit.
  * The DMX manual describes the equivalent output as "EXTERNAL CLOCK: TTL compatible"
    and the input as "5 Volt positive pulse, TTL compatible" (DMX OM PDF p39).
* **CLOCK IN jack:** tip pulled up by R762 1 kΩ, sleeve through R756 10 Ω. A NAND
  (U720) gates it with `LATCH` (U710 pin 5) into U721 (74LS74) → **INT*** (Z80
  interrupt). `LATCH` selects internal timer vs external clock. VERIFIED DX sch. 1.
* **Internal tempo timer:** U711 **40103** 8-bit down-counter, preset from U719 74LS374
  (port 30h, `STIM*`), clocked by **TCLK**, enabled by `CLEN` (U710 pin 15). Its CO̅
  (pin 14) → U722/U720/U721 → INT*. TCLK = Z80 CLK ÷ 256 through U726 74LS393 (DX sch. 2).
  VERIFIED circuit.
* **START/STOP:** separate. The START footswitch jack (R760 pull-up) is read through
  U704 74LS244. NEXT is another footswitch. There is **no** start/stop signal on the
  clock jacks. "Auto Start" is a software feature: the DX starts when clock pulses
  arrive and stops after 125 ms without pulses (OM2 p32). VERIFIED.

### d2. Resolution (VERIFIED from three independent sources)

* "The clock runs at 96 pulses per quarter note" (E&MM Sept 1983 review).
* "PARAMETER 03 (CLOCK OUT RATE) to '96' to transmit the Oberheim System Clock standard
  of 96 pulses per quarter note" (OM2 p32). Timing source / clock out rate selectable
  24/48/96 (OM2 p24–25, p7 rear panel caption).
* Firmware: FW 1.20 computes displayed BPM = **6000 / (timer preset + 1)**, with presets
  limited to 17h…EFh = **250…25 BPM**. That matches "25 to 250 Beats per Minute" (OM2 p12).
  With TCLK = 2.4576 MHz / 256 = 9600 Hz, the interrupt rate is 9600 / (N+1) = 1.6 × BPM Hz
  = **96 interrupts per quarter note**. The CLOCK OUT routine runs on **every** interrupt.
  The sequencer itself steps at 48 per quarter note (it does its main work every second
  interrupt; the finest quantise is 1/192 note, OM2 p18). VERIFIED (firmware) + INFERRED
  (exact crystal value).
* **Variants:** a basic DX outputs 96 PPQN. INFERRED: the Stretch brochure says the
  Stretch *adds* "Variable Clock Rates (24-48-96)" to DXs without MIDI, so the basic DX
  has a fixed rate. On the **DXa, Stretch DX and Electrongate-MIDI DX**, CLOCK OUT can be
  set to **24, 48 or 96**. When slaved to MIDI clock (24 PPQN) the clock out "cannot be
  faster than the Clock In Rate", so it is 24 (OM2 p32). **The TimeShift firmware
  therefore needs a 24/48/96 PPQN setting (jumper),** or the user must set parameter 03
  to 96.

### d3. Waveform (FW 1.20 = VERIFIED by disassembly. Real behaviour TBC)

The tempo ISR (entry at 0038h → 1BF1h) **clears COUT at entry** and **sets COUT at exit**
(1F08h). Both the "work" path and the "idle" path pass through 1F08h. The idle path waits
in a delay loop (~2048 T ≈ 0.85 ms) first. Therefore:

* **At the CLOCK OUT jack (Q709 collector): idles LOW. Each tick is a positive pulse
  that rises at the start of the tick interrupt.** The width is roughly 0.85 ms (idle
  ticks) to a few ms (work ticks). The **rising edge** is the timing reference.
* At **COUT (U710 pin 2 / R792 far end)** the polarity is the opposite: it idles high
  and **falls** at each tick.
* **Present when stopped?** The ISR toggles COUT on every timer interrupt
  unconditionally. Whether the timer keeps running when the sequencer is stopped depends
  on `CLEN` (U710 pin 15), which the firmware sets in several places and clears in one
  (FW 1.20 06AAh). **TBC** (Q5 in §i).

### d4. Where to tap the clock (recommendation)

| Option | Point | Level/polarity | Invasiveness |
|---|---|---|---|
| **1 (recommended)** | Lead of **R791 (1 kΩ)** on the Q709-collector side = same node as the CLOCK OUT jack tip | 0/5 V, rising edge = tick | Clip-on mini-grabber (no solder) or one tack-soldered wire on a resistor lead. Near Q709/R791/R792, front-right of the main board next to the battery B1 (DX layout). |
| 2 | **R792 (4.7 kΩ)**, U710 side = COUT | CMOS 0/5 V, falling edge = tick | Same as 1 |
| 3 | DIP-16 pass-through "sniffer" adapter in the **U710 socket**, picking pin 2 | as 2 | No solder, if U710 is socketed (TBC). It uses a second adapter. |
| 4 | Outside the case: patch lead from the CLOCK OUT jack to a jack on the TimeShift | as 1 | Needs a second hole. Not recommended. |

The jacks are **PCB-mounted on the main board** (Photo WM), so the "jumper to the CLOCK
OUT jack tip" fallback in the original brief would mean soldering under the board. Avoid
it. Put **10 kΩ series + a Schmitt input** (e.g. 74HC14, or the AVR pin plus an RC) on
the TimeShift side so the tap cannot load or disturb the DX output.

---

## e. Rear panel

| # | Fact | Tag | Source |
|---|---|---|---|
| e1 | Upper row on the right (viewed from behind): "DRUM TUNING" pots, **six**, in the order **PERC, CYMBAL, TOMS, HI-HAT, SNARE, BASS** (left to right when looking at the rear). **SNARE is second from the right.** Toms share one pot. | VERIFIED | `photos/electrongate_dx_back_1a.jpg`. OM2 p7. E&MM 1983 ("six presets … tuning of the six columns"). |
| e2 | The pots have **short bare shafts with no knobs** (Electrongate calls them "back panel knobs"; E&MM calls them "presets"). Shaft diameter and type (knurled or slotted) are unknown. | VERIFIED (no knobs, photo). Shaft type **TBC**. | photo above. Electrongate comparison page. |
| e3 | Pot value: the toms schematic shows a **10 kΩ** pot (with 1 kΩ in series). Snare and other pot values are not printed. Each pot is a plain divider between +5 V (D4) and GND (D5) giving 0–5 V to the 555 CV pin. | 10 kΩ toms: VERIFIED DX sch. 5. Snare 10 kΩ: **INFERRED.** 0–5 V: VERIFIED (E&MM 1983 "range 0-5V"). | |
| e4 | The pots sit on a **small PCB fixed behind the panel**. Two screws are visible between/below the pots (around the SNARE/BASS and TOMS/CYMBAL positions). The PCB connects to header D by an 8-wire harness. | VERIFIED (photos) | Rear photo. Photo WM. Photo EG-S. |
| e5 | Lower row: CLOCK IN, CLOCK OUT, TRIGGER INPUT, START, NEXT, MIX L/MONO/R, CLICK, then 6 direct outs (PERC … BASS). Each jack goes through the panel from the board-mounted jacks. | VERIFIED | Rear photo. Photo WM. |
| e6 | Free panel area near the SNARE pot. The rear photo shows a horizontal band about 20 mm high (scaled from the about 19 mm jack pitch, so **INFERRED**) between the tuning-pot row and the output-jack labels. **Candidate hole: directly below the SNARE tuning pot, centred in that band.** Second candidate: right of the BASS pot. No existing unused hole or blanking plug is visible. | INFERRED, **TBC** | Rear photo. Q6 in §i. |
| e7 | Panel material: black-painted steel or aluminium sheet. Thickness unknown. | **TBC** | Measure with calipers at a jack hole (Q6). |
| e8 | Free space **behind** the candidate hole: the tuning PCB may extend down to its mounting screws. The board-mounted jacks sit lower down. | **TBC** | Q6 |

---

## f. Power

| # | Fact | Tag | Source |
|---|---|---|---|
| f1 | Linear PSU on the main board, fed by an off-board transformer (95–130/190–260 VAC, 1/2 A slow-blow fuse, line filter). **+5 V:** bridge CR702 → **C723 10 000 µF 16 V** → **µA723 regulator (U727)** with an off-board **2N3055** pass transistor (connector F), current sense **R764 ∥ R765 (0.5 Ω each = 0.25 Ω)**, trimmer T701 sets the voltage. **+12 V:** 7812 (U728). **−12 V:** 7912 (U729), from a separate winding, bridge CR701, 470 µF C701/C702. **+5M:** the battery-backed RAM supply (2.9 V lithium B1 via D708/D709). | VERIFIED | DX sch. 3 |
| f2 | Rated mains input on the model label: **19 W** | VERIFIED | `photos/electrongate_dx_back_1a.jpg` (label "95-130 VAC OR 190-260 VAC, 50-60 HZ, 19 WATTS") |
| f3 | +5 V current limit ≈ 0.65 V / 0.25 Ω ≈ **2.6 A** (µA723 current-limit threshold). The actual +5 V load is probably about 1 A (NMOS Z80, up to 11 EPROMs, LS/CMOS logic). Adding ≤ 60 mA is a few % extra. | **INFERRED** | DX sch. 3 + typical datasheet values |
| f4 | Real headroom depends on the transformer and the unregulated rail sagging at mains minimum. | **TBC** | Q7 |
| f5 | **Do not** power anything from **+5M** (battery-backed memory rail). Only use **+5 V** (U701 pin 16 or the "+5 TEST PAD"). | VERIFIED (sch. 3 shows +5M feeds only RAM/decode) | DX sch. 3. DX sch. 1 (+5M on U715–U718, U724). |

---

## g. Existing comparable mods and products

| Item | What it is | Relevance | Tag |
|---|---|---|---|
| **Oberheim Stretch** (1985) | 4-voice DX expander. Connects with "two ribbon cables … plug into IC sockets on the DX main board" (6116 RAM socket and U722 socket). It also has 3 soldered power wires and 2 audio cables. | **Validates** the "plug into a DX IC socket with a ribbon" approach. It is Oberheim's own. | VERIFIED (Electrongate Stretch install page. Stretch sch. 3.) |
| **Electrongate DX MIDI upgrade** | MIDI board connected by a 40-pin ribbon plugged into the **Z80 socket U712**, plus replacement ROMs. "No soldering required!" | **Validates** socket-ribbon interposers on the DX. It shows the space above the CPU area (1/2" + 3/8" standoffs). **Possible conflict:** if installed, it occupies the space near U701. It also runs different firmware (DX 3.01, not analysed), so the RST2 timing may differ. | VERIFIED |
| **Electrongate DMX MIDI kit** | "Remove IC 20 (74C174 or 40174) from the DMX main board and install it in socket U3 on the MIDI board", connected by a ribbon into socket 20. | **Direct precedent**: the DMX's voice-trigger 74C174 relocated onto a daughterboard through its socket. This is the same idea as the TimeShift. | VERIFIED (`web-pages/electrongate_dmxfiles_dmx_midi_upgrade_install.html`) |
| **Electrongate DXX2** | Small board that plugs into a DX voice EPROM socket and adds sample switching | Another no-solder socket interposer on the DX | VERIFIED |
| **Doepfer A-162 Dual Trigger Delay** (Eurorack) | Analog trigger delay, 0–10 s range. **Time-based (ms), not tempo-synced.** | **Validates** brief §2: an analog delay cannot track "beats" | VERIFIED (retail spec pages; search result only, no file saved) |
| Per-track "timing shift" / "nudge" in later sequencers (e.g. Akai MPC "shift timing") | Software features | Conceptual precedent only | INFERRED (not researched in depth) |
| A per-voice trigger-delay hardware mod for the DX or DMX | **None found** | | VERIFIED as "not found" (§7 of INDEX) |

**Verdict:**
* The **digital, 96-PPQN, tempo-aware approach is validated**: the DX exposes a 96 PPQN
  clock, and the trigger lines are simple CMOS levels.
* The **card-edge interposer is contradicted** (no slots).
* The **socket-interposer replacement is validated** by three Oberheim/Electrongate
  precedents.

---

## h. Recommended pin mapping for the interposer (DX, U701 socket)

"Socket side" = the pins of the DIP-16 plug/pins that go into the main-board U701 socket.
"Chip side" = the DIP-16 socket on the TimeShift board that holds the original MC14174B.

| Pin | Net | Chip side ↔ socket side | TimeShift connection | Why |
|---|---|---|---|---|
| 1 | CLR̅ (+5 V) | **pass-through** | — | Keep the chip un-cleared |
| 2 | RST1 (bass) | **pass-through** | — | Bass untouched |
| 3 | D0 | **pass-through** | — | |
| 4 | D1 | **pass-through** | — | |
| 5 | FFA1 (bass) | **pass-through** | — | |
| 6 | D2 | **pass-through** | — | |
| 7 | FFB1 (bass) | **pass-through** | — | |
| 8 | GND | **pass-through** | **TimeShift GND** | Supply return. TBC voltage drop (Q7). |
| 9 | GEN0* (latch clock) | **pass-through** | optional high-impedance tap (do not load; keep the trace short) | Not needed by the recommended scheme. Useful for debugging. |
| 10 | **FFB2** | **INTERCEPTED**: chip pin 10 → MCU input `FFB2_IN` and mux input A. Mux output → socket pin 10. | MCU in + mux | Snare soft-level bit. Must be delayed together with RST2. |
| 11 | D5 | **pass-through** | — | |
| 12 | **FFA2** | **INTERCEPTED** (as pin 10) | MCU in + mux | Snare medium-level / sample-select bit |
| 13 | D4 | **pass-through** | — | |
| 14 | D3 | **pass-through** | — | |
| 15 | **RST2** | **INTERCEPTED**: chip pin 15 → MCU **INT0** (rising edge) + mux input A. Mux output → socket pin 15. | MCU INT0 + mux | Snare start/reset. The pulse is as short as about 9 µs. |
| 16 | +5 V | **pass-through** | **TimeShift +5 V** (≤ 60 mA) | Supply. Add a 10 µF bulk cap + 100 nF per IC on the TimeShift. |

Additional TimeShift connections (not on U701):
* `J_CLK` ← R791 lead at the Q709 collector (CLOCK OUT node): 10 kΩ series → Schmitt
  input → MCU timer/INT1. Rising edge = tick (see d4).
* `J_POT` ← new rear-panel 10 kΩ linear pot (+5 V / wiper / GND), as brief §3.4.
* `PPQN` jumper: 96 (default) / 48 / 24.

Mux behaviour (recommended): 74HC157, `S` = MCU output with a pull resistor to the
**bypass** state.
* Bypass: socket pins 10/12/15 = chip pins 10/12/15. This is used for pot = 0, during
  MCU reset, and when the MCU is unprogrammed.
* Delay: socket pins 10/12/15 = MCU outputs `FFB2_OUT`, `FFA2_OUT`, `RST2_OUT`.
* Switch the mux only while RST2 is low on both sides, so you never create a spurious
  edge.

**DXa equivalent:** the same scheme on **U715**. Intercept pins **7 (RST2), 5 (FFA2) and
2 (FFB2)**. Pass through 1, 3, 4, 6, 8–16. Pin 9 = GEN2*. **A board laid out for the DX
U701 pinout will NOT work in a DXa without re-mapping. Mark the PCB "DX (1721A) ONLY" or
add a jumper option.**

---

## i. Risks and open questions, ranked by impact (with the measurement that settles each)

| Rank | Question / risk | Impact if wrong | How to settle it (bench) |
|---|---|---|---|
| **Q0** | **Which model and ROM?** DX (1721A) vs DXa (1906), and any Stretch / Electrongate MIDI / sync-to-tape boards fitted. | Wrong chip/pins: the mod does nothing or corrupts the bass | Unplug mains. Remove the 2 front screws and open the lid. Photograph the whole main board. Read the silkscreen title (bottom centre: "OBERHEIM DX PROCESSOR BOARD"), the part marking at U701 (expect MC14174B/CD40174/74C174), and the labels on U713/U714 (e.g. "DX 1.4 A/B"). Check the rear for MIDI jacks. |
| **Q1** | **Is U701 socketed?** | If it is soldered, "no permanent change" is impossible: U701 must be desoldered and a socket fitted (a skilled job on a 40-year-old board) | Look along U701's sides with a torch. A socket shows a black plastic frame under the chip and the chip pins enter metal contacts, with no solder fillets on top. To confirm, lever the chip up 0.5 mm at each end with a small flat screwdriver *between chip and socket*, then press it back. |
| **Q2** | **Real trigger waveform on RST2 / FFA2 / FFB2** (pulse width, edge order, level code, any extra edges). | Wrong replay timing or wrong volume | Logic analyser (≥ 4 MHz sample rate). Clip (Pomona 5250 DIP-16 test clip) onto U701 with the chip in place. Probes: pin 9 (GEN0*), 15 (RST2), 12 (FFA2), 10 (FFB2), and pin 2 (RST1) for reference. Record: (a) SNARE SOFT, MEDIUM, LOUD pads ×3 each; (b) a pattern with bass and snare on the same step; (c) bass alone (expect **no** edges on pins 10/12/15). Expected: three GEN0* pulses per trigger; RST2 high ≈ 9 µs (FW 1.5) to ≈ 0.2 ms (FW 1.20); levels per b3. |
| **Q3** | **Vertical clearance** above U701 with the lid closed, and conflicts with the sync-to-tape / MIDI boards | Decides between Option A (stacked) and Option B (ribbon) | Put a 10 mm ball of modelling clay on top of U701, close the lid gently, open it, and measure the squashed height with calipers. Also measure the free height above the planned TimeShift mounting area. Photograph any boards above or next to U701. |
| **Q4** | **GEN0* integrity through a ribbon** (Option B). GEN0* is an edge-sensitive clock. A long ribbon could ring or double-clock U701 and corrupt *bass* triggers too. | Random bass/snare glitches | With the TimeShift fitted in bypass mode, scope U701 pin 9 at the chip side (≥ 100 MHz scope, short ground lead): look for clean edges with no re-crossing of 2.5 V. Then run a busy pattern for 10 min and listen for missing or extra hits. Keep the ribbon ≤ 15 cm. If needed, re-buffer GEN0* with a 74HC14 on the TimeShift. |
| **Q5** | **Clock tap behaviour**: polarity, pulse width, PPQN, and **present when stopped?** | Wrong tempo or no tempo when the sequencer is stopped | Scope at the R791/Q709-collector node (= CLOCK OUT tip) with the DX stopped, then playing at 120 BPM. Expect a rising edge every 5.21 ms at 120 BPM (96 PPQN), high for about 0.85 ms or more. On DXa/Stretch/MIDI units check edit parameter 03 (Clock Out Rate) and set it to 96. Record whether pulses continue when stopped. |
| **Q6** | **Rear-panel drill location**: space behind the panel (tuning PCB edge, jack bodies, harness), panel thickness, existing pot shaft type/diameter | Drilling into the tuning PCB or a jack | With the lid open, look behind the SNARE tuning pot. Measure from the rear panel's inside face to the nearest obstruction around the candidate point (directly below the SNARE pot, centred between the pot row and the output-jack labels). Measure panel thickness with calipers at a jack hole. Measure the existing pot shaft diameter and length. Mark the hole only after confirming ≥ 25 mm free depth and ≥ 12 mm radius free around it. |
| **Q7** | **+5 V headroom and supply via U701 pins 16/8** | Brown-out or noise on the DX logic | Measure +5 V at the "+5 TEST PAD" and at U701 pin 16 with the TimeShift running and the DX playing a dense pattern. Expect ≥ 4.85 V and < 50 mV difference between the two points. Scope the ripple minimum on C723 (+) (unregulated): it should stay ≥ 3 V above the +5 V output at the lowest mains you expect. |
| **Q8** | **Firmware variants not analysed** (DX 1.4 in Photo WM, DX 3.01 Electrongate, DXa 2.02 uses port 70h) | Different pulse widths or edge orders | Covered by Q2. Make the TimeShift firmware tolerate RST2 high pulses from 1 µs to 5 ms and any FFA/FFB order. |
| **Q9** | **Behaviour at stop/start and with large delays.** Snares queued before STOP still play after STOP. Delays close to 1 beat overlap the next snare. | Musical surprise, not damage | Document it in the user guide. Firmware option: flush the queue when no clock has been seen for > 125 ms (the DX's own auto-stop threshold, OM2 p32). |
| **Q10** | **Level semantics for delayed hits on the DX (1721A)**: FFA2/FFB2 also act as async resets while a delayed earlier snare is still sounding. | A level change may affect a still-ringing delayed snare differently from stock | Faithful replay of the full 3-line history (c3) gives the stock behaviour shifted in time. Verify by ear with SOFT then LOUD snares one 16th apart at 1-beat delay. |

---

## Appendix A: timing diagram (one snare hit, DX, FW 1.5 timing)

```
GEN0* (U701-9)  ‾‾‾‾\_/‾‾‾‾‾‾‾‾\_/‾‾‾‾‾‾‾‾\_/‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾
                     w1          w2          w3
FFA2/FFB2       ====X new level =====================================(held)======
RST2 (U701-15)  ________________/‾‾‾‾‾‾‾‾‾‾‾\_____________________________________
                                 ≈ 9 µs (FW 1.5) / ≈ 0.2 ms (FW 1.20)
U204 FFs        clocked at RST2 ↑ (DX only)
CD4040 counter  ...running/stopped...|held at 0|>> counting: SNARE SOUND STARTS ↓
```

TimeShift output (delay D): the same waveform on socket pins 10/12/15, D later.
RST2 high is regenerated as ≥ 10 µs.

## Appendix B: method for the firmware analysis (reproducible)

1. Download `DX130A.BIN`+`DX130B.BIN` and `DX15A.BIN`+`DX15B.BIN` from
   https://www.electrongate.com/dmxfiles/ (links on
   https://www.electrongate.com/obfiles/osimages.html). Each file is 8192 bytes.
2. Concatenate A+B. `z80dasm -a -l -g 0 -t file.bin > file.asm`. This only reads the
   bytes and never runs them. ROM B is mapped at CPU address 6000h (U723 74LS139 decode,
   DX sch. 1), so `CALL 68F4h` refers to file offset 28F4h.
3. Search for `out (010h)`, `ld c,010h` and `out (c),a` to find the voice-latch writer:
   FW 1.20 15C2h–1654h (ROM A, the CPU address is the same), FW 1.5 file offsets
   28A8h–297Fh (ROM B, CPU addresses 68A8h–697Fh).
4. Tempo ISR: `RST 38h` → `JP 1BF1h` (FW 1.20). COUT is bit 5 of the port-50h shadow at
   20ABh: cleared at 1BF7h, set at 1F0Bh. Tempo: preset written to port 30h. The display
   formula is `6000/(N+1)` (constant 1770h at 09FAh), clamped to 17h…EFh.

## Appendix C: what could NOT be found

* No typed DX service manual (theory of operation, test procedure, DX-specific parts
  list) is online. MusicParts sells one ($35), contents unknown, not purchased.
* No formal written "Oberheim System" clock electrical spec. The closest are the DMX
  owner's manual specs (5 V positive pulse, TTL) and the DX manual (96 PPQN).
* No photo or drawing that shows the **vertical clearance** above U701 with the lid
  closed, the **rear-panel internal depth**, the **panel thickness** or the **tuning-pot
  part number**.
* No JL Cooper / Forat DX retrofit documentation.
* The DXa factory firmware 2.02 and the Electrongate 3.01 firmware were not analysed for
  RST2 timing.
