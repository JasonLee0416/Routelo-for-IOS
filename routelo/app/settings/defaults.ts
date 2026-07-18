import {
  DEFAULT_DISTRICT_FEE,
  GYEONGGI_DISTRICTS,
  SEOUL_DISTRICTS,
} from './districts';
import {
  RouteloSettings,
  SETTINGS_SCHEMA_VERSION,
} from './schema';

const districtDefaults = (districts: readonly string[]) =>
  Object.fromEntries(
    districts.map((district) => [district, DEFAULT_DISTRICT_FEE]),
  );

export const DEFAULT_ROUTELO_SETTINGS: RouteloSettings = {
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  business: {
    targetArrivalMinutesBeforeEvent: 30,
    defaultInstallationMinutes: 20,
    completionRequiresPhoto: false,
    completionRequiresTimestamp: true,
  },
  fees: {
    currency: 'KRW',
    defaultFee: DEFAULT_DISTRICT_FEE,
    districtFees: {
      Seoul: districtDefaults(SEOUL_DISTRICTS),
      Gyeonggi: districtDefaults(GYEONGGI_DISTRICTS),
      Incheon: {},
      custom: {},
    },
    feeCalculationMode: 'district',
  },
  costs: {
    vehicleModel: '현대 포터2',
    fuelEfficiency: 12.4,
    fuelTankCapacity: 65,
    fuelType: 'diesel',
    profitBasis: 'daily',
  },
  privacy: {
    preserveOriginalReceiptImage: true,
    preserveOcrRawText: true,
    preserveCompletionPhotos: true,
    preserveCorrectionHistory: true,
    retentionPeriod: 'forever',
    showFullAddressInList: true,
    showFullPhoneInList: false,
    showSensitiveInfoInNotifications: false,
    hideContentInAppSwitcher: true,
  },
  security: {
    appLockEnabled: false,
    biometricUnlockEnabled: false,
    encryptLocalSensitiveData: false,
    encryptBackupFiles: true,
    requireConfirmBeforeExportWithPersonalData: true,
  },
  ocr: {
    requireReviewBelowConfidence: 85,
    allowAliasLearning: true,
    preserveUnmappedLines: true,
    blockAutoRegistrationWhenRequiredFieldsMissing: true,
    onlineVendorVerification: false,
  },
  notifications: {
    strictDeadlineEnabled: true,
    eventTimeEnabled: true,
    delayRiskEnabled: true,
    completionMissingEnabled: true,
    strictDeadlineLeadMinutes: [60, 30],
    eventLeadMinutes: [120, 60],
    alertMode: 'both',
    soundName: 'routelo_ding',
  },
  appearance: {
    themeMode: 'light',
    listDensity: 'comfortable',
  },
  route: {
    routeMode: 'deadline-first',
    navApp: 'tmap',
    allowManualReorder: true,
  },
  account: {
    mode: 'guest',
    backupEnabled: false,
    syncEnabled: false,
  },
  telemetry: {
    enabled: false,
  },
  // 베타 파운딩 멤버: 결제 없이 Pro 전 기능 오픈. 정식 유료화 시 'free'로 전환.
  entitlement: {
    plan: 'pro',
  },
};
