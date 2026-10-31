package com.scalpatlas.app

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.graphics.Rect
import android.view.View
import android.os.Handler
import android.os.Looper
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/** Test only; this does not control or inspect other apps. */
class TouchTestService : AccessibilityService() {
  companion object {
    @Volatile private var connected: TouchTestService? = null
    fun ready(): Boolean = connected != null
    @Volatile private var lastCalculatorTestAt = 0L

    /**
     * Cross-app capability proof with one harmless key only: digit 1 in the
     * Google/AOSP Calculator. Never targets broker apps, screen coordinates
     * or financial actions. A user must explicitly press the TEST CALC button.
     *
     * ACTION_CLICK is not a physical screen gesture and its boolean result
     * is NOT proof that the Calculator display changed. Verify visually.
     */
    fun clickCalculatorDigitOne(): String {
      val svc = connected ?: return "CALC: ACCESIBILITATE NECONECTATĂ"
      val now = android.os.SystemClock.elapsedRealtime()
      if (now - lastCalculatorTestAt < 3000L)
        return "CALC: O SINGURĂ PROBĂ LA 3 SECUNDE"
      val root = svc.rootInActiveWindow ?: return "CALC: FEREASTRĂ ACTIVĂ INDISPONIBILĂ"
      val activePackage = root.packageName?.toString() ?: ""
      val allowed = activePackage == "com.google.android.calculator" ||
        activePackage == "com.android.calculator2"
      if (!allowed) return "CALC: DESCHIDE CALCULATOR, NU BROKERUL"
      val matches = root.findAccessibilityNodeInfosByText("1")
        .filter { node ->
          node.packageName?.toString() == activePackage &&
            (node.text?.toString()?.trim() == "1" ||
              node.contentDescription?.toString()?.trim() == "1") &&
            node.isClickable && node.isEnabled && node.isVisibleToUser
        }
      // An ambiguous UI must never result in a random click.
      if (matches.size != 1) return "CALC: CIFRA 1 NU ESTE IDENTIFICATĂ UNIC"
      val button = matches[0]
      val bounds = Rect()
      button.getBoundsInScreen(bounds)
      if (bounds.width() < 15 || bounds.height() < 15 ||
          bounds.left < 0 || bounds.top < 0 ||
          bounds.right > svc.resources.displayMetrics.widthPixels ||
          bounds.bottom > svc.resources.displayMetrics.heightPixels)
        return "CALC: BUTONUL 1 NU ESTE VIZIBIL COMPLET"
      // Double-check the foreground package immediately before the click.
      if (svc.rootInActiveWindow?.packageName?.toString() != activePackage)
        return "CALC: APLICAȚIA ACTIVĂ S-A SCHIMBAT"
      lastCalculatorTestAt = now
      val accepted = button.performAction(AccessibilityNodeInfo.ACTION_CLICK)
      return if (accepted)
        "CALC: COMANDĂ 1 ACCEPTATĂ • VERIFICĂ AFIȘAJUL"
        else "CALC: ANDROID A REFUZAT CLICK 1"
    }
    /**
     * Dispatch a demonstration gesture ONLY into a visible target that belongs
     * to Scalp Atlas's floating window. No arbitrary screen coordinates accepted.
     * The calling Service passes its own overlay root and target View.
     */
    data class OverlayTargetCheck(
      val reason: String,
      val x: Float = 0f,
      val y: Float = 0f
    ) {
      val ready: Boolean get() = reason == "PREGĂTIT"
    }

    /**
     * Fail-closed diagnostics for an OWN-APP test target only. Do not pass
     * broker coordinates, a generic package name, or another app's views.
     */
    fun checkOverlayTarget(overlay: View, target: View): OverlayTargetCheck {
      val svc = connected ?: return OverlayTargetCheck("ACCESIBILITATE NECONECTATĂ")
      if (!overlay.isAttachedToWindow || !overlay.isShown)
        return OverlayTargetCheck("FEREASTRA NU ESTE VIZIBILĂ")
      if (!target.isAttachedToWindow || !target.isShown || !target.isClickable)
        return OverlayTargetCheck("ZONA DE TEST NU ESTE ACTIVĂ")
      if (overlay.windowToken == null || overlay.windowToken != target.windowToken ||
          overlay.context.packageName != svc.packageName ||
          target.context.packageName != svc.packageName)
        return OverlayTargetCheck("ȚINTA NU APARȚINE SUPRAPUNERII")

      // getGlobalVisibleRect is already in global coordinates on some
      // Android versions. Adding getLocationOnScreen again doubles offsets.
      // Use one coordinate space exclusively: absolute screen pixels.
      val rootScreen = IntArray(2)
      val targetScreen = IntArray(2)
      overlay.getLocationOnScreen(rootScreen)
      target.getLocationOnScreen(targetScreen)
      val rootBounds = Rect(
        rootScreen[0], rootScreen[1],
        rootScreen[0] + overlay.width, rootScreen[1] + overlay.height
      )
      val targetBounds = Rect(
        targetScreen[0], targetScreen[1],
        targetScreen[0] + target.width, targetScreen[1] + target.height
      )
      if (rootBounds.isEmpty || targetBounds.isEmpty)
        return OverlayTargetCheck("FEREASTRA DE TEST NU ARE DIMENSIUNI")
      if (targetBounds.width() < 24 || targetBounds.height() < 20 ||
          !rootBounds.contains(targetBounds))
        return OverlayTargetCheck("ZONA DE TEST ESTE PARTIAL ASCUNSA")

      val x = targetBounds.exactCenterX()
      val y = targetBounds.exactCenterY()
      val width = svc.resources.displayMetrics.widthPixels
      val height = svc.resources.displayMetrics.heightPixels
      if (x < 0f || y < 0f || x >= width || y >= height)
        return OverlayTargetCheck("ZONA DE TEST ESTE IN AFARA ECRANULUI")

      // Limit Android gesture tests to the upper, chart-only area.
      // Never allow the gesture near the underlying trade buttons.
      val safeChartBottom = (height * 0.73f).toInt()
      if (targetBounds.bottom >= safeChartBottom)
        return OverlayTargetCheck("ZONĂ PREA JOS • MUTĂ SUPRAPUNEREA SUS")
      if (!overlay.getGlobalVisibleRect(Rect()) ||
          !target.getGlobalVisibleRect(Rect()))
        return OverlayTargetCheck("ZONA ESTE ASCUNSĂ")

      return OverlayTargetCheck("PREGĂTIT", x, y)
    }

    /** Gesture goes only to the verified OWN overlay test target. */
    fun tapVisibleOwnOverlayTarget(
      overlay: View,
      target: View,
      callback: (Boolean) -> Unit
    ): Boolean {
      val svc = connected ?: return false
      val check = checkOverlayTarget(overlay, target)
      if (!check.ready) return false
      val path = Path().apply { moveTo(check.x, check.y) }
      val gesture = GestureDescription.Builder()
        .addStroke(GestureDescription.StrokeDescription(path, 0L, 85L))
        .build()
      return svc.dispatchGesture(gesture, object: GestureResultCallback() {
        override fun onCompleted(gestureDescription: GestureDescription?) {
          callback(true)
        }
        override fun onCancelled(gestureDescription: GestureDescription?) {
          callback(false)
        }
      }, Handler(Looper.getMainLooper()))
    }

    fun tryTestTap(x: Float, y: Float, callback: (Boolean) -> Unit): Boolean {
      val svc = connected ?: return false
      val active = svc.rootInActiveWindow?.packageName?.toString()
      if (active != svc.packageName || x < 0f || y < 0f) return false
      val path = Path().apply { moveTo(x, y) }
      val gesture = GestureDescription.Builder()
        .addStroke(GestureDescription.StrokeDescription(path, 0L, 80L))
        .build()
      return svc.dispatchGesture(gesture, object: GestureResultCallback() {
        override fun onCompleted(gestureDescription: GestureDescription?) {
          callback(true)
        }
        override fun onCancelled(gestureDescription: GestureDescription?) {
          callback(false)
        }
      }, Handler(Looper.getMainLooper()))
    }
  }
  override fun onAccessibilityEvent(event: AccessibilityEvent?) {}
  override fun onInterrupt() {}
  override fun onServiceConnected() {
    super.onServiceConnected()
    connected = this
  }
  override fun onDestroy() {
    if (connected === this) connected = null
    super.onDestroy()
  }
}
