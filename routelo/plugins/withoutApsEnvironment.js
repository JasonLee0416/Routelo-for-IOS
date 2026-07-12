const { withEntitlementsPlist } = require('@expo/config-plugins');

// 무료 개인 Apple 팀(Personal Team)은 Push Notifications(aps-environment) capability를
// 지원하지 않아, expo-notifications가 자동으로 넣는 이 엔타이틀먼트가 있으면
// 실기기 프로비저닝 프로필 생성이 실패한다("...do not support the Push Notifications capability").
//
// RouteLO는 원격 푸시가 아니라 로컬 알림(예약 알림/알림음/진동)만 사용하므로 이 권한이 필요 없다.
// expo-notifications 플러그인 이후에 실행되도록 app.json plugins 배열의 뒤쪽에 배치해,
// 자동 추가된 aps-environment를 다시 제거한다. → 무료 계정으로도 디바이스 빌드가 통과된다.
//
// (추후 실제 원격 푸시를 도입한다면 유료 Apple Developer 계정으로 전환하고 이 플러그인을 제거.)
module.exports = function withoutApsEnvironment(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults['aps-environment'];
    return cfg;
  });
};
