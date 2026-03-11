// Print references to a single address in headless Ghidra.
//
// Usage:
//   analyzeHeadless ... -postScript GhidraRefsTo.java 0x361e

import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.symbol.Reference;

public class GhidraRefsTo extends GhidraScript {
    private Address parseAddr(String text) throws Exception {
        String s = text.trim().toLowerCase();
        if (s.startsWith("0x")) {
            s = s.substring(2);
        }
        return currentProgram.getAddressFactory().getDefaultAddressSpace().getAddress(s);
    }

    @Override
    protected void run() throws Exception {
        String[] args = getScriptArgs();
        if (args.length < 1) {
            printerr("usage: GhidraRefsTo.java <addr>");
            return;
        }

        Address addr = parseAddr(args[0]);
        Reference[] refs = getReferencesTo(addr);
        println("REFS TO " + addr);
        for (Reference ref : refs) {
            println(ref.getFromAddress() + " " + ref.getReferenceType());
        }
    }
}
