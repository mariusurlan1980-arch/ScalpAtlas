package com.scalpatlas.tapcheck2;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.graphics.Color;
import android.graphics.Path;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.graphics.drawable.GradientDrawable;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.DisplayMetrics;
import android.view.Gravity;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.widget.TextView;
import java.util.ArrayDeque;
import java.util.Locale;

/**
 * A diagnostic pilot, not a trading engine.
 * Exactly one Android gesture on a browser-labelled, broker-verified
 * Transactions navigation control. BUY/SELL and stake fields are NEVER touched.
 */
public final class PilotService extends AccessibilityService {
  private static final String BROKER1 = "com.pocketoption.broker";
  private static final String BROKER2 = "com.potradeweb";
  private final Handler handler = new Handler(Looper.getMainLooper());
  private WindowManager windowManager;
  private TextView banner;
  private boolean attempted = false;
  private boolean verified = false;
  private long attemptedAt = 0;
  private long lastReadAt = 0;
  private int seen = 0;
  private float seenX = -1, seenY = -1;
  private String latest = "";

  private final Runnable inspector = new Runnable() {
    @Override public void run() {
      checkBroker();
      handler.postDelayed(this, 650L);
    }
  };

  private static final class Observation {
    boolean qtDemo, qtReal, openTab, closedTab;
    int navCount;
    float navX, navY;
    boolean ambiguous;
  }

  @Override protected void onServiceConnected() {
    super.onServiceConnected();
    showBanner();
    update("ROBOT ACTIV • DESCHIDE QT DEMO");
    handler.post(inspector);
  }

  @Override public void onAccessibilityEvent(AccessibilityEvent event) {
    // The periodic inspect also works when the WebView sends few events.
    if (event != null && isBroker(String.valueOf(event.getPackageName())))
      handler.post(this::checkBroker);
  }

  @Override public void onInterrupt() {
    update("ACCESIBILITATE INTRERUPTA");
  }

  @Override public void onDestroy() {
    handler.removeCallbacks(inspector);
    if (banner != null && windowManager != null) {
      try { windowManager.removeView(banner); } catch (Exception ignored) {}
    }
    banner = null;
    super.onDestroy();
  }

  private boolean isBroker(String pkg) {
    return BROKER1.equals(pkg) || BROKER2.equals(pkg);
  }

  private String normalized(CharSequence raw) {
    if (raw == null) return "";
    return raw.toString().trim().toLowerCase(Locale.ROOT)
      .replace('ţ', 'ț').replace('ş', 'ș')
      .replaceAll("\\s+", " ");
  }

  private boolean navLabel(String text) {
    return text.equals("tranzacții") || text.equals("tranzactii") ||
      text.equals("transactions") || text.equals("trades");
  }

  private void scanValue(String text, Rect rect, int width, int height,
                         Observation result) {
    if (text.isEmpty()) return;
    if (rect.centerY() < height * .24f) {
      if (text.contains("qt real")) result.qtReal = true;
      if (text.contains("qt demo")) result.qtDemo = true;
    }
    if (rect.centerY() > height * .14f && rect.centerY() < height * .39f) {
      if (text.equals("deschis") || text.equals("open")) result.openTab = true;
      if (text.equals("închis") || text.equals("inchis") ||
          text.equals("closed")) result.closedTab = true;
    }
    if (navLabel(text) && rect.centerX() >= width * .02f &&
        rect.centerX() <= width * .36f &&
        rect.centerY() >= height * .83f &&
        rect.centerY() <= height * .98f &&
        rect.width() >= 10 && rect.height() >= 10 &&
        rect.width() < width * .32f && rect.height() < height * .09f) {
      if (result.navCount > 0 &&
          (Math.abs(result.navX - rect.exactCenterX()) > width * .07f ||
           Math.abs(result.navY - rect.exactCenterY()) > height * .03f))
        result.ambiguous = true;
      result.navX = rect.exactCenterX();
      result.navY = rect.exactCenterY();
      result.navCount++;
    }
  }

  private Observation readBroker(AccessibilityNodeInfo root, String pkg,
                                 int width, int height) {
    Observation result = new Observation();
    ArrayDeque<AccessibilityNodeInfo> nodes = new ArrayDeque<>();
    nodes.add(root);
    int inspected = 0;
    while (!nodes.isEmpty() && inspected++ < 400) {
      AccessibilityNodeInfo node = nodes.removeFirst();
      if (pkg.contentEquals(node.getPackageName()) && node.isVisibleToUser()) {
        Rect rect = new Rect();
        node.getBoundsInScreen(rect);
        if (!rect.isEmpty() && rect.left >= 0 && rect.top >= 0 &&
            rect.right <= width && rect.bottom <= height) {
          scanValue(normalized(node.getText()), rect, width, height, result);
          scanValue(normalized(node.getContentDescription()),
            rect, width, height, result);
        }
      }
      for (int i = 0; i < Math.min(node.getChildCount(), 32); i++) {
        AccessibilityNodeInfo child = node.getChild(i);
        if (child != null) nodes.addLast(child);
      }
    }
    return result;
  }

