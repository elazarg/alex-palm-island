from ghidra.program.model.symbol import RefType


def parse_addr(text):
    s = text.strip().lower()
    if s.startswith("0x"):
        s = s[2:]
    return currentProgram.getAddressFactory().getDefaultAddressSpace().getAddress(s)


args = getScriptArgs()
if len(args) < 1:
    printerr("usage: ghidra_refs_to.py <addr>")
    exit(1)

target = parse_addr(args[0])
refs = list(getReferencesTo(target))

print("TARGET {}".format(target))
print("REFCOUNT {}".format(len(refs)))
for ref in refs:
    frm = ref.getFromAddress()
    kind = ref.getReferenceType()
    fn = getFunctionContaining(frm)
    fn_name = fn.getEntryPoint().toString() if fn else "<no-func>"
    print("{} {} {}".format(frm, fn_name, kind))
