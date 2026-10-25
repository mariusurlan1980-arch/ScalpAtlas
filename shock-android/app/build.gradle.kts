plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }
android { compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
 namespace = "com.scalpatlas.shock.diagnostic"; compileSdk = 35
 defaultConfig { applicationId = "com.scalpatlas.shock.diagnostic"; minSdk = 26; targetSdk = 35; versionCode = 8; versionName = "0.8-frame-reader" } }
