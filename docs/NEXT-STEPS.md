# Next steps (project parked 2026-11-06)

**Where you are in the process:** this file is for whoever resumes the project, human or agent.
It lists what is finished, what was stopped early, and the exact brief to finish it.

## 1. State at archive time

Complete and verified:

* Research with citations: `docs/research/dx-findings.md`
* Design brief (locked interface): `PROJECT_BRIEF.md`
* TimeShift board rev A: KiCad project, ERC/DRC clean, Gerbers checked in an independent viewer
  (`hardware/`), independent review in `docs/review/design-review-revA.md` (verdict: ready for
  fabrication)
* Firmware with 150 passing simulation checks and a prebuilt hex (`firmware/`)
* Technician documents 00 to 05, BOM, mechanical drawings
* Web walkthrough, live at <https://jacksondelahunt.com/oberheim-dx-timeshift/>, v2 DX model default

Owner facts recorded in the docs: the unit is a plain DX (not a DXa); the owner had the voice
chips socketed after purchase; U701 still needs the one-minute torch check (findings Q1).

Not started on the hardware side: nothing has been measured on the real DX yet. The mandatory
bench checks are in `docs/05-bench-verification.md`.

## 2. Stopped early: Option B, the EPROM-delay package (main open item)

**Idea.** Instead of the TimeShift board, burn a copy of the snare sample EPROM (U206, a socketed
2764 marked "DX SNARE 64") with a block of silence in front. The snare then plays late by a fixed
number of sample clocks. No PCB, fully reversible by swapping the original chip back. The tuning
pot keeps working; the lag shrinks slightly when the snare is tuned up. Limits: fixed milliseconds,
not tempo-locked; roughly 20 to 60 ms of lead-in before the snare tail is cut, about 200 ms if the
SJ2/SJ3 solder jumpers are moved so the counter plays the full 8 KB. Variant: a 27C256 on a 28-pin
adapter holding four 8 KB images, bank-selected by pins 26 (A13) and 27 (A14) wired to a small
rear-panel switch, giving four selectable lags without opening the lid.

**What exists.** Only the paragraph "Option B" in `README.md`. No files under `eprom-delay/`.

**One finding from the stopped agent, worth keeping.** Electrongate's DX/DMX pages state that
zero-filled EPROM space plays as silence on these machines and that erased 0xFF does not. Verify
against the AM6070 coding before relying on it; the generator script should still derive the idle
code from the dump's own tail and allow an override.

**Circuit facts already verified (findings c1):** U209 NE555 = sample clock, set by the rear
tuning pot via pin 5. U208 second half divides by 2 (SA0) and clocks U207 CD4040 (SA1 to SA12).
End of sample: U208 first half ("SCARRY") clocked by SA11 or SA12 via jumper SJ3; SCARRY disables
the EPROM (pins 20/22, via SJ2) and stops the divider. U204 "FFA" Q drives EPROM A11 via SJ2
(sample-half select), so loud and soft hits may read different halves. U206 feeds U205 AM6070
companding DAC, then U202 TL082.

### Brief for the agent that resumes this

Work in this repo. Do not touch `webapp/` or the existing docs other than the two pointers named
in step 5. Tone and style as in `docs/00-start-here.md`: short sentences, VERIFIED / INFERRED /
TO BE CONFIRMED tags, no em-dashes.

1. **Facts table in `eprom-delay/README.md`**, each row tagged, with citations to
   `docs/reference/oberheim-dx_archive-org_Oberheim_DX.pdf` sheet 4 (snare) and the images in
   `docs/reference/electrongate/`:
   (a) U206 pinout as wired: which address pins come from the counter (SA0 to SA12), which from
   FFA via SJ2, what SJ1/SJ2/SJ3 do and their factory positions if determinable;
   (b) end-of-sample mechanism and therefore how many samples play per hit as factory jumpered;
   (c) sample clock: compute the NE555 astable range from the sheet 4 component values and the
   pot action on pin 5; give best estimate and range in samples/s and ms per 1024 samples;
   (d) AM6070 input coding and the silence byte (sign-magnitude mu-law; discuss 0x00 / 0x80 /
   0x7F / 0xFF; the script derives the idle code from the dump and allows override);
   (e) 2764 vs 27C64 vs AT28C64B vs 27C256 pin differences in a 2764 socket (pins 1, 26, 27, 28),
   which are drop-in for reading, and what the DX ties 2764 pin 1 (VPP) to;
   (f) the FFA half-select interaction: both halves must get the same lead-in.
