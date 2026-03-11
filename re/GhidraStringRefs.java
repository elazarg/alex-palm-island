// Find defined strings containing a substring and print references to them.
//
// Usage:
//   analyzeHeadless ... -postScript GhidraStringRefs.java SuspicionMet_

import ghidra.app.script.GhidraScript;
import ghidra.program.model.listing.Data;
import ghidra.program.model.symbol.Reference;

public class GhidraStringRefs extends GhidraScript {
    @Override
    protected void run() throws Exception {
        String[] args = getScriptArgs();
        if (args.length < 1) {
            printerr("usage: GhidraStringRefs.java <substring>");
            return;
        }

        String needle = args[0];
        Data data = getFirstData();
        while (data != null) {
            Object value = data.getValue();
            if (value instanceof String) {
                String s = (String) value;
                if (s.contains(needle)) {
                    println("STRING " + data.getAddress() + " " + s);
                    for (Reference ref : getReferencesTo(data.getAddress())) {
                        println("  " + ref.getFromAddress() + " " + ref.getReferenceType());
                    }
                }
            }
            data = getDataAfter(data);
        }
    }
}
