# docs/reference/ — index of collected Oberheim DX technical documents

All files were fetched on **2026-11-06** by the research agent. They are third-party
documents kept here **for reference and repair/modification research only**. They are
untrusted data: nothing in this folder is executed.

**Copyright.** The Oberheim schematics, manuals and layouts are © Oberheim Electronics Inc.
(1981–1985) or its successors (ECC Development Corp. for the 1985 "Stretch" drawings).
They are widely circulated as service information for a discontinued product, but they
are not public domain. The Electrongate photos and web pages are © Paul J. White /
Electrongate. Wikimedia Commons photos are under the Creative Commons licences listed.
The E&MM review is © its publisher (archived by muzines.co.uk). **Before you make this
GitHub repository public, check whether you may redistribute these files. If in doubt,
remove the binaries and keep only this index with its URLs.**

How to read the citations in `docs/research/dx-findings.md`:
* "DX sch. sheet N" means the 7-sheet **DX Processor Board schematic, drawing 1721A**.
  You can find it as page N+2 (sheet 1 = page 3) of `oberheim-dx_archive-org_Oberheim_DX.pdf`, or as
  `electrongate/dx_proc_N_of_7.jpg`. Both are the same scans.
* "DXa sch. sheet N" means drawing **1906** (DX "A", the version with factory MIDI):
  `electrongate/dxa_pN.jpg`.
* PDF page numbers are the page number shown in a PDF viewer. They are not the page
  number printed on the paper.

## 1. Oberheim DX: primary service documents (schematics and layouts)

| File | Title / contents | Source URL | Notes |
|---|---|---|---|
| `oberheim-dx_archive-org_Oberheim_DX.pdf` | 14-page scan. PDF p1: **DX Switch Board schematic 1722A** (front-panel buttons, LEDs, display, volume sliders, mixer). p2: **Parts layout, DX Pot Board Rev C**. p3: **DX Processor Board sch. sheet 1 of 7** (Z80, ROM/RAM, I/O decode, **voice trigger latches U701–U703**, clock in/out, tempo timer; Rev A "Initial release 5-15-83"). p4: sheet 2 (cassette, click out, power-up reset). p5: sheet 3 (power supply). p6: sheet 4 (**BASS and SNARE voices**). p7: sheet 5 (hi-hat, toms). p8: sheet 6 (cymbal). p9: sheet 7 (perc). p10: **Parts layout, DX Processor Board Rev C**. p11–13: **Stretch Processor Board schematic 1961**, sheets 1–3 (Oberheim, Div. of ECC Dev. Corp., 1985). p14: Stretch parts layout. | https://archive.org/details/Oberheim_DX (file https://archive.org/download/Oberheim_DX/Oberheim_DX.pdf) | Image-only scan, no text layer. **This is the most important document in the folder.** There is no separate "DX service manual" text in it, only drawings. |
| `electrongate/dx_proc_1_of_7.jpg` … `dx_proc_7_of_7.jpg` | DX Processor Board schematic 1721A, sheets 1–7. Same scans as above, as separate JPEGs. | https://www.electrongate.com/obfiles/ (e.g. https://www.electrongate.com/obfiles/dx_proc_4_of_7.jpg) | Same pixel dimensions as the archive.org pages. |
| `electrongate/dx_proc_board_layout.jpg` | Parts layout, DX Processor Board Rev C | https://www.electrongate.com/obfiles/dx_proc_board_layout.jpg | |
| `electrongate/dx_pot_board.jpg` | DX Switch Board schematic 1722A | https://www.electrongate.com/obfiles/dx_pot_board.jpg | |
| `electrongate/dx_pot_board_layout.jpg` | Parts layout, DX Pot Board Rev C (front panel) | https://www.electrongate.com/obfiles/dx_pot_board_layout.jpg | |
| `electrongate/dxa_p1.jpg` … `dxa_p6.jpg` | **DX "A" Processor Board schematic 1906**, sheets 1–6 (the DXa with factory MIDI). Sheet 1 has the voice latches **U713–U715** (bit/pin assignment differs from the DX). Sheet 4 is bass and snare. | https://www.electrongate.com/obfiles/dxa_p1.jpg … dxa_p6.jpg | Higher resolution (about 3300×2500). The voice circuit differs from the DX: there are no U204 flip-flops, and FFA/FFB drive the level diodes directly. |
| `electrongate/dxa_p7.jpg` | DXa switch board schematic | https://www.electrongate.com/obfiles/dxa_p7.jpg | |
| `electrongate/str1.jpg`, `str2.jpg`, `str3.jpg`, `strparts.jpg` | Stretch (4-voice DX expander) schematic sheets 1–3 and parts layout | https://www.electrongate.com/obfiles/str1.jpg etc. | Same as archive PDF p11–14. Useful as a precedent: the Stretch connects by **ribbon cables plugged into IC sockets on the DX main board**. |