  private void checkBroker() {
    AccessibilityNodeInfo root;
    try { root = getRootInActiveWindow(); }
    catch (Exception ignored) { root = null; }
    if (root == null) {
      if (!attempted) update("ASTEAPTA FEREASTRA BROKER");
      return;
    }
    String pkg = String.valueOf(root.getPackageName());
    if (!isBroker(pkg)) {
      if (!attempted) update("DESCHIDE POCKET OPTION QT DEMO");
      return;
    }
    DisplayMetrics dm = new DisplayMetrics();
    try {
      windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
      windowManager.getDefaultDisplay().getRealMetrics(dm);
      if (dm.widthPixels < 300 || dm.heightPixels < 600) {
        update("DIMENSIUNI ECRAN NECONFIRMATE"); return;
      }
      Observation obs = readBroker(root, pkg, dm.widthPixels, dm.heightPixels);
      if (obs.qtReal) { update("QT REAL • BLOCAT • FARA APASARE"); return; }
      if (attempted) {
        if (obs.openTab && obs.closedTab) {
          verified = true;
          update("REUSIT • TRANZACTII DESCHISE AUTOMAT");
        } else if (!verified && SystemClock.elapsedRealtime() - attemptedAt > 9000L) {
          update("GEST TRIMIS, DAR PAGINA NECONFIRMATA • STOP");
        }
        return; // Absolutely no second gesture in this service session.
      }
      if (!obs.qtDemo) { update("QT DEMO NECITIBIL • FARA APASARE"); return; }
      if (obs.ambiguous || obs.navCount == 0) {
        seen = 0;
        update("NU GASESC ETICHETA TRANZACTII • FARA APASARE");
        return;
      }
      long now = SystemClock.elapsedRealtime();
      if (seen > 0 && now - lastReadAt >= 150L &&
          now - lastReadAt <= 3200L &&
          Math.abs(seenX - obs.navX) <= dm.widthPixels * .025f &&
          Math.abs(seenY - obs.navY) <= dm.heightPixels * .015f) {
        seen++;
      } else { seen = 1; }
      seenX = obs.navX;
      seenY = obs.navY;
      lastReadAt = now;
      if (seen < 2) {
        update("QT DEMO CONFIRMAT • VERIFIC BUTON 1/2");
        return;
      }
      attempted = true;
      attemptedAt = now;
      update("APAS TRanzactii • O SINGURA DATA");
      Path path = new Path();
      path.moveTo(seenX, seenY);
      GestureDescription gesture = new GestureDescription.Builder()
        .addStroke(new GestureDescription.StrokeDescription(path, 0L, 85L))
        .build();
      boolean submitted = dispatchGesture(gesture,
        new GestureResultCallback() {
          @Override public void onCompleted(GestureDescription g) {
            update("ATINGERE TRIMISA • VERIFIC PAGINA");
          }
          @Override public void onCancelled(GestureDescription g) {
            update("ANDROID A ANULAT ATINGEREA • STOP");
          }
        }, handler);
      if (!submitted) update("ANDROID A RESPINS GESTUL • STOP");
    } catch (Exception err) {
      update("EROARE GEST • STOP • " + err.getClass().getSimpleName());
      attempted = true;
    }
  }

  private void showBanner() {
    try {
      windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
      banner = new TextView(this);
      banner.setTextSize(13);
      banner.setTextColor(Color.rgb(29, 42, 53));
      banner.setPadding(18, 12, 18, 12);
      GradientDrawable bg = new GradientDrawable();
      bg.setColor(Color.WHITE);
      bg.setCornerRadius(20);
      bg.setStroke(3, Color.rgb(25, 160, 140));
      banner.setBackground(bg);
      WindowManager.LayoutParams params = new WindowManager.LayoutParams(
        WindowManager.LayoutParams.WRAP_CONTENT,
        WindowManager.LayoutParams.WRAP_CONTENT,
        WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE |
        WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE,
        PixelFormat.TRANSLUCENT);
      params.gravity = Gravity.TOP | Gravity.LEFT;
      params.x = 12;
      params.y = 96;
      windowManager.addView(banner, params);
    } catch (Exception ignored) { banner = null; }
  }

  private void update(String value) {
    if (value.equals(latest)) return;
    latest = value;
    if (banner != null) handler.post(() -> {
      if (banner != null) banner.setText(value);
    });
  }
}