2. **`eprom-delay/tools/dxdelay.py`** (Python 3, stdlib only, run with `python3 -I`). Input: the
   dumped 8 KB U206 image. Options: `--delay-ms` or `--delay-samples` lists, `--sample-rate`
   (default = the estimate from 1c, printed loudly as an assumption), `--idle` override,
   `--half-size` (default 4096), `--full8k` for the SJ3=SA12 configuration, `--bank` to pack four
   8 KB images into a 32 KB 27C256 image in a chosen order. Outputs: `.bin` files and a `.txt`
   report (truncation, idle code, CRC32). Must analyse the dump (per-half statistics, idle code
   from the tail, warn if the tail is not quiet, estimate where the audible snare ends), prepend
   idle bytes and truncate the tail only inside the sample region, and refuse to cut into loud
   material unless `--force`. Include `--selftest` with a synthetic decaying noise burst; it must
   pass. Usage examples and selftest output in `eprom-delay/tools/README.md`.
3. **`eprom-delay/adapter/`**: wiring diagram (SVG + PNG, generator script in the house style of
   `hardware/mechanical/tools/svgkit.py`) for the banked variant: 27C256 in a machined-pin
   socket with pins 26 and 27 isolated and wired through pull-ups to a two-pole switch (or two
   toggles; justify the choice), the other 26 pins straight into the U206 socket, pin 1 handling
   per fact 1e, decoupling, and the switch position to bank to delay table. Note lid height (TBC)
   and a rear-panel location for the switch (reuse the pot-hole study in `hardware/mechanical/`).
   BOM with Digi-Key and Mouser numbers, unverified ones marked.
4. **`eprom-delay/bom.md`**: programmer (TL866II Plus / T48, noting 2764 / 27C64 / 27C256 /
   28C64 support), blank chips (27C64 OTP or UV, AT28C64B, 27C256 OTP), UV eraser if needed,
   labels, anti-static tubes. Prices and links, unverified ones marked.
5. **`docs/06-eprom-delay-option.md`**: technician procedure in the style of docs 02 to 04. When
   to choose this over the TimeShift board; safety; step 1 dump the original U206 and keep it in a
   labelled anti-static tube forever; step 2 run the script; step 3 burn and verify; step 4 fit and
   test (tail truncation, clicks at the start mean a wrong idle code); the banked variant; a results
   form; the TBC list (measure the sample clock at U209 pin 3 with a scope, record SJ jumper
   positions, confirm the idle code). Then replace the "Option B" paragraph in `README.md` with a
   link to this doc and add a row to its reading-order table, and add a short "Two ways to do
   this" note near the top of `docs/00-start-here.md`.
6. Verify every circuit claim against the drawings; tag anything unverifiable TBC with the exact
   measurement. Render the SVG and look at it. Report the facts table, the sample-rate estimate and
   its basis, and anything not verified.

## 3. Stopped early: small polish on the v2 DX model (optional)

The v2 model (`webapp/src/dxModelV2.ts`) is the default and all 18 stages run on it. Not done:
a final label-placement check on stages 6 to 12, 14, 17 and 18 against the v2 geometry (the
agent checked 1 to 5, 13, 15, 16), one last side-by-side with
`docs/reference/photos/wikimedia_Oberheim_DX.jpg`, and the missing v1 comparison screenshots for
stages 15 and 16. Run `corepack pnpm screenshots` in `webapp/` (pnpm is not on PATH; use
corepack). The screenshot script takes `--dx v1|v2`.

## 4. Things an owner or technician may want to decide

* Fabricate the TimeShift board (JLCPCB, 5 boards, upload `hardware/gerbers/timeshift-revA-gerbers.zip`
  with the settings in `hardware/gerbers/README.md`) or try Option B first.
* Redistribution of the third-party material in `docs/reference/` now that the repo is public
  (see `docs/reference/INDEX.md` and `LICENSE.md`).
* The Sketchfab "Oberheim DX" model by Rusted Moon is not downloadable and was not used; a draft
  permission request is in the project chat history. The v2 model needs no permission.
