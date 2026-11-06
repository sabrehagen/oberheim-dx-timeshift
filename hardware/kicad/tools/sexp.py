"""Minimal S-expression reader/writer for KiCad files (no external deps)."""
import re

class Sym(str):
    """An unquoted atom (keyword / number) as opposed to a quoted string."""
    pass

_tok = re.compile(r'\s*(?:(\()|(\))|"((?:[^"\\]|\\.)*)"|([^\s()"]+))', re.S)

def parse(text):
    stack = [[]]
    pos = 0
    n = len(text)
    while pos < n:
        m = _tok.match(text, pos)
        if not m:
            if text[pos:].strip() == '':
                break
            raise ValueError('parse error at %d: %r' % (pos, text[pos:pos+40]))
        pos = m.end()
        if m.group(1):
            stack.append([])
        elif m.group(2):
            lst = stack.pop()
            stack[-1].append(lst)
        elif m.group(3) is not None:
            s = m.group(3).replace('\\"', '"').replace('\\n', '\n').replace('\\\\', '\\')
            stack[-1].append(s)
        else:
            stack[-1].append(Sym(m.group(4)))
    return stack[0][0] if len(stack[0]) == 1 else stack[0]

def q(s):
    return '"' + str(s).replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n') + '"'

def dump(e, indent=0):
    """Serialise; keeps short lists on one line."""
    if isinstance(e, Sym):
        return str(e)
    if isinstance(e, bool):
        return 'yes' if e else 'no'
    if isinstance(e, (int,)):
        return str(e)
    if isinstance(e, float):
        s = ('%.4f' % e).rstrip('0').rstrip('.')
        return '0' if s in ('-0', '') else s
    if isinstance(e, str):
        return q(e)
    # list
    parts = [dump(x, indent + 1) for x in e]
    one = '(' + ' '.join(parts) + ')'
    if len(one) < 100 and '\n' not in one:
        return one
    pad = '\t' * (indent + 1)
    out = '(' + parts[0]
    for p in parts[1:]:
        out += '\n' + pad + p
    out += '\n' + '\t' * indent + ')'
    return out

def find(e, key):
    for x in e:
        if isinstance(x, list) and x and x[0] == key:
            return x
    return None

def findall(e, key):
    return [x for x in e if isinstance(x, list) and x and x[0] == key]
