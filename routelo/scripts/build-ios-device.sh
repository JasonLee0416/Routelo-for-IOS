#!/bin/sh
# Routelo 배포용(Release) 실기기 빌드·설치 스크립트.
#
# Metro 없이 단독 실행되는 Release 앱을 빌드해 연결된 iPhone에 설치한다.
# JS 번들(main.jsbundle)은 Xcode의 "Bundle React Native code and images"
# 단계에서 앱에 포함된다.
#
# 서명 설정(git 미추적) — ios/local-signing.env 에 정의:
#   DEVELOPMENT_TEAM=ABCDE12345
#   PRODUCT_BUNDLE_IDENTIFIER=com.example.routelo.dev   # (선택) 개인 개발용 ID
#
# 사용:
#   npm run build:ios:device            # 빌드 + 설치 + 실행
#   SKIP_INSTALL=1 npm run build:ios:device   # 빌드만
set -eu

cd "$(dirname "$0")/.."
ROOT=$(pwd)
LOG_DIR="$ROOT/ios/build"
LOG="$LOG_DIR/device-build.log"
mkdir -p "$LOG_DIR"

if [ -f "$ROOT/ios/local-signing.env" ]; then
  # shellcheck disable=SC1091
  . "$ROOT/ios/local-signing.env"
fi

XCODE_ARGS=""
[ -n "${DEVELOPMENT_TEAM:-}" ] && XCODE_ARGS="$XCODE_ARGS DEVELOPMENT_TEAM=$DEVELOPMENT_TEAM"
[ -n "${PRODUCT_BUNDLE_IDENTIFIER:-}" ] && XCODE_ARGS="$XCODE_ARGS PRODUCT_BUNDLE_IDENTIFIER=$PRODUCT_BUNDLE_IDENTIFIER"

echo "==> xcodebuild Release (log: $LOG)"
# shellcheck disable=SC2086
xcodebuild \
  -workspace "$ROOT/ios/Routelo.xcworkspace" \
  -scheme Routelo \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -derivedDataPath "$LOG_DIR/DerivedData" \
  -allowProvisioningUpdates \
  $XCODE_ARGS \
  build > "$LOG" 2>&1 || {
    echo "xcodebuild failed — see $LOG (tail below)" >&2
    tail -30 "$LOG" >&2
    exit 1
  }

APP="$LOG_DIR/DerivedData/Build/Products/Release-iphoneos/Routelo.app"
echo "==> Built: $APP"

[ "${SKIP_INSTALL:-0}" = "1" ] && exit 0

# connected 상태의 기기를 우선, 없으면 목록의 첫 기기로 시도한다.
DEVICES=$(xcrun devicectl list devices --hide-headers 2>/dev/null)
DEVICE=${DEVICE_UDID:-$(printf '%s\n' "$DEVICES" \
  | awk '/connected/ {for (i=1;i<=NF;i++) if ($i ~ /^[0-9A-Fa-f-]{36}$/) {print $i; exit}}')}
[ -z "$DEVICE" ] && DEVICE=$(printf '%s\n' "$DEVICES" \
  | awk '{for (i=1;i<=NF;i++) if ($i ~ /^[0-9A-Fa-f-]{36}$/) {print $i; exit}}')
if [ -z "$DEVICE" ]; then
  echo "iPhone을 찾지 못했습니다. 케이블 연결·잠금 해제 후 다시 시도하거나 DEVICE_UDID를 지정하세요." >&2
  exit 1
fi

BUNDLE_ID=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APP/Info.plist")
echo "==> Installing $BUNDLE_ID on $DEVICE"
xcrun devicectl device install app --device "$DEVICE" "$APP" >> "$LOG" 2>&1
echo "==> Launching"
xcrun devicectl device process launch --device "$DEVICE" "$BUNDLE_ID" >> "$LOG" 2>&1 || {
  echo "설치는 완료. 실행은 폰 잠금 해제 후 앱 아이콘을 탭하세요."
  exit 0
}
echo "==> Done"
