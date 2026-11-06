"""Write a copy of the board without 3D models (for the 'bare board' renders that show
the full silkscreen). Usage: bare_board.py in.kicad_pcb out.kicad_pcb"""
import sys
import pcbnew
b = pcbnew.LoadBoard(sys.argv[1])
for fp in b.GetFootprints():
    fp.Models().clear()
pcbnew.SaveBoard(sys.argv[2], b)
