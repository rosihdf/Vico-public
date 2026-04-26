package de.vico.app.zebralabelprinter;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.annotation.Nullable;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Set;
import java.util.regex.Pattern;
import org.json.JSONException;

@CapacitorPlugin(name = "ZebraLabelPrinter")
public class ZebraLabelPrinterPlugin extends Plugin {

    private static final Pattern MAC_PATTERN = Pattern.compile("^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$");

    private boolean hasBluetoothPermission(final Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return ContextCompat.checkSelfPermission(ctx, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
        }
        return ContextCompat.checkSelfPermission(ctx, Manifest.permission.BLUETOOTH) == PackageManager.PERMISSION_GRANTED;
    }

    private static boolean validateAndroidTarget(final JSObject t) {
        if (t == null) {
            return false;
        }
        if (!"zebra_zq220".equals(t.optString("kind", ""))) {
            return false;
        }
        final JSObject n = t.getJSObject("native");
        if (n == null) {
            return false;
        }
        if (!"android".equals(n.optString("platform", ""))) {
            return false;
        }
        final String mac = n.optString("opaque", "");
        return MAC_PATTERN.matcher(mac).matches();
    }

    @Nullable
    private static JSObject deviceToTarget(final BluetoothDevice d) {
        if (d == null) {
            return null;
        }
        final String mac = d.getAddress();
        final String name = d.getName();
        final JSObject nativeObj = new JSObject();
        nativeObj.put("platform", "android");
        nativeObj.put("opaque", mac);
        final JSObject t = new JSObject();
        t.put("kind", "zebra_zq220");
        t.put("id", mac);
        final String label = name != null && !name.isEmpty() ? name : "Bluetooth " + mac.substring(Math.max(0, mac.length() - 5));
        t.put("displayName", label);
        final String clean = mac.replace(":", "");
        if (clean.length() >= 4) {
            t.put("lastFour", clean.substring(clean.length() - 4));
        }
        t.put("native", nativeObj);
        return t;
    }

    @PluginMethod
    public void isAvailable(final PluginCall call) {
        final Context ctx = getContext();
        final JSObject r = new JSObject();
        r.put("platform", "android");
        if (!ZebraBluetoothSppSender.hasBluetoothAdapter(ctx)) {
            r.put("available", false);
            r.put("reason", "UNSUPPORTED_OS_VERSION");
            call.resolve(r);
            return;
        }
        if (!hasBluetoothPermission(ctx)) {
            r.put("available", false);
            r.put("reason", "BLUETOOTH_UNAUTHORIZED");
            call.resolve(r);
            return;
        }
        if (!ZebraBluetoothSppSender.isBluetoothEnabled(ctx)) {
            r.put("available", false);
            r.put("reason", "BLUETOOTH_OFF");
            call.resolve(r);
            return;
        }
        r.put("available", true);
        call.resolve(r);
    }

    @PluginMethod
    public void getPairedPrinters(final PluginCall call) {
        final Context ctx = getContext();
        if (!hasBluetoothPermission(ctx)) {
            ZebraPluginResults.resolveFail(call, "BLUETOOTH_UNAUTHORIZED", "Berechtigung für Bluetooth fehlt (z. B. BLUETOOTH_CONNECT).", null);
            return;
        }
        if (!ZebraBluetoothSppSender.isBluetoothEnabled(ctx)) {
            ZebraPluginResults.resolveFail(call, "BLUETOOTH_OFF", "Bluetooth ist ausgeschaltet.", null);
            return;
        }
        final BluetoothManager bm = (BluetoothManager) ctx.getSystemService(Context.BLUETOOTH_SERVICE);
        if (bm == null) {
            ZebraPluginResults.resolveFail(call, "SDK_ERROR", "BluetoothManager nicht verfügbar.", null);
            return;
        }
        final BluetoothAdapter adapter = bm.getAdapter();
        if (adapter == null) {
            ZebraPluginResults.resolveFail(call, "SDK_ERROR", "BluetoothAdapter nicht verfügbar.", null);
            return;
        }
        final Set<BluetoothDevice> bonded = adapter.getBondedDevices();
        final JSArray arr = new JSArray();
        if (bonded != null) {
            try {
                for (BluetoothDevice d : bonded) {
                    final JSObject t = deviceToTarget(d);
                    if (t != null) {
                        arr.put(t);
                    }
                }
            } catch (JSONException e) {
                ZebraPluginResults.resolveFail(call, "SDK_ERROR", "Geräteliste konnte nicht erstellt werden.", e.getMessage());
                return;
            }
        }
        call.resolve(ZebraPluginResults.okPrinters(arr));
    }

