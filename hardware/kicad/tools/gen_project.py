"""Write hardware/kicad/timeshift/timeshift.kicad_pro: net classes and board design rules.

Default class (signals): 0.5 mm track, 0.2 mm clearance.  Power class (+5V, GND): 0.8 mm.
Vias 1.0 / 0.5 mm. Rules chosen well inside JLCPCB / PCBWay standard 2-layer capabilities.
KiCad fills every other setting with its defaults the first time the project is saved.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import netlist as N  # noqa: E402

PRJ = os.path.join(HERE, "..", "timeshift")


def netclass(name, track, clearance=0.2, prio=0):
    return {"name": name, "bus_width": 12, "clearance": clearance, "diff_pair_gap": 0.25,
            "diff_pair_via_gap": 0.25, "diff_pair_width": 0.2, "line_style": 0, "microvia_diameter": 0.3,
            "microvia_drill": 0.1, "pcb_color": "rgba(0, 0, 0, 0.000)", "priority": prio,
            "schematic_color": "rgba(0, 0, 0, 0.000)", "track_width": track, "via_diameter": 1.0,
            "via_drill": 0.5, "wire_width": 6}


pro = {
    "board": {
        "design_settings": {
            "defaults": {
                "board_outline_line_width": 0.1, "copper_line_width": 0.2, "copper_text_size_h": 1.5,
                "copper_text_size_v": 1.5, "copper_text_thickness": 0.3, "silk_line_width": 0.15,
                "silk_text_size_h": 1.0, "silk_text_size_v": 1.0, "silk_text_thickness": 0.15,
                "fab_line_width": 0.1, "fab_text_size_h": 1.0, "fab_text_size_v": 1.0, "fab_text_thickness": 0.15,
                "other_line_width": 0.1, "other_text_size_h": 1.0, "other_text_size_v": 1.0,
                "other_text_thickness": 0.15, "courtyard_line_width": 0.05,
                "pads": {"drill": 0.8, "height": 1.6, "width": 1.6},
                "zones": {"min_clearance": 0.3},
            },
            "diff_pair_dimensions": [],
            "drc_exclusions": [],
            "rules": {
                "min_clearance": 0.2,
                "min_connection": 0.2,
                "min_copper_edge_clearance": 0.5,
                "min_hole_clearance": 0.25,
                "min_hole_to_hole": 0.25,
                "min_microvia_diameter": 0.2,
                "min_microvia_drill": 0.1,
                "min_resolved_spokes": 2,
                "min_silk_clearance": 0.0,
                "min_text_height": 0.8,
                "min_text_thickness": 0.12,
                "min_through_hole_diameter": 0.3,
                "min_track_width": 0.25,
                "min_via_annular_width": 0.15,
                "min_via_diameter": 0.6,
                "solder_mask_to_copper_clearance": 0.0,
                "use_height_for_length_calcs": True,
            },
            "track_widths": [0.0, 0.5, 0.8],
            "via_dimensions": [{"diameter": 0.0, "drill": 0.0}, {"diameter": 1.0, "drill": 0.5}],
        },
        "layer_presets": [],
        "viewports": [],
    },
    "boards": [],
    "libraries": {"pinned_footprint_libs": [], "pinned_symbol_libs": []},
    "meta": {"filename": "timeshift.kicad_pro", "version": 3},
    "net_settings": {
        "classes": [netclass("Default", 0.5), netclass("Power", 0.8, prio=1)],
        "meta": {"version": 4},
        "net_colors": None,
        "netclass_assignments": None,
        "netclass_patterns": [{"netclass": "Power", "pattern": "+5V"}, {"netclass": "Power", "pattern": "GND"}],
    },
    "pcbnew": {"page_layout_descr_file": ""},
    "schematic": {"page_layout_descr_file": "", "legacy_lib_dir": "", "legacy_lib_list": []},
    "sheets": [[N.ROOT_UUID, "Root"]],
    "text_variables": {},
}

if __name__ == "__main__":
    path = os.path.join(PRJ, "timeshift.kicad_pro")
    json.dump(pro, open(path, "w"), indent=2)
    print("wrote", os.path.abspath(path))
