# iPhone 14 physical-device test

This workflow keeps Xcode, CocoaPods, Simulator runtimes, DerivedData, and
native build output off the local Mac. EAS Build compiles and signs the app in
the cloud; the Mac only runs Metro for interactive debugging.

## Requirements

- Paid Apple Developer Program membership
- Expo account
- Access to the Apple team that owns `com.jasonlee0312.routelo`
- iPhone 14 with Safari

Expo Go cannot run RouteLO because PP-OCR uses ONNX Runtime native code. Use
the project-specific development client produced by EAS.

## Register the phone

Run from `routelo/`:

```bash
npm run eas:login
npm run eas:init
npm run device:register
npm run device:list
```

Open the registration URL on the iPhone, install the device-registration
profile, and confirm the phone appears in `device:list`. If `eas:init` adds an
Expo `projectId` or `owner` to `app.json`, commit that generated identity
before team builds.

## Build and install

```bash
npm run build:ios:device
```

Select the Apple team, allow EAS to create or reuse credentials, and include
the registered iPhone in the provisioning profile. Open the completed build's
installation URL on the iPhone. If requested, enable:

```text
Settings > Privacy & Security > Developer Mode
```

## Run interactively

With the Mac and phone on the same network:

```bash
npm run start:device
```

When local discovery is unavailable:

```bash
npm run start:device:tunnel
```

Tunnel mode loads JavaScript remotely; PP-OCR inference still runs on-device.

## Evidence checklist

1. Record iOS version, source commit, and PP-OCR model version.
2. Cold-launch the app and grant camera/photo-library permissions.
3. Scan one receipt and record cold inference time.
4. Scan it again and record warm inference time.
5. Record recognized-line and manually corrected-field counts.
6. Confirm registration persists after app restart.
7. Load the JavaScript bundle, disable networking, and repeat OCR.
8. Scan five receipts consecutively and note heat, termination, or memory
   warnings.
9. Verify safe areas, keyboard, sheets, dark mode, calling, and permission
   denial/cancellation paths.

## Cleanup

Preview generated paths:

```bash
npm run cleanup:device-test
```

Delete generated native/Expo output:

```bash
npm run cleanup:device-test -- --apply
```

Also delete project dependencies when local work is finished:

```bash
npm run cleanup:device-test -- --apply --dependencies
```

The shared npm cache is intentionally not removed.
