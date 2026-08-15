# Android packaging (Trusted Web Activity)

This project is prepared to be packaged as an Android app using Bubblewrap / Trusted Web Activity.

## App identity

- App name: הדרך של מאור
- Suggested application ID: `com.ronengoldenberg.simplerouteguide`
- Web manifest: `/manifest.json`
- Start URL: `/`

## Build

After the latest Worker deployment is live, install Bubblewrap and initialize from the production manifest URL:

```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest=https://YOUR-PRODUCTION-HOST/manifest.json
bubblewrap build
```

Keep the generated signing keystore private. Do not commit it to Git.

## Digital Asset Links

A Trusted Web Activity requires the website to prove ownership of the Android application. After the Android signing certificate exists, obtain its SHA-256 fingerprint and publish:

`https://YOUR-PRODUCTION-HOST/.well-known/assetlinks.json`

Use this shape, replacing the fingerprint:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.ronengoldenberg.simplerouteguide",
    "sha256_cert_fingerprints": ["REPLACE_WITH_SHA256_FINGERPRINT"]
  }
}]
```

For a local APK, use the certificate fingerprint of the local signing key. If Google Play App Signing is enabled, also add the Play app-signing certificate fingerprint from Play Console; it is normally different from the upload key.

## Important

Do not publish a fake or placeholder certificate fingerprint. Until the real fingerprint is known, Digital Asset Links verification cannot be completed and Android may open the site as a Custom Tab rather than a full Trusted Web Activity.
