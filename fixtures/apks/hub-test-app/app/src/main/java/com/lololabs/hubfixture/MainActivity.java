package com.lololabs.hubfixture;

import android.app.Activity;
import android.os.Bundle;
import android.widget.TextView;

public final class MainActivity extends Activity {
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    TextView text = new TextView(this);
    text.setText("Solana Android Hub installation fixture\nVersion " + BuildConfig.VERSION_NAME);
    text.setTextSize(22);
    text.setPadding(48, 96, 48, 48);
    setContentView(text);
  }
}
