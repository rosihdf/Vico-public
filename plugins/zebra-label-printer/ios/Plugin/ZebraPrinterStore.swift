import Foundation

/// Entspricht Android `ZebraPrinterPrefs` (SharedPreferences `vico_zebra_label_v1`).
enum ZebraPrinterStore {
    private static let defaults = UserDefaults.standard
    private static let keyDefault = "vico_zebra_label_v1.default_printer_json"

    static func saveDefaultPrinterJson(_ json: String?) {
        if let json, !json.isEmpty {
            defaults.set(json, forKey: keyDefault)
        } else {
            defaults.removeObject(forKey: keyDefault)
        }
    }

    static func loadDefaultPrinterJson() -> String? {
        defaults.string(forKey: keyDefault)
    }
}