## 2. Oberheim DX: owner's manuals and contemporary literature

| File | Title / contents | Source URL | Notes |
|---|---|---|---|
| `oberheim-dx-owners-manual-2nd-ed_archive-org.pdf` | **Oberheim DX Owner's Manual, Second Edition, January 1985** (43 pp., OCR text layer). Covers the DX and the DXa (MIDI) features. Rear-panel drawing on PDF p7. Tempo 25–250 BPM on p12. Voices and "three volume levels" on p15. Quantize down to 1/192 on p18. Timing source and clock-out rate (24/48/96 PPQN) on p24–25 and p32–33. Auto-start (125 ms) on p32. | https://archive.org/details/oberheim-dx-owners-manual-2nd-ed (file "Oberheim DX Owner's Manual 2nd Ed.pdf"). Also mirrored at https://www.electrongate.com/dmxfiles/OberheimDXUserManual2ndEd.pdf | archive.org lists the source as bruynooghe.fr. |
| `oberheim-dx-owners-manual-1st-ed_archive-org.pdf` | Oberheim DX Owner's Manual, 1st edition (50 pp., image scan via ManualsLib) | https://archive.org/details/oberheim-dx-owners-manual | The PDF title says "ManualsLib". Very little text layer. |
| `oberheim-stretch-dx-brochure-1987_audiofanzine.pdf` | "Expander for Oberheim DX drum machines" Stretch DX brochure (2 pp.). Says the Stretch adds variable clock rates of 24/48/96 PPQN and MIDI clock out to non-MIDI DXs. | https://medias.audiofanzine.com/files/obstretch87-476880.pdf | |
| `web-pages/muzines_EMM_1983-09_oberheim-dx-review.html` | Electronics & Music Maker, Sept 1983, "Oberheim DX" review by Paul Wiffen, with Marcus Ryle (Oberheim). Says the clock is 96 PPQN, the tuning pots on the back give 0–5 V to "a connector on the board", there are three snare levels, and a retrigger cuts off the previous sound. | https://www.muzines.co.uk/articles/oberheim-dx/6156 | Saved HTML page (contains site scripts; do not open in a browser with scripts enabled if concerned). |

## 3. Oberheim DMX (the DX's predecessor, which has separate voice cards)

| File | Title / contents | Source URL | Notes |
|---|---|---|---|
| `oberheim-dmx-service-manual_archive-org.pdf` | **Oberheim DMX Service Manual, March 1982** (66 pp.). Theory of operation: the processor at 2.456 MHz (PDF p7) and the **voice cards with two trigger inputs TR0/TR1** (PDF p11). Connector diagrams on PDF p20. Parts lists show the voice cards use **Molex KK 3061/3081 6- and 8-pin PC-mount headers** (PDF p26–29). Schematics and layouts. | https://archive.org/details/Oberheim_DMX_Service_Manual | Relationship: the DX is a cost-reduced DMX. The DMX voice-card circuit (555 → 4040 → EPROM → AM6070 DAC) was moved **onto the DX main board**. The DX has **no** voice cards. |
| `oberheim-dmx-schematics_synthfool.pdf` | Oberheim DMX schematics (9 sheets) | https://synthfool.com/docs/Oberheim/Oberheim_DMX_Schematics.pdf | Image only. archive.org has the same set as JL11363, "Oberheim DMX Schematics (81-12-21)". |
| `oberheim-dmx-owners-manual_synthfool.pdf` | Oberheim DMX Owner's Manual rev 3 (39 pp.). The specifications on PDF p39 give "EXTERNAL CLOCK INPUT: 5 Volt positive pulse, TTL compatible" and "EXTERNAL CLOCK (out): TTL compatible". | https://synthfool.com/docs/Oberheim/Oberheim_DMX_Owners_Manual.pdf | This is the closest thing found to a written electrical spec for the Oberheim 96 PPQN clock. |
| `electrongate/dmx_proc_1of3.jpg`, `_2of3`, `_3of3`, `dmx_proc_fab.jpg` | DMX processor board schematic and fab layout | https://www.electrongate.com/obfiles/ | |
| `electrongate/dmx_bass.jpg`, `dmx_mkii.jpg` | DMX bass voice card and Mark II voice card schematics | https://www.electrongate.com/obfiles/dmx_bass.jpg, …/dmx_mkii.jpg | For comparison with the DX on-board voices. |
| `electrongate/dsx_sch4.png`, `dsx_sch6.png` | DSX early sync circuit and DSX rear panel (clock in/out wiring), 1981 | https://www.electrongate.com/obfiles/dsx_sch4.png, …/dsx_sch6.png | Background on the Oberheim System clock. The DSX Service Manual (38 MB) was **not** downloaded: https://www.electrongate.com/obfiles/DSX/DSXServiceManual.pdf |

