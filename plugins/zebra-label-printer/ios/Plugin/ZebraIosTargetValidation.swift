import Foundation

enum ZebraIosTargetValidation {
    /// iOS-`opaque`: z. B. Peripherie-/Accessory-ID oder UUID-String (kein MAC wie Android).
    static func validateIosTarget(_ dict: [String: Any]) -> Bool {
        guard let kind = dict["kind"] as? String, kind == "zebra_zq220" else { return false }
        guard let native = dict["native"] as? [String: Any] else { return false }
        guard let platform = native["platform"] as? String, platform == "ios" else { return false }
        guard let opaque = native["opaque"] as? String else { return false }
        let trimmed = opaque.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.count >= 4
    }

    static func jsonStringToTargetDict(_ json: String) -> [String: Any]? {
        guard let data = json.data(using: .utf8) else { return nil }
        guard let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        return obj
    }

    static func targetToJsonString(_ dict: [String: Any]) -> String? {
        guard let data = try? JSONSerialization.data(withJSONObject: dict) else { return nil }
        return String(data: data, encoding: .utf8)
    }
}
