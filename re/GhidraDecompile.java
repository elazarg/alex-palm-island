// Decompile a single function by entry address in headless Ghidra.
//
// Usage:
//   analyzeHeadless ... -postScript GhidraDecompile.java 0x59c6

import ghidra.app.decompiler.DecompInterface;
import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.Function;
import ghidra.util.task.ConsoleTaskMonitor;

public class GhidraDecompile extends GhidraScript {
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
            printerr("usage: GhidraDecompile.java <addr>");
            return;
        }

        Address addr = parseAddr(args[0]);
        Function fn = getFunctionAt(addr);
        if (fn == null) {
            fn = getFunctionContaining(addr);
        }
        if (fn == null) {
            disassemble(addr);
            createFunction(addr, null);
            fn = getFunctionAt(addr);
        }
        if (fn == null) {
            printerr("no function at " + addr);
            return;
        }

        DecompInterface ifc = new DecompInterface();
        ifc.openProgram(currentProgram);
        var res = ifc.decompileFunction(fn, 60, new ConsoleTaskMonitor());
        if (!res.decompileCompleted()) {
            printerr("decompilation failed for " + fn.getEntryPoint());
            return;
        }

        println("FUNCTION " + fn.getEntryPoint());
        println(res.getDecompiledFunction().getC());
    }
}