## 4. Photos

| File | Contents | Source URL | Licence / notes |
|---|---|---|---|
| `photos/wikimedia_Oberheim-DX_processor_board.jpg` | **High-res (4995×3744) photo of a DX processor board** inside the case, with ROMs "DX 1.4", the Oberheim "DX SYNC-TO-TAPE" board 1760B, the rear jacks, the tuning-pot harness and the transformer. U701–U703 are **Motorola MC14174BCP** and appear to sit in DIP sockets. The snare EPROM U206 is labelled "DX SNARE 64" (MBM2764) and is socketed. | https://commons.wikimedia.org/wiki/File:Oberheim-DX_processor_board.jpg | CC BY-SA 3.0, by User:Autopilot, 2011-11-12 |
| `photos/wikimedia_Oberheim_Stretch_DX.jpg` | Stretch DX front panel (BASS/SNARE … buttons labelled SOFT/MEDIUM/LOUD) | https://commons.wikimedia.org/wiki/File:Oberheim_Stretch_DX.jpg | CC BY-SA 4.0, Alison Cassidy, 2020 |
| `photos/wikimedia_Oberheim_DX.jpg` | DX front view | https://commons.wikimedia.org/wiki/File:Oberheim_DX.jpg | CC BY-SA 1.0, Sylvain87 |
| `photos/electrongate_dx_back_1a.jpg` | **DX rear panel**, small (520×139). Shows DRUM TUNING pots with no knobs, left to right from the rear: PERC, CYMBAL, TOMS, HI-HAT, **SNARE**, BASS. Also CLOCK IN/OUT, TRIGGER INPUT, footswitches and outputs. The model label reads "95-130 VAC OR 190-260 VAC, 50-60 Hz, 19 WATTS". | https://www.electrongate.com/dmxfiles/images/websize/dx_back_1a.jpg | © Electrongate |
| `photos/electrongate_dx_front_1a.jpg` | DX front view | https://www.electrongate.com/dmxfiles/images/websize/dx_front_1a.jpg | © Electrongate |
| `photos/electrongate_stretch_w_midi_installed.JPG` | High-res (4288×2848) DX + Stretch + Electrongate MIDI board installed. Shows main-board layout, ribbon cables into IC sockets, rear-panel internals and the U701 row. | https://www.electrongate.com/dmxfiles/images/stretch_w_midi_installed.JPG | © Electrongate |
| `photos/electrongate_dxa_bass_mod.jpg` | Close-up of a **DXa** board (AM6072 DACs, CD4013 that appears to be soldered rather than socketed) | https://www.electrongate.com/dmxfiles/images/dxa_bass_mod.jpg | © Electrongate |
| `photos/electrongate_dx_*.jpg` (screws_to_remove, eprom_removal_1/2, z80_eproms_out, new_eproms_in, new_standoffs_1, install_pcb_1, board_installed_3, midi_board) | Electrongate DX MIDI upgrade installation steps. These show that **the Z80 (U712) and ROMs (U713/U714) are socketed**, and that a ribbon with a 40-pin DIP plug goes into the Z80 socket. The board stands on 1/2" + 3/8" standoffs above the main board. | https://www.electrongate.com/dmxfiles/dxmidi_installation.html (images under …/images/websize/) | © Electrongate |
| `photos/electrongate_DXX2_in_place_sm.jpg` | DXX2 EPROM switcher boards plugged into DX voice EPROM sockets | https://www.electrongate.com/dmxfiles/dxx2.html | © Electrongate |
| `photos/electrongate_stretch_*.jpg` | Stretch installation: ribbon cables plugged into DX main-board IC sockets, power wires, audio cables | https://www.electrongate.com/obfiles/stretch/index.html | © Electrongate ("Thanks to G-Man for the photos") |