    @PluginMethod
    public void setDefaultPrinter(final PluginCall call) {
        final Context ctx = getContext();
        final JSObject data = call.getData();
        if (!data.has("target")) {
            ZebraPluginResults.resolveFail(call, "INVALID_PAYLOAD", "Parameter target fehlt.", null);
            return;
        }
        if (data.isNull("target")) {
            ZebraPrinterPrefs.saveDefaultPrinter(ctx, null);
            call.resolve(ZebraPluginResults.okSetDefault());
            return;
        }
        final JSObject target = call.getObject("target");
        if (!validateAndroidTarget(target)) {
            ZebraPluginResults.resolveFail(call, "INVALID_PAYLOAD", "Ungültiger PrinterTarget für Android (kind/native.opaque).", null);
            return;
        }
        ZebraPrinterPrefs.saveDefaultPrinter(ctx, target.toString());
        call.resolve(ZebraPluginResults.okSetDefault());
    }

    @PluginMethod
    public void getDefaultPrinter(final PluginCall call) {
        final Context ctx = getContext();
        final String json = ZebraPrinterPrefs.loadDefaultPrinterJson(ctx);
        if (json == null || json.isEmpty()) {
            call.resolve(ZebraPluginResults.okDefault(null));
            return;
        }
        try {
            final JSObject t = new JSObject(json);
            if (!validateAndroidTarget(t)) {
                ZebraPluginResults.resolveFail(call, "SDK_ERROR", "Gespeicherter Standarddrucker ist ungültig.", null);
                return;
            }
            call.resolve(ZebraPluginResults.okDefault(t));
        } catch (Exception e) {
            ZebraPluginResults.resolveFail(call, "SDK_ERROR", "Gespeicherte Druckerdaten konnten nicht gelesen werden.", e.getMessage());
        }
    }

    @PluginMethod
    public void printLabel(final PluginCall call) {
        final Context ctx = getContext();
        if (!hasBluetoothPermission(ctx)) {
            ZebraPluginResults.resolveFail(call, "BLUETOOTH_UNAUTHORIZED", "Berechtigung für Bluetooth fehlt.", null);
            return;
        }
        if (!ZebraBluetoothSppSender.isBluetoothEnabled(ctx)) {
            ZebraPluginResults.resolveFail(call, "BLUETOOTH_OFF", "Bluetooth ist ausgeschaltet.", null);
            return;
        }
        final JSObject payload = call.getObject("payload");
        if (payload == null) {
            ZebraPluginResults.resolveFail(call, "INVALID_PAYLOAD", "payload fehlt.", null);
            return;
        }
        final String zpl = call.getString("zpl");
        if (zpl == null || zpl.trim().isEmpty()) {
            ZebraPluginResults.resolveFail(
                call,
                "INVALID_PAYLOAD",
                "zpl fehlt oder ist leer – in JS mit buildZplFromPayloadV1(payload) erzeugen und mitsenden.",
                null
            );
            return;
        }

        final JSObject printOptions = call.getObject("printOptions");
        long timeoutMs = 15000;
        JSObject targetObj = null;
        if (printOptions != null) {
            timeoutMs = printOptions.optLong("timeoutMs", 15000);
            if (printOptions.has("target") && !printOptions.isNull("target")) {
                targetObj = printOptions.getObject("target");
            }
        }
        if (targetObj == null) {
            final String saved = ZebraPrinterPrefs.loadDefaultPrinterJson(ctx);
            if (saved != null && !saved.isEmpty()) {
                try {
                    targetObj = new JSObject(saved);
                } catch (Exception ignored) {}
            }
        }
        if (targetObj == null) {
            ZebraPluginResults.resolveFail(call, "NO_DEFAULT_PRINTER", "Kein Drucker gewählt – setDefaultPrinter oder printOptions.target setzen.", null);
            return;
        }
        if (!validateAndroidTarget(targetObj)) {
            ZebraPluginResults.resolveFail(call, "PLATFORM_MISMATCH", "Druckerziel ist kein gültiges Android-Ziel.", null);
            return;
        }
        final JSObject nativeObj = targetObj.getJSObject("native");
        final String mac = nativeObj != null ? nativeObj.optString("opaque", "") : "";
        final ZebraBluetoothSppSender.SendOutcome out = ZebraBluetoothSppSender.sendZplUtf8(ctx, mac, zpl, timeoutMs);
        if (!out.success) {
            ZebraPluginResults.resolveFail(call, out.errorCode, out.message, out.details);
            return;
        }
        call.resolve(ZebraPluginResults.okPrint(out.bytesSent, out.durationMs));
    }
}
