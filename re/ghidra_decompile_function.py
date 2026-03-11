# Decompile a single function by entry address in headless Ghidra.
#
# Usage from analyzeHeadless:
#   -postScript ghidra_decompile_function.py 0x59c6
#
# Writes the decompiled text to stdout.

from ghidra.app.decompiler import DecompInterface
from ghidra.util.task import ConsoleTaskMonitor
from ghidra.program.model.address import Address


def parse_addr(text):
    s = text.strip().lower()
    if s.startswith("0x"):
        s = s[2:]
    return currentProgram.getAddressFactory().getDefaultAddressSpace().getAddress(s)


if len(getScriptArgs()) < 1:
    printerr("usage: ghidra_decompile_function.py <addr>")
    exit(1)

addr = parse_addr(getScriptArgs()[0])
fn = getFunctionAt(addr)
if fn is None:
    fn = getFunctionContaining(addr)
if fn is None:
    disassemble(addr)
    createFunction(addr, None)
    fn = getFunctionAt(addr)
if fn is None:
    printerr("no function at {}".format(addr))
    exit(2)

ifc = DecompInterface()
ifc.openProgram(currentProgram)
res = ifc.decompileFunction(fn, 60, ConsoleTaskMonitor())
if not res.decompileCompleted():
    printerr("decompilation failed for {}".format(fn.getEntryPoint()))
    exit(3)

print("FUNCTION {}".format(fn.getEntryPoint()))
print(res.getDecompiledFunction().getC())
