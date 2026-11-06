"""Compare a KiCad-exported netlist (kicadsexpr) with netlist.py. Exit 1 on any difference.
Usage: python3 check_netlist.py exported.net"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sexp import parse, find, findall  # noqa: E402
import netlist as N  # noqa: E402


def load(path):
    t = parse(open(path).read())
    nets = {}
    for n in findall(find(t, "nets"), "net"):
        name = str(find(n, "name")[1]).lstrip("/")
        mem = sorted((str(find(m, "ref")[1]), str(find(m, "pin")[1])) for m in findall(n, "node"))
        if not name.startswith("unconnected-") and not name.startswith("Net-("):
            nets[name] = mem
        else:
            nets.setdefault("_anon", []).append(mem)
    comps = {str(find(c, "ref")[1]): (str(find(c, "value")[1]), str(find(c, "footprint")[1]))
             for c in findall(find(t, "components"), "comp")}
    return nets, comps


def main(path):
    nets, comps = load(path)
    ok = True
    want = {n: sorted((r, str(p)) for r, p in m) for n, m in N.net_members().items()}
    for n, m in want.items():
        if nets.get(n) != m:
            print("NET MISMATCH %s\n  schematic: %s\n  netlist.py: %s" % (n, nets.get(n), m))
            ok = False
    for n in nets:
        if n != "_anon" and n not in want:
            print("EXTRA NET in schematic:", n, nets[n])
            ok = False
    for mem in nets.get("_anon", []):
        if len(mem) > 1:
            print("ANONYMOUS multi-pin net in schematic:", mem)
            ok = False
    for c in N.COMPONENTS:
        if c["ref"] not in comps:
            print("MISSING component", c["ref"])
            ok = False
        elif comps[c["ref"]] != (c["value"], c["footprint"]):
            print("FIELD MISMATCH", c["ref"], comps[c["ref"]], (c["value"], c["footprint"]))
            ok = False
    print("netlist check:", "OK - schematic matches netlist.py" if ok else "FAILED")
    return ok


if __name__ == "__main__":
    sys.exit(0 if main(sys.argv[1]) else 1)
