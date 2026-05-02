import SwiftUI
import UIKit
import shared

struct ComposeView: UIViewControllerRepresentable {
    let bridge: IosAppBridge

    func makeUIViewController(context: Context) -> UIViewController {
        bridge.makeRootViewController()
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {
    }
}
