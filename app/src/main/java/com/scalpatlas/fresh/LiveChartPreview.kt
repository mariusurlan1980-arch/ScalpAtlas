package com.scalpatlas.fresh

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import java.io.IOException
import org.json.JSONObject
import java.util.concurrent.FutureTask
import java.util.concurrent.TimeUnit

internal class LiveChartPreview(context: Context, onSignal: (String) -> Unit) {
    private val main = Handler(Looper.getMainLooper())
    private val view = WebView(context)

    init {
        view.settings.javaScriptEnabled = true
        view.settings.allowFileAccess = false
        view.settings.allowContentAccess = false
        view.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest,
            ): Boolean = true

            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest,
            ): WebResourceResponse {
                val url = request.url
                val filename = url.path?.removePrefix("/engine/").orEmpty()
                if (request.method != "GET" || url.scheme != "https" ||
                    url.encodedAuthority != "appassets.androidplatform.net" ||
                    url.path != "/engine/$filename") return blockedResource()

                val type = when (filename) {
                    "live.html" -> "text/html"
                    "m5-candles.mjs", "shock.mjs" -> "text/javascript"
                    else -> return blockedResource()
                }
                return try {
                    WebResourceResponse(type, "UTF-8", context.assets.open("engine/$filename"))
                } catch (_: IOException) {
                    blockedResource()
                }
            }

            private fun blockedResource() =
                WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", emptyMap(),
                    java.io.ByteArrayInputStream(byteArrayOf()))
        }
        view.addJavascriptInterface(object {
            @JavascriptInterface
            fun read(): String {
                val task = FutureTask { serialize(LiveOrderBridge().readM5Chart()) }
                main.post(task)
                return try {
                    task.get(800, TimeUnit.MILLISECONDS)
                } catch (_: Exception) {
                    task.cancel(false)
                    "{}"
                }
            }

            @JavascriptInterface
            fun report(side: String) {
                if (side == "BUY" || side == "SELL") main.post { onSignal(side) }
            }
        }, "AtlasChart")
        view.loadUrl("https://appassets.androidplatform.net/engine/live.html")
    }

    fun close() {
        view.removeJavascriptInterface("AtlasChart")
        view.destroy()
    }

    private fun serialize(frame: AccessibleM5Frame?): String {
        if (frame == null) return "{}"
        return JSONObject()
            .put("account", "QT Demo")
            .put("activePair", frame.activePair)
            .put("timeframe", "M5")
            .put("time", frame.time)
            .put("price", frame.price)
            .put("previous", JSONObject().put("start", frame.previousStart)
                .put("open", frame.previousOpen).put("close", frame.previousClose).put("closed", true))
            .put("current", JSONObject().put("start", frame.currentStart).put("open", frame.currentOpen))
            .toString()
    }
}
