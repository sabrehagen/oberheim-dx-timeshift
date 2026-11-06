"""Debug preview: SVG of outline, courtyards, pads, ratsnest/tracks. Usage: preview.py board out.svg"""
import sys, math
import pcbnew
b = pcbnew.LoadBoard(sys.argv[1])
S = 10.0
OX, OY = 100.0, 100.0
def c(v): return pcbnew.ToMM(v)
out = ['<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" style="background:#103010">' % (100 * S, 66 * S)]
def X(v): return (c(v) - OX + 2) * S
def Y(v): return (c(v) - OY + 2) * S
bb = b.GetBoardEdgesBoundingBox()
out.append('<rect x="%f" y="%f" width="%f" height="%f" fill="#204020" stroke="yellow"/>' % (X(bb.GetLeft()), Y(bb.GetTop()), c(bb.GetWidth()) * S, c(bb.GetHeight()) * S))
for fp in b.GetFootprints():
    cy = fp.GetCourtyard(pcbnew.F_CrtYd).BBox()
    out.append('<rect x="%f" y="%f" width="%f" height="%f" fill="none" stroke="#c0c0ff" stroke-width="1"/>' % (X(cy.GetLeft()), Y(cy.GetTop()), c(cy.GetWidth()) * S, c(cy.GetHeight()) * S))
    for p in fp.Pads():
        pos = p.GetPosition(); sz = p.GetSize()
        col = '#d4a017' if p.GetNetname() else '#808080'
        out.append('<circle cx="%f" cy="%f" r="%f" fill="%s"/>' % (X(pos.x), Y(pos.y), c(sz.x) / 2 * S, col))
        out.append('<text x="%f" y="%f" font-size="7" fill="black" text-anchor="middle">%s</text>' % (X(pos.x), Y(pos.y) + 2.5, p.GetNumber()))
    out.append('<text x="%f" y="%f" font-size="16" fill="white" text-anchor="middle">%s</text>' % ((X(cy.GetLeft()) + X(cy.GetRight())) / 2, (Y(cy.GetTop()) + Y(cy.GetBottom())) / 2, fp.GetReference()))
for t in b.GetTracks():
    col = '#e03030' if t.GetLayer() == pcbnew.F_Cu else '#3060f0'
    if t.GetClass() == 'PCB_VIA':
        out.append('<circle cx="%f" cy="%f" r="%f" fill="#ddd"/>' % (X(t.GetPosition().x), Y(t.GetPosition().y), 0.5 * S))
    else:
        out.append('<line x1="%f" y1="%f" x2="%f" y2="%f" stroke="%s" stroke-width="%f" stroke-opacity="0.8" stroke-linecap="round"/>' % (X(t.GetStart().x), Y(t.GetStart().y), X(t.GetEnd().x), Y(t.GetEnd().y), col, c(t.GetWidth()) * S))
if len(sys.argv) < 4:
    nets = {}
    for p in b.GetPads():
        if p.GetNetname() and p.GetNetname() != 'GND':
            nets.setdefault(p.GetNetname(), []).append((c(p.GetPosition().x), c(p.GetPosition().y)))
    for n, pts in nets.items():
        done = [pts[0]]; rest = pts[1:]
        while rest:
            best = min(((math.dist(a, r), a, r) for a in done for r in rest))
            _, a, r = best
            out.append('<line x1="%f" y1="%f" x2="%f" y2="%f" stroke="%s" stroke-width="1"/>' % ((a[0] - OX + 2) * S, (a[1] - OY + 2) * S, (r[0] - OX + 2) * S, (r[1] - OY + 2) * S, '#ff4040' if n == '+5V' else '#40ffff'))
            done.append(r); rest.remove(r)
out.append('</svg>')
open(sys.argv[2], 'w').write('\n'.join(out))
