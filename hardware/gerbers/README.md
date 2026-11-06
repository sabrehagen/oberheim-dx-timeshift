# DX TimeShift rev A: manufacturing files

**Upload `timeshift-revA-gerbers.zip` to the board house as it is.** It holds the Gerbers and
drill files listed below. KiCad 9.0.9 generated them from `../kicad/timeshift/timeshift.kicad_pcb`
(`hardware/kicad/tools/exports.sh`).

## Order settings (the JLCPCB and PCBWay defaults work)

| Setting | Value |
|---|---|
| Layers | 2 |
| Board size | 84.0 x 63.0 mm (rounded corners, r = 2 mm) |
| Material / thickness | FR-4, 1.6 mm |
| Copper weight | 1 oz (35 µm), both layers |
| Surface finish | HASL (lead-free) or ENIG. Either works because every part is through-hole. |
| Solder mask / silkscreen | any colour (green + white is fine) |
| Min track / clearance | 0.5 mm / 0.2 mm (well inside standard capability) |
| Smallest drill | 0.5 mm (vias). Pads: 0.8 / 0.95 / 1.0 / 1.6 mm. 4 x 3.2 mm NPTH mounting holes |
| Castellated / impedance / stencil | none. No paste layers are needed for through-hole. |

## Files in the zip

| File | Layer |
|---|---|
| `timeshift-F_Cu.gtl` | top copper (GND pour + tracks) |
| `timeshift-B_Cu.gbl` | bottom copper (GND pour + tracks) |
| `timeshift-F_Mask.gts`, `timeshift-B_Mask.gbs` | solder mask, top and bottom |
| `timeshift-F_Silkscreen.gto`, `timeshift-B_Silkscreen.gbo` | silkscreen, top and bottom |
| `timeshift-Edge_Cuts.gm1` | board outline |
| `timeshift-PTH.drl` | plated holes (Excellon, mm) |
| `timeshift-NPTH.drl` | non-plated holes: the four M3 mounting holes (Excellon, mm) |
| `timeshift-PTH-drl_map.gbr`, `timeshift-NPTH-drl_map.gbr` | drill maps (for checking only) |
| `timeshift-job.gbrjob` | Gerber X2 job file (stack-up summary) |

The same files are also in this folder, unzipped, so you can inspect them with a Gerber viewer
such as KiCad's GerbView or tracespace.io.
