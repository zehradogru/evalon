package com.evalon.shared

import platform.UIKit.UIViewController
import platform.UIKit.UIViewControllerProtocol
import platform.UIKit.UIView
import platform.UIKit.UIViewAutoresizingFlexibleWidth
import platform.UIKit.UIViewAutoresizingFlexibleHeight
import platform.UIKit.setViewController
import platform.darwin.NSObject
import androidx.compose.ui.window.ComposeUIViewController

fun MainViewController(): UIViewController = ComposeUIViewController { App() }
