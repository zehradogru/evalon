package com.evalon.shared

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.UIKitView
import kotlinx.cinterop.ExperimentalForeignApi
import platform.CoreGraphics.CGRectMake
import platform.Foundation.NSURL
import platform.Foundation.NSURLRequest
import platform.WebKit.WKWebView

@OptIn(ExperimentalForeignApi::class)
@Composable
actual fun PlatformWebPage(
    url: String,
    modifier: Modifier
) {
    UIKitView(
        modifier = modifier,
        factory = {
            WKWebView(frame = CGRectMake(0.0, 0.0, 0.0, 0.0)).apply {
                NSURL(string = url)?.let { requestUrl ->
                    loadRequest(NSURLRequest(requestUrl))
                }
            }
        },
        update = { webView ->
            val current = webView.URL?.absoluteString
            if (current != url) {
                NSURL(string = url)?.let { requestUrl ->
                    webView.loadRequest(NSURLRequest(requestUrl))
                }
            }
        }
    )
}