## 5. Saved web pages (HTML, for the record)

| File | Source URL | What it contributes |
|---|---|---|
| `web-pages/electrongate_dmxfiles_comparison.html` | https://www.electrongate.com/dmxfiles/comparison.html | DMX vs DX table. Includes "Removable voice cards: DMX Yes / **DX No**" and "Tuning: DX = back panel knobs". |
| `web-pages/electrongate_dmxfiles_dx_faq.html` | https://www.electrongate.com/dmxfiles/dx_faq.html | DX / DXa / Stretch DX variants. The battery is soldered. Some units have a factory bass-boost wire. |
| `web-pages/electrongate_dmxfiles_dxmidi_installation.html` | https://www.electrongate.com/dmxfiles/dxmidi_installation.html | **Precedent:** a no-solder DX upgrade made by plugging into IC sockets (Z80 U712, ROMs U713/U714, RAMs U715–U718, U722). |
| `web-pages/electrongate_dmxfiles_dxmidiupgrade.html` | https://www.electrongate.com/dmxfiles/dxmidiupgrade.html | MIDI upgrade description (adds MIDI clock and "additional clocking options"). |
| `web-pages/electrongate_dmxfiles_dxx2.html` | https://www.electrongate.com/dmxfiles/dxx2.html | DXX2 board that sits in a voice EPROM socket |
| `web-pages/electrongate_dmxfiles_eproms.html` | https://www.electrongate.com/dmxfiles/eproms.html | EPROM image list (DX snare is a 2764) |
| `web-pages/electrongate_obfiles_stretch_install.html` | https://www.electrongate.com/obfiles/stretch/index.html | Stretch install: "The cables plug into IC sockets on the DX main board." |
| `web-pages/electrongate_obfiles_osimages.html` | https://www.electrongate.com/obfiles/osimages.html | List of DX operating-system ROM images (see §6) |
| `web-pages/electrongate_dmxfiles_dmx_midi_upgrade_install.html` | https://www.electrongate.com/dmxfiles/midi_upgrade_install.html | **Precedent:** the DMX MIDI kit moves the voice-trigger 74C174 latch (IC 20) onto a daughterboard through a ribbon plugged into its socket |

## 6. Firmware images: analysed, NOT stored in this repository

The DX operating-system ROM images on Electrongate were downloaded **to a temporary
scratch folder only**. They were **disassembled statically** with `z80dasm`, as data; the
ROM code was never run. They are not stored here because they are copyrighted program
code. URLs:

* https://www.electrongate.com/dmxfiles/DX130A.BIN + DX130B.BIN ("DX 1.30 for standard DX". The header string inside says "DX1.20 [C]1983 OBERHEIM".)
* https://www.electrongate.com/dmxfiles/DX15A.BIN + DX15B.BIN ("DX 1.5 for standard DX", displays 2.02, no MIDI)
* https://www.electrongate.com/dmxfiles/DX202A.BIN + DX202B.BIN ("DX 2.02, DX with factory MIDI" = DXa)
* https://www.electrongate.com/dmxfiles/DX301A.BIN + DX301B.BIN (Electrongate MIDI upgrade): **not analysed**

The findings derived from them (the 3-write trigger sequence, the RST pulse width, and
the tempo-timer formula) are in `docs/research/dx-findings.md` §c and §d.

## 7. Searched for but NOT found

* A typed **DX service manual** (theory of operation, test procedure, connector pin
  lists) like the DMX one. Only the DX drawings exist online. MusicParts sells a paid "DX
  service manual" ($35, https://www.musicparts.com/), contents unknown; it was not bought.
* A **DX voice-card schematic**: no such thing exists, because the DX has no voice cards
  (see the comparison page and the layout drawing).
* A formal written **"Oberheim System / parallel bus" clock specification**. The 96 PPQN
  standard is stated in the DX owner's manual (2nd ed., PDF p32) and the E&MM review.
  The electrical level ("TTL compatible, 5 V positive pulse") is stated only in the DMX
  owner's manual specs (PDF p39).
* JL Cooper / Forat DX MIDI retrofit documentation: not found online. The Electrongate
  DX MIDI upgrade pages were used instead.
* A **"DX Stretch" software note**. The Stretch brochure and schematics were found. The
  Stretch is a 4-voice hardware expander, not a timing-stretch feature.
* Any existing **per-voice trigger-delay mod for the DX or DMX**: none found.
