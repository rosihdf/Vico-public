package de.vico.app.zebralabelprinter;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/**
 * Klassischer Bluetooth-SPP-Versand (RFCOMM) für ZPL-Rohbytes – ohne Zebra-SDK.
 */
final class ZebraBluetoothSppSender {

    static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    private ZebraBluetoothSppSender() {}

    static final class SendOutcome {

        final boolean success;
        final String errorCode;
        final String message;
        final String details;
        final int bytesSent;
        final long durationMs;

        private SendOutcome(
            final boolean success,
            final String errorCode,
            final String message,
            final String details,
            final int bytesSent,
            final long durationMs
        ) {
            this.success = success;
            this.errorCode = errorCode;
            this.message = message;
            this.details = details;
            this.bytesSent = bytesSent;
            this.durationMs = durationMs;
        }

        static SendOutcome ok(final int bytesSent, final long durationMs) {
            return new SendOutcome(true, null, null, null, bytesSent, durationMs);
        }

        static SendOutcome err(final String code, final String message, @Nullable final String details) {
            return new SendOutcome(false, code, message, details, 0, 0);
        }
    }

    static boolean hasBluetoothAdapter(final Context ctx) {
        return adapterOrNull(ctx) != null;
    }

    @Nullable
    private static BluetoothAdapter adapterOrNull(final Context ctx) {
        final BluetoothManager bm = (BluetoothManager) ctx.getSystemService(Context.BLUETOOTH_SERVICE);
        if (bm == null) {
            return null;
        }
        return bm.getAdapter();
    }

    static boolean isBluetoothEnabled(final Context ctx) {
        final BluetoothAdapter a = adapterOrNull(ctx);
        return a != null && a.isEnabled();
    }

    static boolean isBonded(final Context ctx, @NonNull final String mac) {
        final BluetoothAdapter a = adapterOrNull(ctx);
        if (a == null) {
            return false;
        }
        final Set<BluetoothDevice> bonded = a.getBondedDevices();
        if (bonded == null) {
            return false;
        }
        for (BluetoothDevice d : bonded) {
            if (d != null && mac.equalsIgnoreCase(d.getAddress())) {
                return true;
            }
        }
        return false;
    }

    static SendOutcome sendZplUtf8(final Context ctx, @NonNull final String mac, @NonNull final String zpl, final long timeoutMs) {
        final long start = System.currentTimeMillis();
        final BluetoothAdapter adapter = adapterOrNull(ctx);
        if (adapter == null) {
            return SendOutcome.err("CONNECTION_FAILED", "Bluetooth nicht verfügbar.", null);
        }
        if (!adapter.isEnabled()) {
            return SendOutcome.err("BLUETOOTH_OFF", "Bluetooth ist ausgeschaltet.", null);
        }
        if (!isBonded(ctx, mac)) {
            return SendOutcome.err("PRINTER_NOT_FOUND", "Drucker ist nicht mit dem Gerät gekoppelt.", mac);
        }

        final byte[] data = zpl.getBytes(StandardCharsets.UTF_8);
        final ExecutorService pool = Executors.newSingleThreadExecutor();
        try {
            final BluetoothDevice device = adapter.getRemoteDevice(mac);
            final BluetoothSocket s = device.createRfcommSocketToServiceRecord(SPP_UUID);
            final Future<?> connectFuture = pool.submit(() -> {
                try {
                    s.connect();
                } catch (IOException e) {
                    throw new RuntimeException(e);
                }
            });
            try {
                connectFuture.get(Math.max(3000L, timeoutMs), TimeUnit.MILLISECONDS);
            } catch (TimeoutException e) {
                connectFuture.cancel(true);
                try {
                    s.close();
                } catch (IOException ignored) {}
                return SendOutcome.err("CONNECTION_TIMEOUT", "Verbindungsaufbau hat zu lange gedauert.", e.getMessage());
            } catch (ExecutionException e) {
                final Throwable c = e.getCause() != null ? e.getCause() : e;
                try {
                    s.close();
                } catch (IOException ignored) {}
                return SendOutcome.err("CONNECTION_FAILED", "Verbindung zum Drucker fehlgeschlagen.", c.getMessage());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                try {
                    s.close();
                } catch (IOException ignored) {}
                return SendOutcome.err("CONNECTION_FAILED", "Verbindung unterbrochen.", e.getMessage());
            }

            try {
                final OutputStream os = s.getOutputStream();
                os.write(data);
                os.flush();
            } catch (IOException e) {
                try {
                    s.close();
                } catch (IOException ignored) {}
                return SendOutcome.err("SEND_FAILED", "ZPL konnte nicht gesendet werden.", e.getMessage());
            }

            try {
                s.close();
            } catch (IOException ignored) {}

            final long dur = System.currentTimeMillis() - start;
            return SendOutcome.ok(data.length, dur);
        } finally {
            pool.shutdownNow();
        }
    }
}
