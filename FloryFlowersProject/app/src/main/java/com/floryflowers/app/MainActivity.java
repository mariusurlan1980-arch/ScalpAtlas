package com.floryflowers.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

public class MainActivity extends Activity {
    private WebView webView;
    private Uri pendingPaymentUri;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        pendingPaymentUri = getIntent() != null ? getIntent().getData() : null;

        webView = new WebView(this);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);

        webView.addJavascriptInterface(new AndroidBridge(), "Android");
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                deliverPaymentIntent();
            }
        });

        setContentView(webView);
        webView.loadUrl("file:///android_asset/index.html?v=129");
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        pendingPaymentUri = intent != null ? intent.getData() : null;
        if (webView != null) {
            webView.post(this::deliverPaymentIntent);
        }
    }

    private void deliverPaymentIntent() {
        if (webView == null || pendingPaymentUri == null) return;
        if (!"floryflowers".equalsIgnoreCase(pendingPaymentUri.getScheme())) return;
        if (!"payment-result".equalsIgnoreCase(pendingPaymentUri.getHost())) return;

        String status = pendingPaymentUri.getQueryParameter("status");
        String orderId = pendingPaymentUri.getQueryParameter("orderId");
        pendingPaymentUri = null;

        if (status == null) status = "error";
        if (orderId == null) orderId = "";

        String js = "window.handlePaymentReturn(" +
                JSONObject.quote(status) + "," +
                JSONObject.quote(orderId) + ");";
        webView.evaluateJavascript(js, null);
    }

    private class AndroidBridge {
        @JavascriptInterface
        public void openExternal(String url) {
            runOnUiThread(() -> {
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    startActivity(intent);
                } catch (Exception ignored) {
                }
            });
        }
    }
}
