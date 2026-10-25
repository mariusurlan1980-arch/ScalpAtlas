package com.scalpatlas.shock.diagnostic

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.IBinder
import android.os.Handler
import android.os.HandlerThread
import android.util.Log
import android.util.DisplayMetrics
import android.view.WindowManager

class CaptureService : Service() {
 private var projection: MediaProjection? = null
 private var reader: ImageReader? = null
 private var display: android.hardware.display.VirtualDisplay? = null
 private val channel = "shock_capture"
 private var captureThread: HandlerThread? = null
 private var framesReceived = 0L
 override fun onBind(intent: Intent?): IBinder? = null
 override fun onCreate() {
  super.onCreate()
  (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(
   NotificationChannel(channel, "ScalpAtlas screen capture", NotificationManager.IMPORTANCE_LOW)
  )
 }
 override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
  if (intent?.action == "STOP") { stopSelf(); return START_NOT_STICKY }
  val consent = if (Build.VERSION.SDK_INT >= 33)
   intent?.getParcelableExtra("consent", Intent::class.java)
  else @Suppress("DEPRECATION") intent?.getParcelableExtra<Intent>("consent")
  val resultCode = intent?.getIntExtra("resultCode", 0) ?: 0
  if (consent == null || resultCode != android.app.Activity.RESULT_OK) {
   stopSelf(); return START_NOT_STICKY
  }
  val notification = Notification.Builder(this, channel)
   .setContentTitle("ScalpAtlas SHOCK")
   .setContentText("Captură ecran autorizată · analiza LIVE nu este activă")
   .setSmallIcon(android.R.drawable.ic_menu_camera)
   .build()
  if (Build.VERSION.SDK_INT >= 29)
   startForeground(21, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)
  else startForeground(21, notification)
  try {
   val manager = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
   projection = manager.getMediaProjection(resultCode, consent)
   projection?.registerCallback(object : MediaProjection.Callback() {
    override fun onStop() { stopSelf() }
   }, null)
   val metrics = DisplayMetrics()
   @Suppress("DEPRECATION")
   (getSystemService(WINDOW_SERVICE) as WindowManager).defaultDisplay.getRealMetrics(metrics)
   reader = ImageReader.newInstance(metrics.widthPixels, metrics.heightPixels, PixelFormat.RGBA_8888, 2)
   captureThread = HandlerThread("shock-frame-reader").also { it.start() }
   reader?.setOnImageAvailableListener({ imageReader ->
    val frame = try { imageReader.acquireLatestImage() } catch (e: Exception) {
     Log.w("ScalpAtlasCapture", "Frame unavailable", e); null
    }
    if (frame != null) {
     try {
      if (frame.width > 0 && frame.height > 0 && frame.planes.isNotEmpty()) {
       framesReceived++
       if (framesReceived % 30L == 1L) {
        val plane = frame.planes[0]
        val buffer = plane.buffer
        val stride = plane.rowStride
        val pixelStride = plane.pixelStride
        val x = frame.width / 2
        val y = frame.height / 2
        val index = y * stride + x * pixelStride
        if (pixelStride >= 4 && index >= 0 && index + 2 < buffer.limit()) {
         val r = buffer.get(index).toInt() and 255
         val g = buffer.get(index + 1).toInt() and 255
         val b = buffer.get(index + 2).toInt() and 255
         Log.d("ScalpAtlasCapture", "Center RGB: $r,$g,$b; no trading signals")
        }
       }
       if (framesReceived % 120L == 1L)
        Log.i("ScalpAtlasCapture", "Frames received: $framesReceived; chart analysis disabled")
      }
     } finally { frame.close() }
    }
   }, Handler(captureThread!!.looper))
   display = projection?.createVirtualDisplay("SHOCK capture", metrics.widthPixels, metrics.heightPixels,
    metrics.densityDpi, DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR, reader?.surface, null, null)
   // No image processing or trading signal is emitted until chart extraction is validated.
  } catch (_: Exception) { stopSelf() }
  return START_NOT_STICKY
 }
 override fun onDestroy() {
  reader?.setOnImageAvailableListener(null, null)
  display?.release(); reader?.close(); projection?.stop()
  captureThread?.quitSafely()
  super.onDestroy()
 }
}
