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
    fun tapVisibleOwnOverlayTarget(
      overlay: View,
      target: View,
      callback: (Boolean) -> Unit
    ): Boolean {
      val svc = connected ?: return false
      if (!overlay.isAttachedToWindow || !overlay.isShown ||
          !target.isAttachedToWindow || !target.isShown ||
          overlay.windowToken == null || overlay.windowToken != target.windowToken ||
          overlay.context.packageName != svc.packageName ||
          target.context.packageName != svc.packageName ||
          !target.isClickable) return false

      val rootBounds = Rect()
      val targetBounds = Rect()
      if (!overlay.getGlobalVisibleRect(rootBounds) ||
          !target.getGlobalVisibleRect(targetBounds)) return false
      val x = targetBounds.exactCenterX()
      val y = targetBounds.exactCenterY()
      if (targetBounds.width() < 8 || targetBounds.height() < 8 ||
          !rootBounds.contains(x.toInt(), y.toInt()) ||
          x < 0f || y < 0f) return false

      val path = Path().apply { moveTo(x, y) }
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
