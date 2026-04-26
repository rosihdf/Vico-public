package de.vico.app.zebralabelprinter;

import android.content.Context;
import android.content.SharedPreferences;
import androidx.annotation.Nullable;
/**
 * Lokale Persistenz für den Standard-Zebra-Drucker (V1).
 */
final class ZebraPrinterPrefs {

    private static final String PREFS = "vico_zebra_label_v1";
    private static final String KEY_DEFAULT = "default_printer_json";

    private ZebraPrinterPrefs() {}

    static void saveDefaultPrinter(final Context ctx, @Nullable final String jsonOrNull) {
        final SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        final SharedPreferences.Editor e = p.edit();
        if (jsonOrNull == null || jsonOrNull.isEmpty()) {
            e.remove(KEY_DEFAULT);
        } else {
            e.putString(KEY_DEFAULT, jsonOrNull);
        }
        e.apply();
    }

    @Nullable
    static String loadDefaultPrinterJson(final Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_DEFAULT, null);
    }
}
