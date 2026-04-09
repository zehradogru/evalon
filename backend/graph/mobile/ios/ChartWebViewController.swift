import UIKit
import WebKit

/**
 * ChartWebViewController — iOS native wrapper for the chart-client WebView.
 * Uses WKWebView with a chartBridge message handler for bidirectional communication.
 */
class ChartWebViewController: UIViewController, WKScriptMessageHandler, WKNavigationDelegate {

    private var webView: WKWebView!
    private let chartURL = URL(string: "https://chart.yourdomain.com")! // or local dev URL
    private var messageCounter = 0

    override func viewDidLoad() {
        super.viewDidLoad()

        // Configure WKWebView with bridge message handler
        let config = WKWebViewConfiguration()
        config.userContentController.add(self, name: "chartBridge")
        config.preferences.javaScriptEnabled = true
        config.allowsInlineMediaPlayback = true

        webView = WKWebView(frame: view.bounds, configuration: config)
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.scrollView.isScrollEnabled = false // Chart handles its own scrolling
        webView.scrollView.bounces = false
        webView.navigationDelegate = self

        view.addSubview(webView)
        webView.load(URLRequest(url: chartURL))
    }

    // MARK: - Native → Web Commands

    func setSymbol(_ symbol: String) {
        sendCommand(type: "setSymbol", payload: ["symbol": symbol])
    }

    func setTimeframe(_ tf: String) {
        sendCommand(type: "setTimeframe", payload: ["tf": tf])
    }

    func toggleLayer(_ layer: String, visible: Bool) {
        sendCommand(type: "toggleLayer", payload: ["layer": layer, "visible": visible])
    }

    func loadBacktest(_ runId: String) {
        sendCommand(type: "loadBacktest", payload: ["runId": runId])
    }

    func setStrategy(_ strategyId: String, params: [String: Any]) {
        sendCommand(type: "setStrategy", payload: ["strategyId": strategyId, "params": params])
    }

    func setTheme(_ theme: String) {
        sendCommand(type: "setTheme", payload: ["theme": theme])
    }

    private func sendCommand(type: String, payload: [String: Any]) {
        messageCounter += 1
        let msg: [String: Any] = [
            "id": "cmd_\(Int(Date().timeIntervalSince1970 * 1000))_\(messageCounter)",
            "type": type,
            "payload": payload,
            "ts": Int(Date().timeIntervalSince1970 * 1000)
        ]

        guard let jsonData = try? JSONSerialization.data(withJSONObject: msg),
              let jsonString = String(data: jsonData, encoding: .utf8) else { return }

        let js = "window.ChartBridge.receive(\(jsonString))"
        webView.evaluateJavaScript(js, completionHandler: nil)
    }

    // MARK: - Web → Native Events (WKScriptMessageHandler)

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard let body = message.body as? [String: Any],
              let type = body["type"] as? String,
              let payload = body["payload"] as? [String: Any] else { return }

        handleBridgeEvent(type: type, payload: payload)
    }

    private func handleBridgeEvent(type: String, payload: [String: Any]) {
        switch type {
        case "ready":
            let version = payload["version"] as? String ?? "unknown"
            print("[ChartBridge] ready v\(version)")
            // Chart is ready, send initial configuration

        case "markerClicked":
            let markerId = payload["markerId"] as? String ?? ""
            let markerType = payload["markerType"] as? String ?? ""
            // Show trade detail sheet, navigate, etc.
            print("[ChartBridge] marker clicked: \(markerType) \(markerId)")

        case "drawingCreated":
            // Sync drawing state if needed
            break

        case "drawingUpdated":
            // Sync drawing state if needed
            break

        case "drawingDeleted":
            // Sync drawing state if needed
            break

        case "selectionChanged":
            let selectedId = payload["selectedDrawingId"] as? String
            print("[ChartBridge] selection: \(selectedId ?? "none")")

        default:
            print("[ChartBridge] unknown event: \(type)")
        }
    }

    // MARK: - WKNavigationDelegate

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        print("[ChartBridge] page loaded")
    }

    deinit {
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "chartBridge")
    }
}
