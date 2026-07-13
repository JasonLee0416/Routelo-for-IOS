# iPhone 실기기 테스트 (Release 빌드)

이 저장소는 **Metro 없이 단독 실행되는 배포용(Release) 빌드**로만 실기기
테스트를 한다. JS 번들(main.jsbundle)은 빌드 시 앱에 포함되므로 설치 후
Mac·개발 서버 없이 동작한다.

## 요구 사항

- Mac + Xcode (26 이상 권장)
- CocoaPods (`brew install cocoapods`)
- 케이블로 연결된 iPhone (개발자 모드 활성화:
  설정 > 개인정보 보호 및 보안 > 개발자 모드)
- Apple 개발 팀 — 무료 개인 팀으로 충분 (7일 서명)

## 서명 설정 (1회)

`routelo/ios/local-signing.env` 파일을 만든다 (git 미추적):

```sh
DEVELOPMENT_TEAM=ABCDE12345                        # Xcode 계정의 팀 ID
PRODUCT_BUNDLE_IDENTIFIER=com.example.routelo.dev  # (선택) 개인 개발용 번들 ID
```

원 소유자 팀(`com.jasonlee0312.routelo.ios`)이 아니면 반드시 자신의
번들 ID를 지정한다.

## 빌드·설치·실행

```bash
cd routelo
npm install
npm run build:ios:device
```

빌드 로그는 `ios/build/device-build.log`에 남는다. 설치 시 폰이 잠겨 있으면
실행 단계만 실패하는데, 잠금 해제 후 앱 아이콘을 탭하면 된다.

빌드만 하고 설치를 생략하려면:

```bash
SKIP_INSTALL=1 npm run build:ios:device
```

특정 기기를 지정하려면 (`xcrun devicectl list devices`로 확인):

```bash
DEVICE_UDID=<CoreDevice-UUID> npm run build:ios:device
```

## 검증 체크리스트

1. iOS 버전, 소스 커밋, PP-OCR 모델 버전을 기록한다.
2. 콜드 런치 후 카메라/사진 권한을 허용한다.
3. 인수증 1장을 스캔해 콜드 인식 시간을 기록한다.
4. 같은 인수증을 다시 스캔해 웜 인식 시간을 기록한다.
5. 인식 라인 수·수동 수정 필드 수를 기록한다.
6. 앱 재시작 후 등록 데이터가 유지되는지 확인한다.
7. 네트워크를 끄고 OCR을 반복한다 (온디바이스 확인).
8. 인수증 5장을 연속 스캔하며 발열·종료·메모리 경고를 확인한다.
9. 세이프에어리어, 키보드, 시트, 다크 모드, 전화 걸기, 권한
   거부/취소 경로를 확인한다.
10. 알림음 미리듣기(설정 > 알림)와 예약 알림 발화를 확인한다.

## 정리

생성물 미리 보기 / 삭제:

```bash
npm run cleanup:device-test              # dry run
npm run cleanup:device-test -- --apply   # ios/build·ios/Pods 삭제
npm run cleanup:device-test -- --apply --dependencies   # + node_modules
```
