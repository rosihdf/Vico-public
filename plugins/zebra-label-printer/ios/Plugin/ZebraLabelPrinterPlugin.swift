import Foundation
import Capacitor
import CoreBluetooth

@objc(ZebraLabelPrinterPlugin)
public class ZebraLabelPrinterPlugin: CAPPlugin, CAPBridgedPlugin {
    private func asStringDict(_ value: Any?) -> [String: Any]? {
        switch value {
        case let d as [String: Any]:
            return d
        case let d as NSDictionary:
            return d as? [String: Any]
        default:
            return nil
        }
    }

    public let identifier = "ZebraLabelPrinterPlugin"
    public let jsName = "ZebraLabelPrinter"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getPairedPrinters", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setDefaultPrinter", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getDefaultPrinter", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "printLabel", returnType: CAPPluginReturnPromise),
    ]

    /// Entspricht Android: ohne Bluetooth-Nutzungserlaubnis kein sinnvoller Pfad.
    private func bluetoothBlockedCode() -> String? {
        if #available(iOS 13.0, *) {
            switch CBCentralManager.authorization {
            case .denied, .restricted:
                return "BLUETOOTH_UNAUTHORIZED"
            case .notDetermined:
                return "BLUETOOTH_UNAUTHORIZED"
            case .allowedAlways:
                return nil
            @unknown default:
                return "BLUETOOTH_UNAUTHORIZED"
            }
        }
        return nil
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        if let code = bluetoothBlockedCode() {
            call.resolve([
                "available": false,
                "platform": "ios",
                "reason": code,
            ])
            return
        }
        call.resolve([
            "available": true,
            "platform": "ios",
        ])
    }

    @objc func getPairedPrinters(_ call: CAPPluginCall) {
        if let code = bluetoothBlockedCode() {
            call.resolve(ZebraIosPluginResults.fail(
                code: code,
                message: "Bluetooth-Berechtigung fehlt oder wurde noch nicht erteilt.",
                details: nil
            ))
            return
        }
        // Kein Pendant zu Android getBondedDevices: Geräteliste über Zebra Link-OS / System-API nachrüsten.
        call.resolve(ZebraIosPluginResults.okPrinters([]))
    }

    @objc func setDefaultPrinter(_ call: CAPPluginCall) {
        guard let opts = call.options as? [String: Any] else {
            call.resolve(ZebraIosPluginResults.fail(code: "INVALID_PAYLOAD", message: "Ungültige Aufrufparameter.", details: nil))
            return
        }
        guard opts.keys.contains("target") else {
            call.resolve(ZebraIosPluginResults.fail(code: "INVALID_PAYLOAD", message: "Parameter target fehlt.", details: nil))
            return
        }
        if opts["target"] is NSNull {
            ZebraPrinterStore.saveDefaultPrinterJson(nil)
            call.resolve(ZebraIosPluginResults.okSetDefault())
            return
        }
        guard let target = asStringDict(opts["target"]) else {
            call.resolve(ZebraIosPluginResults.fail(code: "INVALID_PAYLOAD", message: "target ist kein Objekt.", details: nil))
            return
        }
        guard ZebraIosTargetValidation.validateIosTarget(target) else {
            call.resolve(ZebraIosPluginResults.fail(
                code: "INVALID_PAYLOAD",
                message: "Ungültiger PrinterTarget für iOS (kind, native.platform=ios, native.opaque).",
                details: nil
            ))
            return
        }
        guard let json = ZebraIosTargetValidation.targetToJsonString(target) else {
            call.resolve(ZebraIosPluginResults.fail(code: "SDK_ERROR", message: "Druckerdaten konnten nicht serialisiert werden.", details: nil))
            return
        }
        ZebraPrinterStore.saveDefaultPrinterJson(json)
        call.resolve(ZebraIosPluginResults.okSetDefault())
    }

    @objc func getDefaultPrinter(_ call: CAPPluginCall) {
        guard let json = ZebraPrinterStore.loadDefaultPrinterJson(), !json.isEmpty else {
            call.resolve(ZebraIosPluginResults.okDefault(target: nil))
            return
        }
        guard let dict = ZebraIosTargetValidation.jsonStringToTargetDict(json) else {
            call.resolve(ZebraIosPluginResults.fail(code: "SDK_ERROR", message: "Gespeicherte Druckerdaten konnten nicht gelesen werden.", details: nil))
            return
        }
        guard ZebraIosTargetValidation.validateIosTarget(dict) else {
            call.resolve(ZebraIosPluginResults.fail(code: "SDK_ERROR", message: "Gespeicherter Standarddrucker ist ungültig.", details: nil))
            return
        }
        call.resolve(ZebraIosPluginResults.okDefault(target: dict))
    }

    @objc func printLabel(_ call: CAPPluginCall) {
        if let code = bluetoothBlockedCode() {
            call.resolve(ZebraIosPluginResults.fail(
                code: code,
                message: "Bluetooth-Berechtigung fehlt oder wurde noch nicht erteilt.",
                details: nil
            ))
            return
        }
        guard let opts = call.options as? [String: Any] else {
            call.resolve(ZebraIosPluginResults.fail(code: "INVALID_PAYLOAD", message: "Ungültige Aufrufparameter.", details: nil))
            return
        }
        guard asStringDict(opts["payload"]) != nil else {
            call.resolve(ZebraIosPluginResults.fail(code: "INVALID_PAYLOAD", message: "payload fehlt.", details: nil))
            return
        }
        guard let zpl = opts["zpl"] as? String, !zpl.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            call.resolve(ZebraIosPluginResults.fail(
                code: "INVALID_PAYLOAD",
                message: "zpl fehlt oder ist leer – in JS mit buildZplFromPayloadV1 erzeugen.",
                details: nil
            ))
            return
        }

        var timeoutMs: Int64 = 15_000
        var targetDict: [String: Any]?
        if let printOptions = asStringDict(opts["printOptions"]) {
            if let n = printOptions["timeoutMs"] as? NSNumber {
                timeoutMs = n.int64Value
            } else if let n = printOptions["timeoutMs"] as? Int64 {
                timeoutMs = n
            } else if let n = printOptions["timeoutMs"] as? Int {
                timeoutMs = Int64(n)
            }
            targetDict = asStringDict(printOptions["target"])
        }
        if targetDict == nil, let json = ZebraPrinterStore.loadDefaultPrinterJson(), !json.isEmpty {
            targetDict = ZebraIosTargetValidation.jsonStringToTargetDict(json)
        }
        guard let resolvedTarget = targetDict else {
            call.resolve(ZebraIosPluginResults.fail(
                code: "NO_DEFAULT_PRINTER",
                message: "Kein Drucker gewählt – setDefaultPrinter oder printOptions.target setzen.",
                details: nil
            ))
            return
        }
        guard ZebraIosTargetValidation.validateIosTarget(resolvedTarget) else {
            call.resolve(ZebraIosPluginResults.fail(
                code: "PLATFORM_MISMATCH",
                message: "Druckerziel ist kein gültiges iOS-Ziel.",
                details: nil
            ))
            return
        }
        guard let native = resolvedTarget["native"] as? [String: Any],
              let opaque = native["opaque"] as? String else {
            call.resolve(ZebraIosPluginResults.fail(code: "INVALID_PAYLOAD", message: "native.opaque fehlt.", details: nil))
            return
        }

        switch ZebraIosTransport.sendZplUtf8(opaque: opaque, zpl: zpl, timeoutMs: timeoutMs) {
        case let .success(bytesSent, durationMs):
            call.resolve(ZebraIosPluginResults.okPrint(bytesSent: bytesSent, durationMs: durationMs))
        case let .failure(code, message, details):
            call.resolve(ZebraIosPluginResults.fail(code: code, message: message, details: details))
        }
    }
}
