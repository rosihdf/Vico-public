import Foundation

/**
 * ZPL-Versand iOS – Platzhalter für Zebra Link-OS / MFi / BLE.
 * Android nutzt klassisches Bluetooth-SPP; iOS erlaubt keinen generischen RFCOMM-Zugriff wie auf Android.
 */
enum ZebraIosTransport {
    enum Outcome {
        case success(bytesSent: Int, durationMs: Int64)
        case failure(code: String, message: String, details: String?)
    }

    /// Echter Sendepfad: hier Zebra Link-OS oder passende API anbinden.
    static func sendZplUtf8(opaque _: String, zpl: String, timeoutMs _: Int64) -> Outcome {
        _ = zpl.data(using: .utf8)?.count ?? 0 // nach Integration: tatsächlich gesendete Bytes
        return .failure(
            code: "SDK_ERROR",
            message: "iOS: ZPL-Versand ist noch nicht angebunden.",
            details: "Erwartet wird Integration von Zebra Link-OS (oder MFi External Accessory), nicht generisches Bluetooth-SPP wie unter Android."
        )
    }
}
