# DX TimeShift rev A: bill of materials (one unit)

Everything you need to build **one** DX TimeShift, wire it into an Oberheim DX (board 1721A)
and fit the SNARE DELAY pot. Board part numbers and reference designators match
`hardware/kicad/tools/netlist.py` and PROJECT_BRIEF.md §3.5. The machine-readable version is
[`bom.csv`](bom.csv), which you can import into Mouser's BOM tool or a Digi-Key myList.

Prices are qty-1 estimates in US dollars, checked on **2026-11-06**. They change, so check them
when you order.

## How to read the part-number columns

| Tag | Meaning |
|---|---|
| `number` (no tag) | Seen on that distributor's own product page or search result for this exact MPN. |
| `number` (aggregator) | The number came from Octopart, Findchips or a similar site, not from the distributor's own page. It is almost certainly right, but stock and price may be out of date. |
| `number` **UNVERIFIED** | Our best guess at the distributor's number (it follows their usual pattern). **Search the MPN before ordering.** |
| not found | We could not find this exact part at that distributor. Order it from the other one, or use the alternative in the notes. |

Mouser's product pages could not be opened by our tools, so **every Mouser number is at best
"aggregator"**. All Digi-Key numbers were read from the live Digi-Key pages.

## Buy it as a kit

* **Simplest: one Digi-Key order.** Every part in sections A to C has a verified Digi-Key number
  (only the Brother label tape is not stocked). Upload `bom.csv` to Digi-Key's BOM Manager or a
  myList, then delete the rows marked `in_total = no` that you don't want.
* **The one problem with Digi-Key:** it only sells the JST SXH-001T-P0.6 crimp contacts as a strip
  of 1000. Either add 10 single contacts from Mouser (`306-SXH-001T-P0.6`), or skip crimping and
  buy 5 pre-crimped JST leads (`ASXHSXH22K305`, Digi-Key `455-3241-ND`). Cut one end off each to
  get five 300 mm leads, then mark the colours with heat-shrink.
* **Mouser-only order:** possible for the ICs, sockets, headers, resistors, capacitors, crimps,
  Nano and test clips. The pot (P160KNP), the DIP-16 IDC plug, the adhesive PCB supports and the
  heat-shrink kit were **not found at Mouser**, so you'd need a second source for those.
* **Bare PCB:** order from any PCB fab using `hardware/gerbers/` (2-layer, 84.0 × 63.0 mm,
  2 mm corner radius, 4 × M3 holes on 77.0 × 56.0 mm centres). The usual minimum order is 5 boards.
* **The U1 chip is not bought.** U1 is the DX's own MC14174B (U701), moved onto the TimeShift.
* **Cheaper build:** a 5 V / 16 MHz ATmega328P Nano clone (about $5) instead of the genuine
  Arduino, plus wire, heat-shrink and label tape you already have, brings the cost down to about **$40–50**.

## Cost summary (estimates, USD, one unit)

| Section | Estimate |
|---|---|
| A. TimeShift board | $50.63 |
| B. DX plug cable (J1 to U701 socket) | $5.10 |
| C. Panel pot and wiring | $56.37 |
| **Total, sections A–C (genuine Nano, full wire / heat-shrink kits, label tape)** | **$112.10** |

Shipping and tax are not included. Options in section D and tools in section E are not in the total.

## Parts list

### A. TimeShift board

