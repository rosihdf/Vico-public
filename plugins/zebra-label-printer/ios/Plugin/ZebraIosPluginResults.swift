import Foundation

/// Gleiche Fehler-/Erfolgsform wie Android (`ZebraPluginResults.java`).
enum ZebraIosPluginResults {
    static func fail(code: String, message: String, details: String? = nil) -> [String: Any] {
        var err: [String: Any] = [
            "code": code,
            "message": message,
        ]
        if let d = details, !d.isEmpty {
            err["details"] = d
        }
        return [
            "ok": false,
            "error": err,
        ]
    }

    static func okPrinters(_ printers: [[String: Any]]) -> [String: Any] {
        [
            "ok": true,
            "printers": printers,
        ]
    }

    static func okDefault(target: [String: Any]?) -> [String: Any] {
        if let t = target {
            return [
                "ok": true,
                "target": t,
            ]
        }
        return [
            "ok": true,
            "target": NSNull(),
        ]
    }

    static func okSetDefault() -> [String: Any] {
        ["ok": true]
    }

    static func okPrint(bytesSent: Int, durationMs: Int64) -> [String: Any] {
        [
            "ok": true,
            "meta": [
                "bytesSent": bytesSent,
                "durationMs": durationMs,
            ],
        ]
    }
}
