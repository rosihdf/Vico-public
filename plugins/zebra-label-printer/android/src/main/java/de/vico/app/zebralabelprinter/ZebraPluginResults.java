package de.vico.app.zebralabelprinter;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import org.json.JSONObject;

/**
 * Einheitliche Fehler-/Erfolgs-Objekte für die V1-Spezifikation.
 */
final class ZebraPluginResults {

    private ZebraPluginResults() {}

    static JSObject fail(final String code, final String message, final String details) {
        final JSObject err = new JSObject();
        err.put("code", code);
        err.put("message", message);
        if (details != null && !details.isEmpty()) {
            err.put("details", details);
        }
        final JSObject o = new JSObject();
        o.put("ok", false);
        o.put("error", err);
        return o;
    }

    static void resolveFail(final PluginCall call, final String code, final String message, final String details) {
        call.resolve(fail(code, message, details));
    }

    static JSObject okPrint(final int bytesSent, final long durationMs) {
        final JSObject meta = new JSObject();
        meta.put("bytesSent", bytesSent);
        meta.put("durationMs", durationMs);
        final JSObject o = new JSObject();
        o.put("ok", true);
        o.put("meta", meta);
        return o;
    }

    static JSObject okPrinters(final JSArray arr) {
        final JSObject o = new JSObject();
        o.put("ok", true);
        o.put("printers", arr);
        return o;
    }

    static JSObject okDefault(final JSObject targetOrNull) {
        final JSObject o = new JSObject();
        o.put("ok", true);
        o.put("target", targetOrNull != null ? targetOrNull : JSONObject.NULL);
        return o;
    }

    static JSObject okSetDefault() {
        final JSObject o = new JSObject();
        o.put("ok", true);
        return o;
    }
}