| Ref | Qty | Description | Manufacturer / MPN | Mouser | Digi-Key | Unit $ | Ext $ | Notes |
|---|---|---|---|---|---|---|---|---|
| U2 | 1 | Arduino Nano v3, ATmega328P, 5 V / 16 MHz, Mini-B USB | Arduino [A000005](https://www.digikey.com/en/products/detail/arduino/A000005/2638989) | `782-A000005` (aggregator) | `1050-1001-ND` | 25.70 | 25.70 | A 5 V / 16 MHz ATmega328P Nano clone (about $5) works the same. Fitted in 2 x 1x15 female headers. |
| U3 | 1 | 74HC157 quad 2:1 multiplexer, DIP-16 | Texas Instruments [SN74HC157N](https://www.digikey.com/en/products/detail/texas-instruments/SN74HC157N/277224) | `595-SN74HC157N` (aggregator) | `296-1578-5-ND` | 1.54 | 1.54 |  |
| U4 | 1 | 74HC14 hex Schmitt-trigger inverter, DIP-14 | Texas Instruments [SN74HC14N](https://www.digikey.com/en/products/detail/texas-instruments/SN74HC14N/277223) | `595-SN74HC14N` (aggregator) | `296-1577-5-ND` | 1.15 | 1.15 |  |
| U1 (socket), U3 (socket) | 2 | IC socket DIP-16, 7.62 mm, through-hole | TE Connectivity [1-2199298-4](https://www.digikey.com/en/products/detail/te-connectivity-amp-connectors/1-2199298-4/5022041) | `571-1-2199298-4` **UNVERIFIED** | `A120349-ND` | 0.30 | 0.60 | U1 receives the ORIGINAL U701 chip (MC14174B) from the DX: no new chip is bought for U1. |
| U4 (socket) | 1 | IC socket DIP-14, 7.62 mm, through-hole | TE Connectivity [1-2199298-3](https://www.digikey.com/en/products/detail/te-connectivity-amp-connectors/1-2199298-3/5022040) | `571-1-2199298-3` (aggregator) | `A120348-ND` | 0.28 | 0.28 |  |
| U2 (sockets) | 2 | Female header 1x15, 2.54 mm, through-hole (Nano socket) | Sullins Connector Solutions [PPTC151LFBN-RC](https://www.digikey.com/en/products/detail/sullins-connector-solutions/PPTC151LFBN-RC/810153) | `200-SSW11501TS` **UNVERIFIED** | `S7013-ND` | 0.92 | 1.84 | Mouser: Sullins part not found; the Mouser number is for the equivalent Samtec SSW-115-01-T-S (DK 612-SSW-115-01-T-S-ND). |
| J1 | 1 | Box header 2x8 (16 pin), 2.54 mm, shrouded, straight, through-hole | Wurth Elektronik [61201621621](https://www.digikey.com/en/products/result?keywords=61201621621) | `710-61201621621` (aggregator) | `732-2095-ND` | 0.60 | 0.60 | Pin 1 marked on the PCB. Polarised: the IDC socket fits one way only. |
| J2 | 1 | JST XH header 3-pin, 2.50 mm, vertical | JST [B3B-XH-A(LF)(SN)](https://www.digikey.com/en/products/result?keywords=B3B-XH-A) | `306-B3B-XH-ALFSN` **UNVERIFIED** | `455-2248-ND` | 0.13 | 0.13 | POT: 1 = GND, 2 = wiper, 3 = +5 V |
| J3 | 1 | JST XH header 2-pin, 2.50 mm, vertical | JST [B2B-XH-A(LF)(SN)](https://www.digikey.com/en/products/detail/jst-sales-america-inc/B2B-XH-A/1651045) | `306-B2B-XH-ALFSN` **UNVERIFIED** | `455-B2B-XH-A-ND` | 0.10 | 0.10 | CLK: 1 = clock tap, 2 = GND |
| JP1 | 1 | Pin header 2x2, 2.54 mm, vertical, gold | Samtec [TSW-102-07-G-D](https://www.digikey.com/en/products/detail/samtec-inc/TSW-102-07-G-D/1101275) | `200-TSW10207GD` **UNVERIFIED** | `612-TSW-102-07-G-D-ND` | 0.38 | 0.38 | PPQN select: no shunt = 96, shunt on JP1 1-2 = 48 (D10), shunt on JP1 3-4 = 24 (D11) |
| JP1 (shunt) | 1 | Jumper shunt 2.54 mm, closed top | Sullins Connector Solutions [QPC02SXGN-RC](https://www.digikey.com/en/products/detail/sullins-connector-solutions/QPC02SXGN-RC/2618262) | `571-881545-2` **UNVERIFIED** | `S9337-ND` | 0.10 | 0.10 | For 96 PPQN park it on one pin only (no pair bridged). Mouser: Sullins not found; number is for the equivalent TE 881545-2 (DK A26242-ND). |
| R1, R2, R3, R4 | 4 | Resistor 1 kOhm 1 % 1/4 W metal film, axial | YAGEO [MFR-25FBF52-1K](https://www.digikey.com/en/products/result?keywords=MFR-25FBF52-1K) | `603-MFR-25FBF52-1K` **UNVERIFIED** | `1.00KXBK-ND` | 0.10 | 0.40 | R1-R3 protect Nano D2/D4/D5; R4 pot-wiper RC filter |
| R5, R6 | 2 | Resistor 10 kOhm 1 % 1/4 W metal film, axial | YAGEO [MFR-25FBF52-10K](https://www.digikey.com/en/products/detail/yageo/MFR-25FBF52-10K/13219) | `603-MFR-25FBF52-10K` (aggregator) | `10.0KXBK-ND` | 0.10 | 0.20 | R5 MUX_SEL pull-down (bypass), R6 clock series |
| R7 | 1 | Resistor 100 kOhm 1 % 1/4 W metal film, axial | YAGEO [MFR-25FBF52-100K](https://www.digikey.com/en/products/result?keywords=MFR-25FBF52-100K) | `603-MFR-25FBF52-100K` **UNVERIFIED** | `100KXBK-ND` | 0.10 | 0.10 | Clock input pull-down |
| C2, C3, C4, C5, C6 | 5 | Capacitor 100 nF 50 V X7R ceramic, radial, 5.08 mm lead spacing | KEMET [C322C104K5R5TA](https://www.digikey.com/en/products/detail/kemet/C322C104K5R5TA/818105) | `80-C322C104K5R` (aggregator) | `399-4329-ND` | 1.49 | 7.45 | Decoupling U1/U3/U4/Nano + pot filter. Any 100 nF X7R with 5 mm spacing is fine (cheaper generics exist). |
| C7 | 1 | Capacitor 1 nF 100 V C0G ceramic, radial, 5.08 mm lead spacing | KEMET [C322C102J1G5TA](https://www.digikey.com/en/products/detail/kemet/C322C102J1G5TA/818097) | not found | `399-4321-ND` | 0.73 | 0.73 | Clock RC filter. Mouser: search the MPN. |
| C1 | 1 | Capacitor 10 uF 35 V aluminium electrolytic, radial 5 mm dia, 2.0 mm lead spacing | Panasonic [EEA-GA1V100](https://www.digikey.com/en/products/detail/panasonic-industry/EEA-GA1V100/2504583) | `667-EEA-GA1V100` **UNVERIFIED** | `P14494-ND` | 0.32 | 0.32 | Bulk cap at J1. Any 10 uF >= 16 V, 5 mm dia, 2.0 mm pitch. (ECA-1EM100 was out of stock at DK on 2026-11-06.) |
| TP1, TP2, TP3, TP5 | 4 | Test point, compact, red | Keystone Electronics [5005](https://www.digikey.com/en/products/result?keywords=Keystone 5005) | `534-5005` **UNVERIFIED** | `36-5005-ND` | 0.35 | 1.40 |  |
| TP4 | 1 | Test point, compact, black (GND) | Keystone Electronics [5006](https://www.digikey.com/en/products/detail/keystone-electronics/5006/255330) | `534-5006` **UNVERIFIED** | `36-5006-ND` | 0.33 | 0.33 |  |
| H1-H4 | 4 | Self-adhesive snap-lock PCB support for a 3.2 mm hole, 12.7 mm (1/2 in) high | Essentra Components [LCBSBM-8-01A-RT](https://www.digikey.com/en/products/result?keywords=LCBSBM-8-01A-RT) | not found | `RPC4230-ND` | 1.32 | 5.28 | Board holes: 4 x 3.2 mm, 3.5 mm in from each corner (centres 77.0 x 56.0 mm). Board snaps on, feet stick to a clean, component-free spot (reversible). Alternative: the M3 standoffs below. |
| (PCB) | 1 | DX TimeShift rev A bare PCB, 2-layer, 84.0 x 63.0 mm, r 2 mm corners (see hardware/gerbers) | any PCB fab DXTS rev A | n/a | n/a | 2.00 | 2.00 | Typical 5-board minimum order of about $10 plus shipping: $2 per board. |

### B. DX plug cable (J1 to U701 socket)

| Ref | Qty | Description | Manufacturer / MPN | Mouser | Digi-Key | Unit $ | Ext $ | Notes |
|---|---|---|---|---|---|---|---|---|
| J1 cable, board end | 1 | IDC ribbon socket 2x8, 2.54 mm, for 1.27 mm ribbon | 3M [89116-0101](https://www.digikey.com/en/products/detail/3m/89116-0101/229692) | `517-D89116-0131HK` (aggregator) | `MKC16A-ND` | 1.84 | 1.84 | Mouser number is the equivalent 3M D89116-0131HK. RS lists 89116-0101 as being discontinued. |
| J1 cable, strain relief | 1 | Strain relief clip for the 16-way IDC socket | 3M [3448-89116](https://www.digikey.com/en/products/result?keywords=3448-89116) | not found | `MKSR16-ND` | 0.62 | 0.62 | Optional but recommended |
| DX plug | 1 | DIP-16 IDC plug (header plug), 0.300 in row spacing, for 1.27 mm ribbon | Adam Tech [FDP-316-T](https://www.digikey.com/en/products/result?keywords=FDP-316-T) | not found | `2057-FDP-316-T-ND` | 1.59 | 1.59 | Goes into the DX U701 socket. Alternative: HARTING 09181169622 (DK 1195-1653-ND), confirm 7.62 mm row spacing first. |
| ribbon | 1 | Flat ribbon cable 16-way, 1.27 mm pitch, grey, per foot (use 10-15 cm) | 3M [3365/16](https://www.digikey.com/en/products/result?keywords=3365/16) | `517-3365/16-100` (aggregator) | `19-3365/16-DS-ND` | 1.05 | 1.05 | DK sells per foot (buy 2 ft for one spare try). The Mouser number is a 100 ft roll: buy per foot at DK, or any 16-way 1.27 mm grey ribbon. |

### C. Panel pot and wiring

| Ref | Qty | Description | Manufacturer / MPN | Mouser | Digi-Key | Unit $ | Ext $ | Notes |
|---|---|---|---|---|---|---|---|---|
| RV1 (panel) | 1 | Panel pot 16 mm, 10 kOhm LINEAR, solder lugs, 6 mm SLOTTED shaft 15 mm, M7x0.75 bushing; nut + washer included | TT Electronics/BI [P160KNP-0EC15B10K](https://www.digikey.com/en/products/detail/tt-electronics-bi/P160KNP-0EC15B10K/5957468) | not found | `987-1724-ND` | 2.64 | 2.64 | Matches the DX's bare short tuning shafts (no knob, adjust by hand or screwdriver). Panel hole 7.5-8.0 mm (datasheet 7.5 +0.2/-0; 8.0 is acceptable, the nut and 12 mm washer cover it). Tab hole 3.0 mm at 7.8 mm (datasheet p10). |
| panel washer + nut | 0 | M7x0.75 hex nut (9.9 mm A/F) + flat washer 12 mm OD | TT Electronics/BI (supplied with RV1) | n/a | n/a | 0.00 | 0.00 | Supplied with the pot. If you snap the anti-rotation tab off, add an M7 internal-tooth lock washer (not stocked at Mouser/DK; audio-parts suppliers sell them). |
| J2 housing | 1 | JST XH housing 3-way | JST [XHP-3](https://www.digikey.com/en/products/detail/jst-sales-america-inc/XHP-3/1651017) | `306-XHP-3` **UNVERIFIED** | `455-2219-ND` | 0.10 | 0.10 | Pot lead |
| J3 housing | 1 | JST XH housing 2-way | JST [XHP-2](https://www.digikey.com/en/products/result?keywords=XHP-2) | `306-XHP-2` **UNVERIFIED** | `455-2266-ND` | 0.10 | 0.10 | Clock lead |
| J2/J3 contacts | 10 | JST XH crimp contact, 22-28 AWG | JST [SXH-001T-P0.6](https://www.mouser.com/ProductDetail/306-SXH-001T-P0.6) | `306-SXH-001T-P0.6` (aggregator) | `455-1135-1000-ND` | 0.10 | 1.00 | 5 needed + 5 spares. Mouser sells single pieces. Digi-Key only sells a strip of 1000 ($40.05). If you have no XH crimp tool use the pre-crimped leads below instead. |
| J2/J3 leads (no-crimp option) | 5 | JST pre-crimped lead, SXH contact both ends, 22 AWG, 305 mm (12 in) | JST [ASXHSXH22K305](https://www.digikey.com/en/products/result?keywords=ASXHSXH22K305) | not found | `455-3241-ND` | 1.13 | (5.65) | OPTION instead of crimping: cut one end off each lead (gives 5 x 300 mm leads, all black: mark them with coloured heat-shrink). Not in the total. |
| hook-up wire | 1 | Hook-up wire 22 AWG stranded, 6 colours x 25 ft | Adafruit [3111](https://www.digikey.com/en/products/result?keywords=Adafruit 3111) | `485-3111` (aggregator) | `1528-1744-ND` | 19.95 | 19.95 | Red +5 V, black GND, yellow wiper, blue clock. About 0.3 m of each colour used. Any 22-26 AWG stranded wire is fine (SXH contact: 22-28 AWG). |
| heat-shrink | 1 | Heat-shrink tubing assortment, 2:1, 280 pieces | Adafruit [4559](https://www.digikey.com/en/products/result?keywords=Adafruit 4559) | not found | `1528-4559-ND` | 9.95 | 9.95 | Cover the three pot lugs and the grabber joint |
| clock tap clip | 2 | Mini-grabber test clip with solder terminal (0.090 in wire hole) | Pomona Electronics [3925-0](https://www.digikey.com/en/products/detail/pomona-electronics/3925-0/736721) | `565-3925-0` **UNVERIFIED** | `501-1244-ND` | 3.19 | 6.38 | One on R791 (clock), one optional for the GND wire. Other colours: 3925-2 red, 3925-6 blue. |
| cable ties | 5 | Cable tie 3.9 in (99 mm), nylon, natural | Panduit [PLT1M-C](https://www.digikey.com/en/products/detail/panduit-corp/PLT1M-C/280033) | `644-PLT1M-C` **UNVERIFIED** | `298-1020-ND` | 0.25 | 1.25 | Dress the pot and clock leads away from the transformer |
| panel label | 1 | Laminated label tape 9 mm white on black, for 'SNARE DELAY  0 <-> 1 BEAT' | Brother TZe-325 | not found | not found | 15.00 | 15.00 | Not stocked at Mouser or Digi-Key: office-supply store. TZe-335 (12 mm) also fine. |

### D. Options and contingency (not in the total)

| Ref | Qty | Description | Manufacturer / MPN | Mouser | Digi-Key | Unit $ | Ext $ | Notes |
|---|---|---|---|---|---|---|---|---|
| RV1 alternative | 1 | Same pot with 6 mm KNURLED 18-tooth shaft 15 mm, solder lugs | TT Electronics/BI [P160KNP-0QC15B10K](https://www.digikey.com/en/products/result?keywords=P160KNP-0QC15B10K) | not found | `987-1731-ND` | 1.86 | (1.86) | Use with a knob. Mouser 858-P160KN-0QC15B10K is the PC-PIN version: do not order it by mistake. |
| knob (optional) | 1 | Knob, black, 15.9 mm, set screw, for 6 mm shaft | Kilo International [OEJNI-63-4-7](https://www.digikey.com/en/products/result?keywords=OEJNI-63-4-7) | not found | `226-4227-ND` | 12.15 | (12.15) | Check the bore (6 mm) on the datasheet before ordering. Any small knob for a 6 mm shaft will do. |
| H1-H4 alternative | 4 | Hex standoff M3, 10 mm, nylon, female-female | Essentra Components [MTS-10S](https://www.digikey.com/en/products/detail/essentra-components/MTS-10S/392817) | `144-MTS-10S` (aggregator) | `RPC3120-ND` | 0.80 | (3.20) | Only if you mount to a bracket or existing threaded points instead of the adhesive supports |
| H1-H4 alternative screws | 8 | Screw M3 x 6 mm, nylon, pan head Phillips | Wurth Elektronik [97790603111](https://www.digikey.com/en/products/result?keywords=97790603111) | `710-97790603111` **UNVERIFIED** | `732-13704-ND` | 0.26 | (2.08) | For the standoffs above |
| U1 socket upgrade | 1 | Machined-pin IC socket DIP-16 (gentler on the 1983 chip's legs) | Mill-Max [110-43-316-41-001000](https://www.digikey.com/en/products/result?keywords=110-43-316-41-001000) | `575-110433161` (aggregator) | `ED90034-ND` | 3.50 | (3.50) | Optional replacement for the stamped U1 socket |
| DX U701 socket (contingency) | 1 | IC socket DIP-16, 7.62 mm, to fit in the DX if U701 turns out to be SOLDERED (findings Q1) | TE Connectivity [1-2199298-4](https://www.digikey.com/en/products/detail/te-connectivity-amp-connectors/1-2199298-4/5022041) | `571-1-2199298-4` **UNVERIFIED** | `A120349-ND` | 0.30 | (0.30) | Only if Q1 fails. Desoldering U701 is a permanent change: ask the owner first. |

### E. Tools (not in the total)

| Ref | Qty | Description | Manufacturer / MPN | Mouser | Digi-Key | Unit $ | Ext $ | Notes |
|---|---|---|---|---|---|---|---|---|
| tool | 1 | DIP-16 test clip (logic-analyser probing of U701, findings Q2) | Pomona Electronics [3916A](https://www.digikey.com/en/products/detail/pomona-electronics/3916A/736720) | not found | `3916A-ND` | 28.86 | (28.86) | Only 4 in stock at DK on 2026-11-06 |
| tool | 1 | Logic analyser 8 ch (or a 24 MHz FX2 clone + PulseView, about $15) | Saleae [SAL-00111](https://www.mouser.com/ProductDetail/903-SAL-00111) | `903-SAL-00111` (aggregator) | `6648-SAL-00111-ND` | 499.00 | (499.00) | Any >= 4 MHz analyser is enough |
| tool | 1 | USB-A to Mini-B cable 3 ft (to flash the Nano OUT of the board) | Qualtek [3021003-03](https://www.digikey.com/en/products/detail/qualtek/3021003-03/1531289) | not found | `Q362-ND` | 3.35 | (3.35) |  |
| tool | 1 | JST XH crimp tool (Engineer PA-09 or IWISS SN-28B; JST WC-110 is the official one) | JST [WC-110](https://www.digikey.com/en/products/result?keywords=WC-110) | not found | `455-1136-ND` | 536.51 | (536.51) | PA-09 (about $40) or SN-28B (about $20-30) from online tool shops do the job. Not needed with pre-crimped leads. |

## Tools

| Tool | Why | Notes |
|---|---|---|
| Temperature-controlled soldering iron, 0.5–0.8 mm solder (63/37 or lead-free), flux | Building the board, pot lugs | A fine conical or 2 mm chisel tip |
| Desoldering braid or pump | Fixing mistakes; contingency if U701 is soldered (findings Q1) | |
| Digital multimeter with continuity beep | Mandatory cable check (`hardware/mechanical/dip-plug-mapping.pdf`), supply checks (Q7), finding pot lug 1 | |
| Logic analyser (≥ 4 MHz, 4+ channels) **or** a ≥ 20 MHz oscilloscope | Bench checks Q2 (RST2/FFA2/FFB2), Q4 (GEN0* through the ribbon), Q5 (clock) | Saleae Logic 8 (section E) or a $15 FX2 clone with PulseView. A scope is better for Q4 ringing. |
| Pomona 3916A DIP-16 test clip | Probing U701 in place with the analyser | Section E |
| Digital calipers (0.1 mm) | Rear-panel measurements for the drill template, panel thickness | See `hardware/mechanical/README.md` |
| Centre punch, Ø3 mm HSS drill, **Ø7.5 mm HSS drill or a step drill with an 8 mm step**, deburring tool | Panel hole for the pot: **Ø7.5–8.0 mm** (datasheet 7.5 +0.2/−0; 8.0 is acceptable because the M7 nut and Ø12 washer cover and clamp it). Optional Ø3.0 mm tab hole | Low speed, cutting oil on steel |
| Masking tape, paper, vacuum cleaner | Protect the DX board from swarf while drilling | Steel swarf on the board causes shorts |
| 10 mm socket or spanner | Pot nut (M7, 9.9 mm A/F) | |
| IC extractor (or a small flat screwdriver) | Lifting U701 out of its socket without bending the pins | |
| Bench vice or IDC press | Crimping the IDC socket and the DIP-16 IDC plug on the ribbon | Press squarely. Then do continuity test A. |
| JST XH crimp tool | J2/J3 leads | Not needed if you use the pre-crimped leads |
| Wire strippers, flush cutters, needle-nose pliers, heat gun or lighter | Leads, heat-shrink, snapping off the pot's tab if you don't drill the tab hole | |
| Phillips screwdriver | DX lid screws | |
| Modelling clay (a 10 mm ball) | Measuring the lid clearance above U701 / the board location (findings Q3) | |
| USB-A to Mini-B cable, PC with the Arduino IDE | Flashing the Nano **out of the board** (or only with the DX switched on) | |
| Anti-static wrist strap | Handling the 1983 CMOS chip (MC14174B) | |

## Items we could not fully verify

* **Mouser numbers marked UNVERIFIED** (likely right, but never seen on a Mouser page): TE 1-2199298-4,
  Samtec TSW-102-07-G-D and SSW-115-01-T-S, YAGEO 1 k and 100 k, Keystone 5005/5006, JST
  B3B-XH-A / B2B-XH-A / XHP-3 / XHP-2, TE 881545-2, Panasonic EEA-GA1V100, Pomona 3925-0, Panduit
  PLT1M-C, Wurth 97790603111.
* **Not found at Mouser at all:** TT P160KNP pots, Adam Tech FDP-316-T DIP plug, 3M 3448-89116 strain relief,
  KEMET C322C102J1G5TA, Essentra LCBSBM-8-01A-RT, Adafruit 4559, JST pre-crimped leads, Pomona 3916A,
  Kilo knob, Brother tape.
* **DIP-16 IDC plug row spacing:** Adam Tech FDP-316-T is listed with 0.300 in rows (correct for the
  DX socket). If you use the HARTING alternative, check its datasheet for 7.62 mm row spacing first.
* **Knob:** the Kilo OEJNI-63-4-7 bore must be checked against the 6 mm shaft on its datasheet.
* **Pot clearance behind the panel** is not a part-number question, but it decides whether the
  16 mm P160 fits (findings Q6). The drill template prints "DO NOT DRILL" until it is measured. If
  the free height between the tuning-pot PCB and the jack bodies turns out to be under about 19 mm,
  use a 9 mm-class pot with a threaded bushing instead (for example Bourns PTV09A-6 series, which
  was not found in stock at either distributor) and regenerate the template with its hole size.
* The **bare PCB price** is an estimate. Quote it with your fab.
