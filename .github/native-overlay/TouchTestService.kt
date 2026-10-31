package com.scalpatlas.app

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.graphics.Rect
import android.view.View
import android.os.Handler
import android.os.Looper
import android.view.accessibility.AccessibilityEvent

/** Test only; this does not control or inspect other apps. */
class TouchTestService : AccessibilityService() {
  companion object {
    @Volatile private var connected: TouchTestService? = null
    fun ready(): Boolean = connected != null
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

      val rootBounds = Rect()
      val targetBounds = Rect()
      if (!overlay.getGlobalVisibleRect(rootBounds) ||
          !target.getGlobalVisibleRect(targetBounds))
        return OverlayTargetCheck("ZONA ESTE ASCUNSĂ")

      val rootScreen = IntArray(2)
      val targetScreen = IntArray(2)
      overlay.getLocationOnScreen(rootScreen)
      target.getLocationOnScreen(targetScreen)
      rootBounds.offset(rootScreen[0], rootScreen[1])
      targetBounds.offset(rootScreen[0], rootScreen[1])
      val x = targetBounds.exactCenterX()
      val y = targetBounds.exactCenterY()
      val expectedX = targetScreen[0] + target.width / 2f
      val expectedY = targetScreen[1] + target.height / 2f
      val maxDelta = 6f * svc.resources.displayMetrics.density
      val safeChartBottom = (svc.resources.displayMetrics.heightPixels * 0.73f).toInt()
      if (targetBounds.bottom >= safeChartBottom)
        return OverlayTargetCheck("ZONĂ PREA JOS • MUTĂ SUPRAPUNEREA SUS")
      if (targetBounds.width() < 24 || targetBounds.height() < 20 ||
          !rootBounds.contains(targetBounds))
        return OverlayTargetCheck("ZONĂ PARȚIAL ASCUNSĂ")
      if (kotlin.math.abs(x - expectedX) > maxDelta ||
          kotlin.math.abs(y - expectedY) > maxDelta ||
          x < 0f || y < 0f ||
          x >= svc.resources.displayMetrics.widthPixels ||
          y >= svc.resources.displayMetrics.heightPixels)
        return OverlayTargetCheck("COORDONATE NEPOTRIVITE")

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
