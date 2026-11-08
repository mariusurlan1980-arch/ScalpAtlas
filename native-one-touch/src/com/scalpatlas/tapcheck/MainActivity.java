package com.scalpatlas.tapcheck;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

public final class MainActivity extends Activity {
  @Override public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    LinearLayout panel = new LinearLayout(this);
    panel.setOrientation(LinearLayout.VERTICAL);
    panel.setBackgroundColor(Color.WHITE);
    panel.setPadding(32, 48, 32, 32);
    TextView title = new TextView(this);
    title.setText("ATLAS – O SINGURA ATINGERE");
    title.setTextSize(23);
    title.setTextColor(Color.rgb(20, 34, 48));
    panel.addView(title);
    TextView desc = new TextView(this);
    desc.setText("\n1. Activeaza serviciul Atlas Proba Atingere in Accesibilitate (o singura data).\n\n2. Deschide Pocket Option QT Demo.\n\nRobotul incearca SINGUR sa apese Tranzactii. Un mesaj de pe ecran confirma daca pagina s-a deschis.\n\nNu atinge BUY/SELL si nu plaseaza ordine.");
    desc.setTextSize(17);
    desc.setTextColor(Color.DKGRAY);
    panel.addView(desc);
    Button enable = new Button(this);
    enable.setText("Deschide Accesibilitate Android");
    enable.setOnClickListener(v ->
      startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)));
    panel.addView(enable);
    setContentView(panel);
  }
}
