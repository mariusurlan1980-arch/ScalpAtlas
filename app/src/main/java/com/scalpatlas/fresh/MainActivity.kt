package com.scalpatlas.fresh

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class MainActivity : Activity() {
    private lateinit var status: TextView
    private var preview: LiveChartPreview? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val padding = (24 * resources.displayMetrics.density).toInt()
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(padding, padding, padding, padding)
        }
        content.addView(TextView(this).apply {
            text = getString(R.string.app_name)
            textSize = 26f
        })
        status = TextView(this).apply {
            textSize = 16f
            setPadding(0, padding, 0, padding)
        }
        content.addView(status)
        content.addView(Button(this).apply {
            setText(R.string.open_accessibility)
            setOnClickListener {
                startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
            }
        })
        val signalStatus = TextView(this)
        content.addView(Button(this).apply {
            setText(R.string.start_live_preview)
            setOnClickListener {
                if (preview == null) {
                    preview = LiveChartPreview(this@MainActivity) { side ->
                        signalStatus.text = getString(R.string.live_preview_signal, side)
                    }
                }
            }
        })
        content.addView(signalStatus)
        setContentView(content)
    }

    override fun onDestroy() {
        preview?.close()
        preview = null
        super.onDestroy()
    }

    override fun onResume() {
        super.onResume()
        val service = ScalpAtlasAccessibilityService.connected
        status.setText(when (service?.chartDiagnostic) {
            null -> R.string.accessibility_disconnected
            ScalpAtlasAccessibilityService.ChartDiagnostic.WAITING -> R.string.accessibility_connected
            ScalpAtlasAccessibilityService.ChartDiagnostic.DEMO_UNCONFIRMED -> R.string.chart_demo_unconfirmed
            ScalpAtlasAccessibilityService.ChartDiagnostic.M5_UNAVAILABLE -> R.string.chart_m5_unavailable
            ScalpAtlasAccessibilityService.ChartDiagnostic.M5_AVAILABLE -> R.string.chart_m5_available
        })
    }
}
