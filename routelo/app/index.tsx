import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Easing,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Ionicons } from './platform/icons';
import * as FileSystem from './platform/fs';
import * as ImagePicker from './platform/imagePicker';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { AccountState, EnergyType } from './account';
import { accountRepository } from './account/native';
import {
  applyManualEdit,
  createManualDeliveryOrder,
  DeliveryOrder,
  evaluateCalendarRisks,
  legacyDeliveryToOrder,
  ManualOrderInput,
  orderToLegacyDelivery,
  orderToManualInput,
  toCalendarDeliveryItem,
  validateManualOrderInput,
} from './domain';
import {
  ContactLog,
  Delivery,
  FuelLog,
  MileageLog,
  OcrFieldKey,
  OcrFieldResult,
  OcrPipelineResult,
} from './models';
import {
  contactLogRepository,
  deliveryRepository,
  fuelLogRepository,
  mileageLogRepository,
} from './repositories/native';
import { applyBackup, buildBackupJson, parseBackup } from './services/backup';
import {
  buildContactLog,
  formatLocalContactTime,
  recentContactsForDelivery,
} from './services/contactLog';
import {
  attachCompletionPhoto,
  clearCompletionPhoto,
  completionPhotoDir,
  completionPhotoRelativePath,
  resolveCompletionPhotoUri,
} from './services/completionPhoto';
import {
  attachReceiptPhoto,
  receiptPhotoDir,
  receiptPhotoRelativePath,
  resolveReceiptPhotoUri,
} from './services/receiptPhoto';
import { mergeSettingsV2 } from './settings/migrations';
import {
  DeliverySortMode,
  filterDeliveries,
  sortDeliveries,
} from './services/deliveryFilter';
import { summarizeDeliveryStats } from './services/deliveryStats';
import {
  summarizeEfficiency,
  summarizeEfficiencyByVehicle,
} from './services/efficiency';
import { deadlineStatus } from './services/deadline';
import { buildDailyProfitCsv } from './services/export';
import { planDeliveryNotifications } from './services/notificationPlan';
import {
  cancelAllScheduledNotifications,
  ensureNotificationPermission,
  sendTestNotification,
  syncScheduledNotifications,
} from './services/notifications';
import { formatWonShort } from './services/money';
import { dialableTargets, formatPhone } from './services/phone';
import {
  applyFuelLogEdit,
  createFuelLog,
  FuelLogInput,
  fuelLogToInput,
  validateFuelLogInput,
} from './services/fuel';
import {
  applyMileageLogEdit,
  createMileageLog,
  MileageLogInput,
  mileageLogToInput,
  validateMileageLogInput,
} from './services/mileage';
import {
  calculateFeeByAddress,
  findDistrictByAddress,
  optimizeByNearestNeighbor,
} from './services/maps';
import { NAV_APP_LABEL, openNavigation } from './services/navigation';
import { flush as flushTelemetry, pendingReportCount, recordScanReview } from './telemetry';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AppPlan,
  FREE_DAILY_SCAN_LIMIT,
  isFeatureEnabled,
  PRO_FEATURES,
  remainingFreeScans,
  resolvePlan,
} from './entitlements/plan';
import { buildRevenueReport, ReportRange } from './reports/revenueReport';
import {
  addVehicle,
  buildFleetSummary,
  dedupeVehicles,
  isValidVehicleLabel,
  MAX_VEHICLES,
  removeVehicle,
} from './vehicles/registry';
import { MAX_FONT_MULTIPLIER } from './theme/dynamicType';
import { getTodayScanCount, incrementScanCount } from './entitlements/usage';
import { ErrorBoundary } from './reliability/ErrorBoundary';
import { installGlobalErrorHandler } from './reliability/errorReporting';
import { LockGate } from './security/LockGate';
import {
  clearLockoutState,
  clearPin,
  isValidPin,
  setPin,
} from './security/appLock';
import { toCsv } from './export/csv';
import {
  bucketProfit,
  DailyProfitSummary,
  ProfitPeriod,
  summarizeDailyProfit,
  totalProfit,
} from './services/profit';
import { DEFAULT_ROUTELO_SETTINGS, NavApp, RouteloSettings } from './settings';
import type {
  NotificationAlertMode,
  NotificationSoundName,
} from './settings/schema';
import { GYEONGGI_DISTRICTS, SEOUL_DISTRICTS } from './settings/districts';
import { settingsRepository } from './settings/native';
import { makeStyles, styles } from './theme/appStyles';
import {
  ConfidenceBadge,
  PhoneKindBadge,
  QualityMeter,
  StatusBadge,
} from './components/badges';
import {
  CompactDelivery,
  MetricCard,
  ProgressCard,
  ScreenHeader,
  SectionHeader,
  TimeAlertCard,
} from './components/layout';
import { NotificationCard, SettingRow } from './components/rows';
import {
  addMinutes,
  formatWon,
  isEventDelivery,
  maskAddressForList,
  timeOf,
} from './services/format';
import {
  PrivacyContext,
  ThemeContext,
  usePrivacy,
  useTheme,
} from './theme/context';
import { GlassSurface, useReduceMotion } from './theme/GlassSurface';
import { DARK, LIGHT, Palette } from './theme/palette';
import { RADIUS } from './theme/tokens';
import {
  VendorCandidate,
  vendorCandidateApplications,
  vendorDirectoryFor,
  VendorVerification,
  verifyVendor,
} from './vendor';
import {
  inspectCaptureQuality,
  OcrNoTextDetectedError,
  OcrRecognizerUnavailableError,
  runReceiptOcr,
} from './services/ocr';

type TabKey =
  | 'home'
  | 'deliveries'
  | 'calendar'
  | 'route'
  | 'notifications'
  | 'settings';
type DeliveryFilter = 'all' | 'pending' | 'completed';

const C = LIGHT;

const tabs: Array<{
  key: TabKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
}> = [
  { key: 'home', label: '홈', icon: 'grid-outline', activeIcon: 'grid' },
  { key: 'deliveries', label: '배달', icon: 'cube-outline', activeIcon: 'cube' },
  {
    key: 'calendar',
    label: '일정',
    icon: 'calendar-outline',
    activeIcon: 'calendar',
  },
  { key: 'route', label: '동선', icon: 'map-outline', activeIcon: 'map' },
  {
    key: 'notifications',
    label: '알림',
    icon: 'notifications-outline',
    activeIcon: 'notifications',
  },
  { key: 'settings', label: '설정', icon: 'settings-outline', activeIcon: 'settings' },
];


// 온보딩 기본 플레이스홀더 이름은 개인화에서 제외 — 실제 사용자가 입력한
// 이름일 때만 "안녕하세요, ㅇㅇㅇ 기사님"으로 부른다.
const GREETING_PLACEHOLDER_NAMES = new Set(['게스트 기사', '업무 기사', '게스트']);

function driverGreetingName(account?: AccountState): string | undefined {
  const name = account?.profile.displayName?.trim();
  if (!name || GREETING_PLACEHOLDER_NAMES.has(name)) return undefined;
  return name;
}

function HomeScreen({
  deliveries,
  greetingName,
  onDeliveryPress,
  onSeeAll,
  onNotifications,
}: {
  deliveries: Delivery[];
  greetingName?: string;
  onDeliveryPress: (delivery: Delivery) => void;
  onSeeAll: () => void;
  onNotifications: () => void;
}) {
  const { C, styles } = useTheme();
  const pending = deliveries.filter((item) => item.status === 'pending');
  const completed = deliveries.length - pending.length;
  const optimized = optimizeByNearestNeighbor(pending);
  const eventDelivery = pending.find(isEventDelivery);
  const deadline = pending[0];
  const remainingDistance = pending.reduce((sum, item) => sum + item.distanceKm, 0);

  return (
    <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
      <ScreenHeader
        eyebrow="ROUTELO · 오늘의 운영"
        title={greetingName ? `안녕하세요, ${greetingName} 기사님` : '안녕하세요, 기사님'}
        subtitle="마감 시간과 우선 배송을 먼저 확인하세요."
        notificationCount={3}
        onNotificationPress={onNotifications}
      />

      <View style={styles.metricsGrid}>
        <MetricCard icon="cube-outline" label="오늘 전체" value={`${deliveries.length}건`} />
        <MetricCard icon="checkmark-circle-outline" label="완료" value={`${completed}건`} tone="success" />
        <MetricCard icon="time-outline" label="남은 배달" value={`${pending.length}건`} tone="warning" />
      </View>

      <ProgressCard completed={completed} total={deliveries.length} distance={remainingDistance} />

      <SectionHeader title="시간 엄수 알림" caption="가장 가까운 중요 일정" />
      {!!deadline && (
        <TimeAlertCard
          type="deadline"
          time={timeOf(deadline.deliveryDt)}
          title={deadline.productName}
          address={deadline.deliveryAddress}
        />
      )}
      {!!eventDelivery && (
        <TimeAlertCard
          type="event"
          time={eventDelivery.eventTime}
          title={`${eventDelivery.productName} 예식`}
          address={eventDelivery.deliveryAddress}
        />
      )}

      <SectionHeader
        title="다음 배달"
        caption="최적화된 방문 순서"
        action={
          <Pressable style={styles.textButton} onPress={onSeeAll}>
            <Text style={styles.textButtonLabel}>전체 보기</Text>
            <Ionicons name="arrow-forward" size={16} color={C.primary} />
          </Pressable>
        }
      />
      <View style={styles.surfaceCard}>
        {optimized.slice(0, 3).map((delivery, index) => (
          <View key={delivery.id}>
            <CompactDelivery
              delivery={delivery}
              index={index}
              onPress={() => onDeliveryPress(delivery)}
            />
            {index < Math.min(optimized.length, 3) - 1 && <View style={styles.divider} />}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function DeliveryCard({
  delivery,
  onPress,
}: {
  delivery: Delivery;
  onPress: () => void;
}) {
  const { C, styles } = useTheme();
  const { showFullAddressInList } = usePrivacy();
  const urgent = isEventDelivery(delivery);
  const estimatedArrival = addMinutes(timeOf(delivery.deliveryDt), -18);
  return (
    <View style={styles.deliveryCard}>
      <View style={styles.rowBetween}>
        <View style={styles.deliveryCardTitleGroup}>
          <View style={[styles.destinationIcon, urgent && styles.destinationIconUrgent]}>
            <Ionicons name={urgent ? 'calendar' : 'location'} size={20} color={urgent ? C.danger : C.primary} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.destinationName}>{delivery.productName}</Text>
            <Text style={styles.destinationVendor}>{delivery.orderVendor}</Text>
          </View>
        </View>
        <StatusBadge status={delivery.status} />
      </View>
      <Text style={styles.deliveryAddress}>
        {showFullAddressInList
          ? delivery.deliveryAddress
          : maskAddressForList(delivery.deliveryAddress)}
      </Text>

      <View style={styles.deliveryTimeGrid}>
        <View style={styles.deliveryTimeCell}>
          <Text style={styles.deliveryTimeCellLabel}>도착 예정</Text>
          <Text style={styles.deliveryTimeCellValue}>{estimatedArrival}</Text>
        </View>
        <View style={styles.deliveryTimeCell}>
          <Text style={styles.deliveryTimeCellLabel}>엄수 마감</Text>
          <Text style={[styles.deliveryTimeCellValue, styles.warningText]}>
            {timeOf(delivery.deliveryDt)}
          </Text>
        </View>
        <View style={styles.deliveryTimeCell}>
          <Text style={styles.deliveryTimeCellLabel}>예식 시간</Text>
          <Text style={[styles.deliveryTimeCellValue, urgent && styles.dangerText]}>
            {delivery.eventTime || '해당 없음'}
          </Text>
        </View>
      </View>

      <View style={styles.deliveryCardFooter}>
        <View style={styles.metaItem}>
          <Ionicons name="navigate-outline" size={16} color={C.textMuted} />
          <Text style={styles.metaText}>{delivery.distanceKm.toFixed(1)}km</Text>
        </View>
        <Pressable style={styles.outlinedButton} onPress={onPress}>
          <Text style={styles.outlinedButtonText}>상세 보기</Text>
          <Ionicons name="chevron-forward" size={16} color={C.primary} />
        </Pressable>
      </View>
    </View>
  );
}

function DeliveryListScreen({
  deliveries,
  hiddenDeliveries = [],
  onDeliveryPress,
  onUnhide,
  onDeleteDelivery,
  onNotifications,
}: {
  deliveries: Delivery[];
  hiddenDeliveries?: Delivery[];
  onDeliveryPress: (delivery: Delivery) => void;
  onUnhide?: (id: string) => void;
  onDeleteDelivery?: (delivery: Delivery) => void;
  onNotifications: () => void;
}) {
  const { C, styles, dark } = useTheme();
  const [filter, setFilter] = useState<DeliveryFilter>('all');
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState<DeliverySortMode>('urgency');
  const [showHidden, setShowHidden] = useState(false);
  const filtered = sortDeliveries(
    filterDeliveries(deliveries, { query, status: filter }),
    sortMode,
  );
  const stats = summarizeDeliveryStats(deliveries);
  return (
    <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
      <ScreenHeader
        eyebrow="TODAY · DELIVERY"
        title="오늘의 배달"
        subtitle={`${deliveries.length}건의 배달 일정을 관리합니다.`}
        notificationCount={3}
        onNotificationPress={onNotifications}
      />
      {stats.total > 0 && (
        <View style={{ marginBottom: 10 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginBottom: 6,
            }}
          >
            <Text
              style={{ fontSize: 12, color: C.textMuted, fontWeight: '700' }}
            >
              완료 {stats.completed}/{stats.total}
            </Text>
            <Text style={{ fontSize: 12, color: C.primary, fontWeight: '800' }}>
              {stats.completionRate}%
            </Text>
          </View>
          <View
            style={{
              height: 8,
              borderRadius: 4,
              backgroundColor: C.surfaceAlt,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${stats.completionRate}%`,
                height: 8,
                borderRadius: 4,
                backgroundColor: C.primary,
              }}
            />
          </View>
          {stats.pendingRevenue > 0 && (
            <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 5 }}>
              남은 예상 수입 {formatWonShort(stats.pendingRevenue)}원
            </Text>
          )}
        </View>
      )}
      <GlassSurface
        strength="subtle"
        radius={RADIUS.searchBar}
        dark={dark}
        colors={{ surface: C.surfaceAlt, primary: C.primary, outline: C.outline }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 12,
          marginBottom: 10,
        }}
      >
        <Ionicons name="search" size={18} color={C.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="상품·주소·업체·전화·날짜 검색"
          placeholderTextColor={C.textMuted}
          style={{ flex: 1, paddingVertical: 10, fontSize: 14, color: C.text }}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={C.textMuted} />
          </Pressable>
        )}
      </GlassSurface>
      <View style={styles.filterSegment}>
        {([
          ['all', '전체'],
          ['pending', '대기'],
          ['completed', '완료'],
        ] as Array<[DeliveryFilter, string]>).map(([key, label]) => (
          <Pressable
            key={key}
            style={[styles.filterItem, filter === key && styles.filterItemSelected]}
            onPress={() => setFilter(key)}
          >
            <Text style={[styles.filterText, filter === key && styles.filterTextSelected]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          marginBottom: 8,
        }}
      >
        <Text style={{ fontSize: 11, color: C.textMuted, marginRight: 2 }}>
          정렬
        </Text>
        {(
          [
            ['urgency', '마감순'],
            ['recent', '최신순'],
          ] as Array<[DeliverySortMode, string]>
        ).map(([key, label]) => (
          <Pressable
            key={key}
            onPress={() => setSortMode(key)}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 8,
              backgroundColor: sortMode === key ? C.primary : C.surfaceAlt,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                color: sortMode === key ? '#FFFFFF' : C.textMuted,
              }}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      {filtered.length === 0 && (
        <Text
          style={{
            color: C.textMuted,
            fontSize: 13,
            textAlign: 'center',
            paddingVertical: 28,
          }}
        >
          {deliveries.length === 0
            ? '등록된 배달이 없습니다'
            : '검색·필터 결과가 없습니다'}
        </Text>
      )}
      <View style={styles.deliveryList}>
        {filtered.map((delivery) =>
          onDeleteDelivery ? (
            <SwipeToDeleteRow
              key={delivery.id}
              onDelete={() => onDeleteDelivery(delivery)}
            >
              <DeliveryCard
                delivery={delivery}
                onPress={() => onDeliveryPress(delivery)}
              />
            </SwipeToDeleteRow>
          ) : (
            <DeliveryCard
              key={delivery.id}
              delivery={delivery}
              onPress={() => onDeliveryPress(delivery)}
            />
          ),
        )}
      </View>
      {hiddenDeliveries.length > 0 && (
        <View style={{ marginTop: 18 }}>
          <Pressable
            onPress={() => setShowHidden((value) => !value)}
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                paddingVertical: 12,
              },
              pressed && { opacity: 0.6 },
            ]}
          >
            <Ionicons
              name={showHidden ? 'chevron-up' : 'eye-off-outline'}
              size={16}
              color={C.textMuted}
            />
            <Text style={{ color: C.textMuted, fontWeight: '600', fontSize: 13 }}>
              숨긴 배달 {hiddenDeliveries.length}건 {showHidden ? '접기' : '보기'}
            </Text>
          </Pressable>
          {showHidden && (
            <View style={[styles.deliveryList, { opacity: 0.72 }]}>
              {hiddenDeliveries.map((delivery) => (
                <View key={delivery.id} style={{ position: 'relative' }}>
                  <DeliveryCard
                    delivery={delivery}
                    onPress={() => onDeliveryPress(delivery)}
                  />
                  <Pressable
                    onPress={() => onUnhide?.(delivery.id)}
                    hitSlop={8}
                    style={({ pressed }) => [
                      {
                        position: 'absolute',
                        top: 10,
                        right: 10,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 999,
                        backgroundColor: C.primaryContainer,
                      },
                      pressed && { opacity: 0.6 },
                    ]}
                  >
                    <Ionicons name="eye-outline" size={14} color={C.primary} />
                    <Text
                      style={{ color: C.primary, fontWeight: '700', fontSize: 12 }}
                    >
                      표시
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

// 행을 왼쪽으로 밀면 삭제 버튼이 드러나고 그 자리에 "고정"된다. 사용자가 삭제
// 버튼을 눌러야만 확인 다이얼로그(onDelete)가 뜨므로 실수로 지워지지 않는다.
// 오른쪽으로 밀거나 버튼을 누르면 닫힌다. 네이티브 제스처 의존성 없이 구현하고,
// 수평 이동이 뚜렷할 때만 제스처를 가로채 세로 스크롤과 충돌하지 않는다.
const SWIPE_REVEAL_W = 96;

function SwipeToDeleteRow({
  onDelete,
  children,
}: {
  onDelete: () => void;
  children: ReactNode;
}) {
  const { C } = useTheme();
  const translateX = useRef(new Animated.Value(0)).current;
  const openRef = useRef(false);
  const settleTo = (to: number) => {
    openRef.current = to !== 0;
    Animated.spring(translateX, {
      toValue: to,
      useNativeDriver: true,
      bounciness: 0,
      speed: 20,
    }).start();
  };
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > Math.abs(g.dy) * 1.5 && Math.abs(g.dx) > 8,
      onPanResponderMove: (_e, g) => {
        const base = openRef.current ? -SWIPE_REVEAL_W : 0;
        translateX.setValue(
          Math.min(0, Math.max(base + g.dx, -SWIPE_REVEAL_W - 24)),
        );
      },
      onPanResponderRelease: (_e, g) => {
        const base = openRef.current ? -SWIPE_REVEAL_W : 0;
        // 절반 이상 열렸으면 열린 채 고정, 아니면 닫는다.
        settleTo(base + g.dx <= -SWIPE_REVEAL_W / 2 ? -SWIPE_REVEAL_W : 0);
      },
      onPanResponderTerminate: () =>
        settleTo(openRef.current ? -SWIPE_REVEAL_W : 0),
    }),
  ).current;
  return (
    <View style={{ position: 'relative' }}>
      <Pressable
        onPress={() => {
          onDelete();
          settleTo(0);
        }}
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: SWIPE_REVEAL_W,
          backgroundColor: C.danger,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 5,
        }}
      >
        <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
        <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>
          삭제
        </Text>
      </Pressable>
      <Animated.View style={{ transform: [{ translateX }] }} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const ROUTE_ROW_H = 66;
const ROUTE_DELETE_W = 96;

// JS 전용(네이티브 의존성 없음) 드래그 재정렬 리스트. 배송지 행을 꾹 눌러 위아래로
// 끌면 순서가 바뀐다. 살짝 누르면(이동<임계) 상세로 이동. PanResponder는 useRef로 한 번만
// 생성하고 콜백은 ref로 최신값을 읽어 드래그 도중 재조정/스테일 클로저를 피한다.
function DraggableRouteList({
  items,
  onReorder,
  onPressRow,
  onRequestDelete,
}: {
  items: Delivery[];
  onReorder: (next: Delivery[]) => void;
  onPressRow: (delivery: Delivery) => void;
  onRequestDelete?: (delivery: Delivery) => void;
}) {
  const { C, styles } = useTheme();
  const [data, setData] = useState<Delivery[]>(items);
  const key = items.map((item) => item.id).join('|');
  useEffect(() => setData(items), [key]);

  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  const cbRef = useRef({ onReorder, onPressRow, onRequestDelete });
  useEffect(() => {
    cbRef.current = { onReorder, onPressRow, onRequestDelete };
  });

  const [active, setActive] = useState<number | null>(null);
  const [swiping, setSwiping] = useState(false);
  // 왼쪽으로 밀어 "열린 채 고정"된 행. 삭제 버튼을 눌러야 실제 삭제된다.
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const openIndexRef = useRef<number | null>(null);
  useEffect(() => {
    openIndexRef.current = openIndex;
  }, [openIndex]);

  const dragY = useRef(new Animated.Value(0)).current;
  const dragX = useRef(new Animated.Value(0)).current; // 제스처 중 실시간 이동
  const openX = useRef(new Animated.Value(0)).current; // 열린 채 고정된 행의 위치
  // 세로 드래그(순서 변경)와 가로 스와이프(삭제)를 한 제스처에서 구분한다.
  const mode = useRef<'idle' | 'drag' | 'swipe'>('idle');
  const start = useRef(0);
  const hover = useRef(0);
  const moved = useRef(false);

  const clampIndex = (value: number) =>
    Math.max(0, Math.min(dataRef.current.length - 1, value));

  const closeOpen = () => {
    setOpenIndex(null);
    openIndexRef.current = null;
    Animated.spring(openX, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 0,
      speed: 20,
    }).start();
  };
  const openRow = (idx: number) => {
    setOpenIndex(idx);
    openIndexRef.current = idx;
    openX.setValue(0);
    Animated.spring(openX, {
      toValue: -ROUTE_DELETE_W,
      useNativeDriver: true,
      bounciness: 0,
      speed: 20,
    }).start();
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dy) > 4 || Math.abs(g.dx) > 8,
      onPanResponderGrant: (e) => {
        const idx = clampIndex(
          Math.floor(e.nativeEvent.locationY / ROUTE_ROW_H),
        );
        start.current = idx;
        hover.current = idx;
        moved.current = false;
        mode.current = 'idle';
        dragY.setValue(0);
        dragX.setValue(0);
        setActive(idx);
      },
      onPanResponderMove: (_e, g) => {
        // 첫 유의미한 이동으로 방향(순서변경 vs 삭제)을 확정하고 고정한다.
        if (mode.current === 'idle') {
          if (Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5) {
            mode.current = 'swipe';
            setSwiping(true);
            if (
              openIndexRef.current !== null &&
              openIndexRef.current !== start.current
            ) {
              closeOpen();
            }
          } else if (Math.abs(g.dy) > 4) {
            mode.current = 'drag';
            if (openIndexRef.current !== null) closeOpen();
          }
        }
        if (mode.current === 'drag') {
          moved.current = true;
          dragY.setValue(g.dy);
          hover.current = clampIndex(
            start.current + Math.round(g.dy / ROUTE_ROW_H),
          );
        } else if (mode.current === 'swipe') {
          moved.current = true;
          const base =
            openIndexRef.current === start.current ? -ROUTE_DELETE_W : 0;
          dragX.setValue(
            Math.min(0, Math.max(base + g.dx, -ROUTE_DELETE_W - 24)),
          );
        }
      },
      onPanResponderRelease: (_e, g) => {
        const idx = start.current;
        if (!moved.current) {
          // 탭: 열린 행이 있으면 닫고, 없으면 상세로 이동.
          if (openIndexRef.current !== null) {
            closeOpen();
          } else {
            cbRef.current.onPressRow(dataRef.current[idx]);
          }
        } else if (mode.current === 'swipe') {
          const base = openIndexRef.current === idx ? -ROUTE_DELETE_W : 0;
          if (base + g.dx <= -ROUTE_DELETE_W / 2) openRow(idx);
          else closeOpen();
        } else if (mode.current === 'drag' && start.current !== hover.current) {
          const copy = [...dataRef.current];
          const [m] = copy.splice(start.current, 1);
          copy.splice(hover.current, 0, m);
          setData(copy);
          cbRef.current.onReorder(copy);
        }
        mode.current = 'idle';
        setSwiping(false);
        setActive(null);
        dragY.setValue(0);
        dragX.setValue(0);
      },
      onPanResponderTerminate: () => {
        mode.current = 'idle';
        setSwiping(false);
        setActive(null);
        dragY.setValue(0);
        dragX.setValue(0);
      },
    }),
  ).current;

  return (
    <View style={{ position: 'relative' }}>
      <View
        {...pan.panHandlers}
        style={{ height: data.length * ROUTE_ROW_H, position: 'relative' }}
      >
        {data.map((delivery, index) => {
          const isActive = index === active;
          const isOpen = index === openIndex;
          const showDeleteBg = (swiping && isActive) || isOpen;
          const RowView = isActive || isOpen ? Animated.View : View;
          const transform = isActive
            ? [{ translateY: dragY }, { translateX: dragX }]
            : isOpen
              ? [{ translateX: openX }]
              : undefined;
          return (
            <View
              key={delivery.id}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: index * ROUTE_ROW_H,
                height: ROUTE_ROW_H,
              }}
            >
              {showDeleteBg && (
                <View
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: ROUTE_DELETE_W,
                    borderRadius: 12,
                    backgroundColor: C.danger,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                  }}
                >
                  <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
                  <Text
                    style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}
                  >
                    삭제
                  </Text>
                </View>
              )}
              <RowView
                style={[
                  {
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: 0,
                    height: ROUTE_ROW_H,
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingRight: 8,
                    backgroundColor: showDeleteBg ? C.surface : undefined,
                  },
                  transform ? { transform } : null,
                  isActive && {
                    zIndex: 20,
                    backgroundColor: C.surface,
                    borderRadius: 12,
                    shadowColor: '#000',
                    shadowOpacity: 0.18,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 6,
                  },
                ]}
              >
                <View style={styles.routeStackOrder}>
                  <Text style={styles.routeStackOrderText}>{index + 1}</Text>
                </View>
                <View style={styles.routeStackBody}>
                  <Text style={styles.routeStackTitle} numberOfLines={1}>
                    {delivery.productName}
                  </Text>
                  <Text style={styles.routeStackAddress} numberOfLines={1}>
                    {delivery.deliveryAddress}
                  </Text>
                </View>
                <Ionicons
                  name="reorder-three-outline"
                  size={22}
                  color={C.textMuted}
                />
              </RowView>
            </View>
          );
        })}
      </View>
      {openIndex !== null && data[openIndex] && (
        // 열린 행의 드러난 영역 위에 놓이는 탭 가능한 삭제 버튼(컨테이너 제스처와 분리).
        <Pressable
          onPress={() => {
            cbRef.current.onRequestDelete?.(dataRef.current[openIndex]);
            closeOpen();
          }}
          style={{
            position: 'absolute',
            right: 0,
            top: openIndex * ROUTE_ROW_H,
            height: ROUTE_ROW_H,
            width: ROUTE_DELETE_W,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        />
      )}
    </View>
  );
}

function RouteScreen({
  deliveries,
  navApp,
  allowReorder,
  startAddress,
  endAddress,
  onSetLocations,
  onDeliveryPress,
  onDeleteDelivery,
  onNotifications,
}: {
  deliveries: Delivery[];
  navApp: NavApp;
  allowReorder: boolean;
  startAddress?: string;
  endAddress?: string;
  onSetLocations: (start: string, end: string) => void;
  onDeliveryPress: (delivery: Delivery) => void;
  onDeleteDelivery?: (delivery: Delivery) => void;
  onNotifications: () => void;
}) {
  const { C, styles } = useTheme();
  const pending = deliveries.filter((item) => item.status === 'pending');
  const pendingKey = pending.map((item) => item.id).join('|');
  const [order, setOrder] = useState<Delivery[]>(() =>
    optimizeByNearestNeighbor(pending),
  );

  // 배송 목록이 바뀌면 추천 순서로 다시 초기화한다.
  useEffect(() => {
    setOrder(optimizeByNearestNeighbor(pending));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingKey]);

  const next = order[0];
  const totalDistance = order.reduce((sum, item) => sum + item.distanceKm, 0);

  // 출발지/최종 도착지 입력(설정에 저장). 편집 중에는 로컬 상태로 잡고 blur 시 저장.
  const [startInput, setStartInput] = useState(startAddress ?? '');
  const [endInput, setEndInput] = useState(endAddress ?? '');
  useEffect(() => setStartInput(startAddress ?? ''), [startAddress]);
  useEffect(() => setEndInput(endAddress ?? ''), [endAddress]);
  const saveLocations = () => onSetLocations(startInput.trim(), endInput.trim());
  // 입력값이 설정에 저장된 값과 같은지(=이미 저장돼 유지 중인지) 판단.
  const locationsSaved =
    startInput.trim() === (startAddress ?? '').trim() &&
    endInput.trim() === (endAddress ?? '').trim();
  const hasAnyLocation = !!(startInput.trim() || endInput.trim());

  const startNavigation = () => {
    if (!next) return;
    openNavigation(navApp, {
      name: next.deliveryAddress,
      latitude: next.latitude,
      longitude: next.longitude,
    }).catch(() => undefined);
  };

  return (
    <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
      <ScreenHeader
        eyebrow="ROUTE · STACK"
        title="배달 동선"
        subtitle="출발지·도착지를 정하고, 배송지를 끌어 순서를 바꾸세요."
        notificationCount={3}
        onNotificationPress={onNotifications}
      />
      <View style={styles.surfaceCard}>
        <View style={{ padding: 14 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <Text style={{ color: C.navy, fontSize: 14, fontWeight: '800' }}>
              출발지 · 도착지
            </Text>
            {locationsSaved && hasAnyLocation && (
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <Ionicons name="checkmark-circle" size={15} color={C.success} />
                <Text
                  style={{ color: C.success, fontSize: 11, fontWeight: '800' }}
                >
                  저장됨
                </Text>
              </View>
            )}
          </View>

          <Text
            style={{
              color: C.textMuted,
              fontSize: 11,
              fontWeight: '700',
              marginBottom: 5,
            }}
          >
            출발지
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              borderWidth: 1,
              borderColor: C.outline,
              borderRadius: 13,
              paddingHorizontal: 12,
              backgroundColor: C.background,
            }}
          >
            <Ionicons name="flag-outline" size={16} color={C.primary} />
            <TextInput
              value={startInput}
              onChangeText={setStartInput}
              onBlur={saveLocations}
              placeholder="예: 강남 꽃시장"
              placeholderTextColor={C.textMuted}
              style={{ flex: 1, color: C.text, fontSize: 14, paddingVertical: 11 }}
            />
          </View>

          <Text
            style={{
              color: C.textMuted,
              fontSize: 11,
              fontWeight: '700',
              marginTop: 12,
              marginBottom: 5,
            }}
          >
            최종 도착지{'  '}
            <Text style={{ fontWeight: '400' }}>(비우면 마지막 배송지)</Text>
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              borderWidth: 1,
              borderColor: C.outline,
              borderRadius: 13,
              paddingHorizontal: 12,
              backgroundColor: C.background,
            }}
          >
            <Ionicons name="location-outline" size={16} color={C.danger} />
            <TextInput
              value={endInput}
              onChangeText={setEndInput}
              onBlur={saveLocations}
              placeholder="예: 자택"
              placeholderTextColor={C.textMuted}
              style={{ flex: 1, color: C.text, fontSize: 14, paddingVertical: 11 }}
            />
          </View>

          <Pressable
            onPress={saveLocations}
            disabled={locationsSaved}
            style={{
              marginTop: 14,
              minHeight: 46,
              borderRadius: 13,
              backgroundColor: locationsSaved ? C.surfaceAlt : C.primary,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 6,
            }}
          >
            <Ionicons
              name={locationsSaved ? 'checkmark' : 'bookmark-outline'}
              size={16}
              color={locationsSaved ? C.textMuted : '#FFFFFF'}
            />
            <Text
              style={{
                color: locationsSaved ? C.textMuted : '#FFFFFF',
                fontWeight: '800',
                fontSize: 13,
              }}
            >
              {locationsSaved && hasAnyLocation
                ? '저장됨 · 다음에도 유지됩니다'
                : '출발·도착지 저장'}
            </Text>
          </Pressable>
        </View>
      </View>
      {!!next && (
        <View style={styles.nextDestinationCard}>
          <View style={styles.nextDestinationHeader}>
            <View style={styles.nextBadge}>
              <Ionicons name="navigate" size={15} color={C.primary} />
              <Text style={styles.nextBadgeText}>다음 목적지</Text>
            </View>
            <Text style={styles.nextEta}>도착 예정 {addMinutes(timeOf(next.deliveryDt), -18)}</Text>
          </View>
          <Text style={styles.nextTitle}>{next.productName}</Text>
          <Text style={styles.nextAddress}>{next.deliveryAddress}</Text>
          <View style={styles.nextInfoRow}>
            <View style={styles.nextInfo}>
              <Text style={styles.nextInfoLabel}>남은 거리</Text>
              <Text style={styles.nextInfoValue}>{next.distanceKm.toFixed(1)}km</Text>
            </View>
            <View style={styles.nextInfoDivider} />
            <View style={styles.nextInfo}>
              <Text style={styles.nextInfoLabel}>엄수 마감</Text>
              <Text style={[styles.nextInfoValue, styles.warningText]}>
                {timeOf(next.deliveryDt)}
              </Text>
            </View>
            <View style={styles.nextInfoDivider} />
            <View style={styles.nextInfo}>
              <Text style={styles.nextInfoLabel}>예식 시간</Text>
              <Text style={[styles.nextInfoValue, isEventDelivery(next) && styles.dangerText]}>
                {next.eventTime || '-'}
              </Text>
            </View>
          </View>
          {isEventDelivery(next) && (
            <View style={styles.priorityNotice}>
              <Ionicons name="alert-circle" size={18} color={C.danger} />
              <Text style={styles.priorityNoticeText}>
                최우선 배송 · 예식 시작 전 설치 완료가 필요합니다.
              </Text>
            </View>
          )}
          <View style={styles.routeButtons}>
            <Pressable style={styles.secondaryButton} onPress={() => onDeliveryPress(next)}>
              <Text style={styles.secondaryButtonText}>배송 상세</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={startNavigation}>
              <Ionicons name="navigate-outline" size={18} color={C.onPrimary} />
              <Text style={styles.primaryButtonText}>
                {NAV_APP_LABEL[navApp]}(으)로 안내 시작
              </Text>
            </Pressable>
          </View>
        </View>
      )}
      <SectionHeader
        title="배달 순서"
        caption={`${order.length}개 목적지 · 총 ${totalDistance.toFixed(1)}km${
          allowReorder ? ' · 배송지를 끌어 순서 변경' : ''
        }`}
      />
      <View style={styles.surfaceCard}>
        {order.length === 0 ? (
          <Text
            style={{
              color: C.textMuted,
              fontSize: 13,
              textAlign: 'center',
              paddingVertical: 20,
            }}
          >
            대기 중인 배달이 없습니다
          </Text>
        ) : allowReorder ? (
          <DraggableRouteList
            items={order}
            onReorder={setOrder}
            onPressRow={onDeliveryPress}
            onRequestDelete={onDeleteDelivery}
          />
        ) : (
          order.map((delivery, index) => (
            <View key={delivery.id}>
              <View style={styles.routeStackRow}>
                <View style={styles.routeStackOrder}>
                  <Text style={styles.routeStackOrderText}>{index + 1}</Text>
                </View>
                <Pressable
                  style={styles.routeStackBody}
                  onPress={() => onDeliveryPress(delivery)}
                >
                  <Text style={styles.routeStackTitle} numberOfLines={1}>
                    {delivery.productName}
                  </Text>
                  <Text style={styles.routeStackAddress} numberOfLines={1}>
                    {delivery.deliveryAddress}
                  </Text>
                </Pressable>
              </View>
              {index < order.length - 1 && <View style={styles.divider} />}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

type CalendarMode = 'month' | 'week' | 'day';

const formatDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const timeLabel = (value?: string) =>
  value?.match(/T(\d{2}:\d{2})/)?.[1] || '';

const FUEL_FORM_FIELDS: Array<{
  key: keyof FuelLogInput;
  label: string;
  placeholder: string;
}> = [
  { key: 'date', label: '주유 날짜', placeholder: 'YYYY-MM-DD' },
  { key: 'liters', label: '주유량 (L)', placeholder: '예: 30' },
  { key: 'pricePerLiter', label: '리터당 단가 (원)', placeholder: '예: 1700' },
  { key: 'amount', label: '총 주유금액 (원)', placeholder: '단가 대신 입력 가능' },
  { key: 'odometerKm', label: '주행거리 (km)', placeholder: '선택' },
  { key: 'vehicle', label: '차량 (선택)', placeholder: '예: 1톤 트럭' },
];

function FuelFormModal({
  visible,
  initial,
  defaultVehicle,
  vehicleRegistry = [],
  onClose,
  onSubmit,
}: {
  visible: boolean;
  initial?: FuelLog;
  defaultVehicle?: string;
  vehicleRegistry?: string[];
  onClose: () => void;
  onSubmit: (log: FuelLog) => void;
}) {
  const { C } = useTheme();
  const insets = useSafeAreaInsets();
  const editing = Boolean(initial);
  const toValues = (log?: FuelLog): Record<string, string> => {
    const input = log
      ? fuelLogToInput(log)
      : ({ vehicle: defaultVehicle } as FuelLogInput);
    const values: Record<string, string> = {};
    FUEL_FORM_FIELDS.forEach((field) => {
      const raw = input[field.key];
      values[field.key] = raw === undefined || raw === null ? '' : String(raw);
    });
    return values;
  };
  const [values, setValues] = useState<Record<string, string>>(() =>
    toValues(initial),
  );
  useEffect(() => {
    if (visible) setValues(toValues(initial));
  }, [visible, initial]);

  const numeric = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const submit = () => {
    const input: FuelLogInput = {
      date: values.date ?? '',
      liters: numeric(values.liters) ?? 0,
      pricePerLiter: numeric(values.pricePerLiter),
      amount: numeric(values.amount),
      odometerKm: numeric(values.odometerKm),
      vehicle: values.vehicle,
    };
    const errors = validateFuelLogInput(input);
    if (errors.length) {
      Alert.alert('입력 확인', errors.join('\n'));
      return;
    }
    try {
      const log = initial
        ? applyFuelLogEdit(initial, input)
        : createFuelLog(input, { id: `fuel-${Date.now()}` });
      onSubmit(log);
      onClose();
    } catch (error) {
      Alert.alert(
        '저장 실패',
        error instanceof Error ? error.message : '알 수 없는 오류',
      );
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView
        style={{ flex: 1, backgroundColor: C.background }}
        edges={['left', 'right', 'bottom']}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 18,
            paddingTop: insets.top + 14,
            paddingBottom: 14,
            borderBottomWidth: 1,
            borderBottomColor: C.outline,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '800', color: C.text }}>
            {editing ? '주유 기록 수정' : '주유 기록 추가'}
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={C.text} />
          </Pressable>
        </View>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={{ padding: 18, paddingBottom: 32 }}
            keyboardShouldPersistTaps="handled"
          >
            {FUEL_FORM_FIELDS.map((field) => (
              <View key={field.key} style={{ marginBottom: 14 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: C.textMuted,
                    marginBottom: 6,
                  }}
                >
                  {field.label}
                </Text>
                <TextInput
                  value={values[field.key]}
                  onChangeText={(text) =>
                    setValues((current) => ({ ...current, [field.key]: text }))
                  }
                  placeholder={field.placeholder}
                  placeholderTextColor={C.textMuted}
                  keyboardType={
                    field.key === 'date' || field.key === 'vehicle'
                      ? 'default'
                      : 'numeric'
                  }
                  style={{
                    backgroundColor: C.surfaceAlt,
                    borderWidth: 1,
                    borderColor: C.outline,
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    fontSize: 15,
                    color: C.text,
                  }}
                />
                {field.key === 'vehicle' && vehicleRegistry.length > 0 && (
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      gap: 6,
                      marginTop: 8,
                    }}
                  >
                    {vehicleRegistry.map((label) => {
                      const active =
                        (values.vehicle ?? '').trim() === label;
                      return (
                        <Pressable
                          key={label}
                          onPress={() =>
                            setValues((current) => ({
                              ...current,
                              vehicle: active ? '' : label,
                            }))
                          }
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 16,
                            borderWidth: 1,
                            borderColor: active ? C.primary : C.outline,
                            backgroundColor: active ? C.primary : C.surfaceAlt,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: '700',
                              color: active ? '#FFFFFF' : C.textMuted,
                            }}
                          >
                            {label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            ))}
            <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
              단가나 총액 중 하나만 넣어도 나머지는 자동 계산됩니다.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
        <View
          style={{
            padding: 18,
            paddingBottom: 18 + insets.bottom,
            borderTopWidth: 1,
            borderTopColor: C.outline,
          }}
        >
          <Pressable
            onPress={submit}
            style={({ pressed }) => [
              {
                backgroundColor: C.primary,
                borderRadius: 14,
                paddingVertical: 15,
                alignItems: 'center',
              },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={{ color: C.onPrimary, fontSize: 15, fontWeight: '800' }}>
              {editing ? '수정 저장' : '주유 추가'}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const MILEAGE_FORM_FIELDS: Array<{
  key: keyof MileageLogInput;
  label: string;
  placeholder: string;
}> = [
  { key: 'date', label: '기록 날짜', placeholder: 'YYYY-MM-DD' },
  { key: 'odometerKm', label: '누적 주행거리 (km)', placeholder: '예: 12345' },
  { key: 'dailyDistanceKm', label: '일일 주행거리 (km)', placeholder: '선택' },
  { key: 'vehicle', label: '차량 (선택)', placeholder: '예: 1톤 트럭' },
];

function MileageFormModal({
  visible,
  initial,
  defaultVehicle,
  vehicleRegistry = [],
  onClose,
  onSubmit,
}: {
  visible: boolean;
  initial?: MileageLog;
  defaultVehicle?: string;
  vehicleRegistry?: string[];
  onClose: () => void;
  onSubmit: (log: MileageLog) => void;
}) {
  const { C } = useTheme();
  const insets = useSafeAreaInsets();
  const editing = Boolean(initial);
  const toValues = (log?: MileageLog): Record<string, string> => {
    const input = log
      ? mileageLogToInput(log)
      : ({ vehicle: defaultVehicle } as MileageLogInput);
    const values: Record<string, string> = {};
    MILEAGE_FORM_FIELDS.forEach((field) => {
      const raw = input[field.key];
      values[field.key] = raw === undefined || raw === null ? '' : String(raw);
    });
    return values;
  };
  const [values, setValues] = useState<Record<string, string>>(() =>
    toValues(initial),
  );
  useEffect(() => {
    if (visible) setValues(toValues(initial));
  }, [visible, initial]);

  const numeric = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const submit = () => {
    const input: MileageLogInput = {
      date: values.date ?? '',
      odometerKm: numeric(values.odometerKm) ?? 0,
      dailyDistanceKm: numeric(values.dailyDistanceKm),
      vehicle: values.vehicle,
    };
    const errors = validateMileageLogInput(input);
    if (errors.length) {
      Alert.alert('입력 확인', errors.join('\n'));
      return;
    }
    try {
      const log = initial
        ? applyMileageLogEdit(initial, input)
        : createMileageLog(input, { id: `mileage-${Date.now()}` });
      onSubmit(log);
      onClose();
    } catch (error) {
      Alert.alert(
        '저장 실패',
        error instanceof Error ? error.message : '알 수 없는 오류',
      );
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView
        style={{ flex: 1, backgroundColor: C.background }}
        edges={['left', 'right', 'bottom']}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 18,
            paddingTop: insets.top + 14,
            paddingBottom: 14,
            borderBottomWidth: 1,
            borderBottomColor: C.outline,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '800', color: C.text }}>
            {editing ? '주행 기록 수정' : '주행 기록 추가'}
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={C.text} />
          </Pressable>
        </View>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={{ padding: 18, paddingBottom: 32 }}
            keyboardShouldPersistTaps="handled"
          >
            {MILEAGE_FORM_FIELDS.map((field) => (
              <View key={field.key} style={{ marginBottom: 14 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: C.textMuted,
                    marginBottom: 6,
                  }}
                >
                  {field.label}
                </Text>
                <TextInput
                  value={values[field.key]}
                  onChangeText={(text) =>
                    setValues((current) => ({ ...current, [field.key]: text }))
                  }
                  placeholder={field.placeholder}
                  placeholderTextColor={C.textMuted}
                  keyboardType={
                    field.key === 'date' || field.key === 'vehicle'
                      ? 'default'
                      : 'numeric'
                  }
                  style={{
                    backgroundColor: C.surfaceAlt,
                    borderWidth: 1,
                    borderColor: C.outline,
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    fontSize: 15,
                    color: C.text,
                  }}
                />
                {field.key === 'vehicle' && vehicleRegistry.length > 0 && (
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      gap: 6,
                      marginTop: 8,
                    }}
                  >
                    {vehicleRegistry.map((label) => {
                      const active = (values.vehicle ?? '').trim() === label;
                      return (
                        <Pressable
                          key={label}
                          onPress={() =>
                            setValues((current) => ({
                              ...current,
                              vehicle: active ? '' : label,
                            }))
                          }
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 16,
                            borderWidth: 1,
                            borderColor: active ? C.primary : C.outline,
                            backgroundColor: active ? C.primary : C.surfaceAlt,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: '700',
                              color: active ? '#FFFFFF' : C.textMuted,
                            }}
                          >
                            {label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        </KeyboardAvoidingView>
        <View
          style={{
            padding: 18,
            paddingBottom: 18 + insets.bottom,
            borderTopWidth: 1,
            borderTopColor: C.outline,
          }}
        >
          <Pressable
            onPress={submit}
            style={({ pressed }) => [
              {
                backgroundColor: C.primary,
                borderRadius: 14,
                paddingVertical: 15,
                alignItems: 'center',
              },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={{ color: C.onPrimary, fontSize: 15, fontWeight: '800' }}>
              {editing ? '수정 저장' : '기록 추가'}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function ProfitTrendCard({
  daily,
}: {
  daily: Map<string, DailyProfitSummary>;
}) {
  const { C } = useTheme();
  const [period, setPeriod] = useState<ProfitPeriod>('daily');
  const buckets = useMemo(
    () => bucketProfit(daily, period).slice(-8),
    [daily, period],
  );
  const totals = useMemo(() => totalProfit(daily), [daily]);
  const maxAbs = Math.max(1, ...buckets.map((bucket) => Math.abs(bucket.net)));
  const reduceMotion = useReduceMotion();
  const grow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) {
      grow.setValue(1);
      return;
    }
    grow.setValue(0);
    Animated.timing(grow, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [period, buckets.length, reduceMotion, grow]);
  const won = (value: number) => {
    const sign = value < 0 ? '-' : '';
    const abs = Math.abs(Math.round(value))
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${sign}${abs}`;
  };
  const periods: Array<{ key: ProfitPeriod; label: string }> = [
    { key: 'daily', label: '일' },
    { key: 'weekly', label: '주' },
    { key: 'monthly', label: '월' },
  ];
  return (
    <View
      style={{
        backgroundColor: C.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: C.outline,
        padding: 14,
        marginBottom: 12,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: C.text }}>
            손익 추이
          </Text>
          <Pressable
            onPress={() => {
              Share.share({
                message: buildDailyProfitCsv(daily),
                title: '손익 내보내기 (CSV)',
              }).catch(() => undefined);
            }}
            hitSlop={6}
          >
            <Ionicons name="share-outline" size={16} color={C.textMuted} />
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {periods.map((item) => {
            const active = period === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setPeriod(item.key)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 5,
                  borderRadius: 8,
                  backgroundColor: active ? C.primary : C.surfaceAlt,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: active ? '#FFFFFF' : C.textMuted,
                  }}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      {buckets.length === 0 ? (
        <Text
          style={{
            fontSize: 12,
            color: C.textMuted,
            textAlign: 'center',
            paddingVertical: 24,
          }}
        >
          표시할 손익 데이터가 없습니다
        </Text>
      ) : (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'space-around',
            height: 132,
          }}
        >
          {buckets.map((bucket, index) => {
            const height = 6 + (Math.abs(bucket.net) / maxAbs) * 96;
            const positive = bucket.net >= 0;
            const start = Math.min(0.55, index * 0.07);
            return (
              <View
                key={bucket.key}
                style={{ alignItems: 'center', flex: 1, gap: 4 }}
              >
                <Text
                  style={{
                    fontSize: 9,
                    fontWeight: '700',
                    color: positive ? C.success : C.danger,
                  }}
                  numberOfLines={1}
                >
                  {formatWonShort(bucket.net)}
                </Text>
                <Animated.View
                  style={{
                    width: 16,
                    height: grow.interpolate({
                      inputRange: [start, start + 0.45],
                      outputRange: [2, height],
                      extrapolate: 'clamp',
                    }),
                    borderRadius: 5,
                    backgroundColor: positive ? C.primary : C.danger,
                  }}
                />
                <Text
                  style={{ fontSize: 9, color: C.textMuted }}
                  numberOfLines={1}
                >
                  {bucket.label}
                </Text>
              </View>
            );
          })}
        </View>
      )}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginTop: 12,
          paddingTop: 10,
          borderTopWidth: 1,
          borderTopColor: C.outline,
        }}
      >
        <Text style={{ fontSize: 11, color: C.textMuted }}>
          기간 합계 · {totals.activeDays}일
        </Text>
        <Text
          style={{
            fontSize: 12,
            fontWeight: '800',
            color: totals.net >= 0 ? C.text : C.danger,
          }}
        >
          순익 {won(totals.net)}원
        </Text>
      </View>
    </View>
  );
}

// 상세 수익 리포트(Pro). 손익 추이 위에 기간 비교·분류/지역/거래처 분해·평균/완료율을
// 얹는다. 계산은 순수 함수(buildRevenueReport), 무료 사용자는 잠금 미리보기를 본다.
type ReportPeriodKey = 'month' | 'last30' | 'all';

function RevenueReportCard({
  orders,
  fuelLogs,
  settings,
  plan,
  onUpgrade,
}: {
  orders: DeliveryOrder[];
  fuelLogs: FuelLog[];
  settings: RouteloSettings;
  plan: AppPlan;
  onUpgrade?: () => void;
}) {
  const { C } = useTheme();
  const [periodKey, setPeriodKey] = useState<ReportPeriodKey>('month');
  const enabled = isFeatureEnabled(plan, 'detailedRevenueReport');

  const range = useMemo<ReportRange | undefined>(() => {
    if (periodKey === 'all') return undefined;
    const today = new Date();
    const end = formatDateKey(today);
    if (periodKey === 'month') {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: formatDateKey(first), end };
    }
    const from = new Date(today);
    from.setDate(today.getDate() - 29);
    return { start: formatDateKey(from), end };
  }, [periodKey]);

  const report = useMemo(
    () => (enabled ? buildRevenueReport(orders, fuelLogs, settings, range) : null),
    [enabled, orders, fuelLogs, settings, range],
  );

  const won = (value: number) => {
    const sign = value < 0 ? '-' : '';
    const abs = Math.abs(Math.round(value))
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${sign}${abs}`;
  };

  const cardBase = {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.outline,
    padding: 14,
    marginBottom: 12,
  } as const;

  const header = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 12,
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: '800', color: C.text }}>
        상세 수익 리포트
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 3,
          paddingHorizontal: 7,
          paddingVertical: 2,
          borderRadius: 6,
          backgroundColor: C.warning + '22',
        }}
      >
        <Ionicons name="star" size={10} color={C.warning} />
        <Text style={{ fontSize: 10, fontWeight: '800', color: C.warning }}>
          PRO
        </Text>
      </View>
    </View>
  );

  if (!enabled) {
    return (
      <Pressable
        onPress={onUpgrade}
        accessibilityRole="button"
        accessibilityLabel="상세 수익 리포트 · Pro 전용"
        style={cardBase}
      >
        {header}
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
        >
          <Ionicons name="lock-closed" size={18} color={C.textMuted} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: C.text }}>
              기간 비교 · 분류/지역/거래처별 분석
            </Text>
            <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
              Pro로 전환하면 상세 리포트를 볼 수 있어요
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
        </View>
      </Pressable>
    );
  }

  if (!report) return null;

  const periods: Array<{ key: ReportPeriodKey; label: string }> = [
    { key: 'month', label: '이번 달' },
    { key: 'last30', label: '지난 30일' },
    { key: 'all', label: '전체' },
  ];

  const stat = (label: string, value: string, sub?: string) => (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 10, color: C.textMuted }}>{label}</Text>
      <Text
        style={{ fontSize: 15, fontWeight: '800', color: C.text, marginTop: 2 }}
        numberOfLines={1}
      >
        {value}
      </Text>
      {sub ? (
        <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 1 }}>
          {sub}
        </Text>
      ) : null}
    </View>
  );

  const breakdownBlock = (
    title: string,
    rows: typeof report.byCategory,
  ) => {
    const top = rows.slice(0, 4);
    return (
      <View style={{ marginTop: 12 }}>
        <Text
          style={{
            fontSize: 11,
            fontWeight: '800',
            color: C.textMuted,
            marginBottom: 6,
          }}
        >
          {title}
        </Text>
        {top.length === 0 ? (
          <Text style={{ fontSize: 11, color: C.textMuted }}>데이터 없음</Text>
        ) : (
          top.map((row) => (
            <View key={row.key} style={{ marginBottom: 6 }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginBottom: 3,
                }}
              >
                <Text style={{ fontSize: 12, color: C.text }} numberOfLines={1}>
                  {row.label}{' '}
                  <Text style={{ color: C.textMuted, fontSize: 10 }}>
                    · {row.count}건
                  </Text>
                </Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: C.text }}>
                  {won(row.revenue)}원 ({Math.round(row.share * 100)}%)
                </Text>
              </View>
              <View
                style={{
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: C.surfaceAlt,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    width: `${Math.max(2, Math.round(row.share * 100))}%`,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: C.primary,
                  }}
                />
              </View>
            </View>
          ))
        )}
      </View>
    );
  };

  const cmp = report.comparison;
  const cmpPct = cmp?.netDeltaPct;

  return (
    <View style={cardBase}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: C.text }}>
            상세 수익 리포트
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 3,
              paddingHorizontal: 7,
              paddingVertical: 2,
              borderRadius: 6,
              backgroundColor: C.warning + '22',
            }}
          >
            <Ionicons name="star" size={10} color={C.warning} />
            <Text style={{ fontSize: 10, fontWeight: '800', color: C.warning }}>
              PRO
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {periods.map((item) => {
            const active = periodKey === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setPeriodKey(item.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 8,
                  backgroundColor: active ? C.primary : C.surfaceAlt,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: active ? '#FFFFFF' : C.textMuted,
                  }}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {report.totals.count === 0 ? (
        <Text
          style={{
            fontSize: 12,
            color: C.textMuted,
            textAlign: 'center',
            paddingVertical: 20,
          }}
        >
          이 기간에는 배달 기록이 없습니다
        </Text>
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {stat('매출', `${won(report.totals.revenue)}원`, `${report.totals.count}건`)}
            {stat(
              '순이익',
              `${won(report.totals.net)}원`,
              report.averages.netMarginPct !== null
                ? `마진 ${report.averages.netMarginPct}%`
                : undefined,
            )}
          </View>
          {cmp ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                marginTop: 10,
                paddingTop: 10,
                borderTopWidth: 1,
                borderTopColor: C.outline,
              }}
            >
              <Ionicons
                name={cmp.netDelta >= 0 ? 'trending-up' : 'trending-down'}
                size={14}
                color={cmp.netDelta >= 0 ? C.success : C.danger}
              />
              <Text style={{ fontSize: 11, color: C.textMuted }}>
                직전 기간 대비 순이익{' '}
                <Text
                  style={{
                    fontWeight: '800',
                    color: cmp.netDelta >= 0 ? C.success : C.danger,
                  }}
                >
                  {cmp.netDelta >= 0 ? '+' : '−'}
                  {won(Math.abs(cmp.netDelta))}원
                  {cmpPct !== null ? ` (${cmp.netDelta >= 0 ? '+' : ''}${cmpPct}%)` : ''}
                </Text>
              </Text>
            </View>
          ) : null}

          <View
            style={{
              flexDirection: 'row',
              gap: 10,
              marginTop: 12,
              paddingTop: 10,
              borderTopWidth: 1,
              borderTopColor: C.outline,
            }}
          >
            {stat('건당 평균', `${won(report.averages.revenuePerDelivery)}원`)}
            {stat('활동일 평균', `${won(report.averages.revenuePerActiveDay)}원`)}
            {stat('완료율', `${report.completion.rate}%`, `${report.completion.completed}/${report.completion.total}`)}
          </View>

          {breakdownBlock('분류별', report.byCategory)}
          {breakdownBlock('지역별', report.byRegion)}
          {breakdownBlock('거래처별', report.byVendor)}

          {report.topDay ? (
            <Text
              style={{
                fontSize: 11,
                color: C.textMuted,
                marginTop: 12,
                paddingTop: 10,
                borderTopWidth: 1,
                borderTopColor: C.outline,
              }}
            >
              최고 순익일 · {report.topDay.date} ({won(report.topDay.net)}원)
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
}

function CalendarScreen({
  orders,
  fuelLogs,
  mileageLogs,
  contactLogs,
  settings,
  onDeliveryPress,
  onNotifications,
  onAddFuel,
  onEditFuel,
  onDeleteFuel,
  onAddMileage,
  onEditMileage,
  onDeleteMileage,
  onImportBackup,
}: {
  orders: DeliveryOrder[];
  fuelLogs: FuelLog[];
  mileageLogs: MileageLog[];
  contactLogs: ContactLog[];
  settings: RouteloSettings;
  onDeliveryPress: (delivery: Delivery) => void;
  onNotifications: () => void;
  onAddFuel: () => void;
  onEditFuel: (log: FuelLog) => void;
  onDeleteFuel: (id: string) => void;
  onAddMileage: () => void;
  onEditMileage: (log: MileageLog) => void;
  onDeleteMileage: (id: string) => void;
  onImportBackup: (json: string) => void;
}) {
  const { C, styles } = useTheme();
  const { showFullAddressInList } = usePrivacy();
  const today = new Date();
  // 월 달력만 사용(주/일 뷰 제거). mode는 'month'로 고정.
  const mode: CalendarMode = 'month';
  const [cursor, setCursor] = useState(
    new Date(today.getFullYear(), today.getMonth(), today.getDate()),
  );
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreText, setRestoreText] = useState('');
  // 인수증 원본 전체보기용(썸네일 탭 시).
  const [receiptPreview, setReceiptPreview] = useState<string>();
  const canRestore = restoreText.trim().length > 0;
  const items = useMemo(
    () =>
      orders
        .map((order) => toCalendarDeliveryItem(order))
        .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    [orders],
  );
  const byDate = useMemo(() => {
    const grouped = new Map<string, typeof items>();
    items.forEach((item) => {
      grouped.set(item.date, [...(grouped.get(item.date) || []), item]);
    });
    grouped.forEach((value) =>
      value.sort((left, right) =>
        (
          left.deadlineAt ||
          left.startAt ||
          left.eventAt ||
          `${left.date}T23:59`
        ).localeCompare(
          right.deadlineAt ||
            right.startAt ||
            right.eventAt ||
            `${right.date}T23:59`,
        ),
      ),
    );
    return grouped;
  }, [items]);
  const selectedDate = formatDateKey(cursor);
  const selectedItems = byDate.get(selectedDate) || [];
  const calendarRisks = useMemo(() => evaluateCalendarRisks(items), [items]);
  const dailySummaries = useMemo(
    () => summarizeDailyProfit(orders, fuelLogs, settings),
    [fuelLogs, orders, settings],
  );
  const reportPlan = resolvePlan(settings.entitlement);
  const selectedSummary = dailySummaries.get(selectedDate) || {
    revenue: 0,
    fuelCost: 0,
    net: 0,
    count: 0,
  };
  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const monthGridStart = new Date(monthStart);
  monthGridStart.setDate(1 - monthStart.getDay());
  const monthDays = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(monthGridStart);
    date.setDate(monthGridStart.getDate() + index);
    return date;
  });
  const weekStart = new Date(cursor);
  weekStart.setDate(cursor.getDate() - cursor.getDay());
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return date;
  });
  const visibleDays =
    mode === 'month' ? monthDays : mode === 'week' ? weekDays : [cursor];

  const move = (direction: number) => {
    const next = new Date(cursor);
    if (mode === 'month') next.setMonth(cursor.getMonth() + direction, 1);
    else next.setDate(cursor.getDate() + direction * (mode === 'week' ? 7 : 1));
    setCursor(next);
  };

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.screenContent}>
      <ScreenHeader
        eyebrow="DELIVERY CALENDAR"
        title="배달 일정"
        subtitle="마감·예식·동선 시간을 분리해 확인합니다"
        notificationCount={3}
        onNotificationPress={onNotifications}
      />
      <View style={styles.calendarCard}>
        <View style={styles.calendarToolbar}>
          <Pressable style={styles.iconButton} onPress={() => move(-1)}>
            <Ionicons name="chevron-back" size={20} color={C.navy} />
          </Pressable>
          <Text style={styles.calendarTitle}>
            {cursor.getFullYear()}년 {cursor.getMonth() + 1}월
          </Text>
          <Pressable style={styles.iconButton} onPress={() => move(1)}>
            <Ionicons name="chevron-forward" size={20} color={C.navy} />
          </Pressable>
        </View>
        <View style={styles.calendarWeekHeader}>
          {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
            <Text key={day} style={styles.calendarWeekLabel}>
              {day}
            </Text>
          ))}
        </View>
        <View style={styles.calendarGrid}>
          {visibleDays.map((date) => {
            const key = formatDateKey(date);
            const count = byDate.get(key)?.length || 0;
            const summary = dailySummaries.get(key);
            const selected = key === selectedDate;
            const outside =
              mode === 'month' && date.getMonth() !== cursor.getMonth();
            const urgent = (byDate.get(key) || []).some(
              (item) =>
                item.priority !== 'normal' ||
                calendarRisks.get(item.id)?.conflict ||
                calendarRisks.get(item.id)?.late,
            );
            return (
              <Pressable
                key={key}
                style={[
                  styles.calendarDay,
                  mode !== 'month' && styles.calendarDayWide,
                  selected && styles.calendarDaySelected,
                ]}
                onPress={() => setCursor(date)}
              >
                <Text
                  style={[
                    styles.calendarDayText,
                    outside && styles.calendarDayOutside,
                    selected && styles.calendarDayTextSelected,
                  ]}
                >
                  {date.getDate()}
                </Text>
                {false && count > 0 && (
                  <View
                    style={[
                      styles.calendarCount,
                      urgent && styles.calendarCountUrgent,
                    ]}
                  >
                    <Text style={styles.calendarCountText}>{count}</Text>
                  </View>
                )}
                {summary && (summary.revenue > 0 || summary.fuelCost > 0) && (
                  <Text
                    style={[
                      styles.calendarNetText,
                      summary.net < 0 && styles.calendarNetTextNegative,
                    ]}
                    numberOfLines={1}
                  >
                    {summary.net >= 0 ? '+' : '−'}
                    {Math.abs(summary.net) >= 10000
                      ? `${Math.round(Math.abs(summary.net) / 10000)}만`
                      : formatWon(Math.abs(summary.net))}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
      <SectionHeader
        title={`${selectedDate} 일정`}
        caption={`${selectedItems.length}건`}
      />
      <View style={styles.profitSummaryCard}>
        <View>
          <Text style={styles.profitSummaryLabel}>당일 순수익</Text>
          <Text
            style={[
              styles.profitSummaryValue,
              selectedSummary.net < 0 && styles.profitSummaryValueNegative,
            ]}
          >
            {formatWon(selectedSummary.net)}
          </Text>
        </View>
        <View style={styles.profitSummaryMeta}>
          <Text style={styles.profitSummaryMetaText}>
            배송 수수료 {formatWon(selectedSummary.revenue)}
          </Text>
          <Text style={styles.profitSummaryMetaText}>
            유류비 차감 {formatWon(selectedSummary.fuelCost)}
          </Text>
        </View>
      </View>
      <ProfitTrendCard daily={dailySummaries} />
      <RevenueReportCard
        orders={orders}
        fuelLogs={fuelLogs}
        settings={settings}
        plan={reportPlan}
        onUpgrade={() =>
          Alert.alert(
            'Pro 기능',
            '상세 수익 리포트는 Pro 요금제에서 제공됩니다.\n설정 > 요금제에서 전환할 수 있어요.',
          )
        }
      />
      <View
        style={{
          backgroundColor: C.surface,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: C.outline,
          padding: 14,
          marginBottom: 12,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: fuelLogs.length ? 10 : 0,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '800', color: C.text }}>
            주유 기록
          </Text>
          <Pressable
            onPress={onAddFuel}
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: C.primary,
              },
              pressed && { opacity: 0.6 },
            ]}
          >
            <Ionicons name="add" size={16} color={C.primary} />
            <Text style={{ color: C.primary, fontSize: 12, fontWeight: '700' }}>
              추가
            </Text>
          </Pressable>
        </View>
        {fuelLogs.length === 0 ? (
          <Text
            style={{
              fontSize: 12,
              color: C.textMuted,
              paddingVertical: 12,
              textAlign: 'center',
            }}
          >
            주유 기록이 없습니다 · 추가하면 손익 차트에 반영됩니다
          </Text>
        ) : (
          [...fuelLogs]
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 20)
            .map((log) => (
              <View
                key={log.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 8,
                  borderTopWidth: 1,
                  borderTopColor: C.surfaceAlt,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: C.text }}>
                    {log.date}
                  </Text>
                  <Text style={{ fontSize: 11, color: C.textMuted }}>
                    {log.liters}L · {formatWon(log.pricePerLiter)}원/L
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '800',
                    color: C.text,
                    marginRight: 10,
                  }}
                >
                  {formatWon(log.amount)}원
                </Text>
                <Pressable
                  onPress={() => onEditFuel(log)}
                  hitSlop={6}
                  style={{ padding: 4 }}
                >
                  <Ionicons name="create-outline" size={18} color={C.primary} />
                </Pressable>
                <Pressable
                  onPress={() =>
                    Alert.alert('주유 기록 삭제', `${log.date} 기록을 삭제할까요?`, [
                      { text: '취소', style: 'cancel' },
                      {
                        text: '삭제',
                        style: 'destructive',
                        onPress: () => onDeleteFuel(log.id),
                      },
                    ])
                  }
                  hitSlop={6}
                  style={{ padding: 4, marginLeft: 2 }}
                >
                  <Ionicons name="trash-outline" size={18} color={C.danger} />
                </Pressable>
              </View>
            ))
        )}
      </View>
      <View
        style={{
          backgroundColor: C.surface,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: C.outline,
          padding: 14,
          marginBottom: 12,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: mileageLogs.length ? 10 : 0,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '800', color: C.text }}>
            주행 기록
          </Text>
          <Pressable
            onPress={onAddMileage}
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: C.primary,
              },
              pressed && { opacity: 0.6 },
            ]}
          >
            <Ionicons name="add" size={16} color={C.primary} />
            <Text style={{ color: C.primary, fontSize: 12, fontWeight: '700' }}>
              추가
            </Text>
          </Pressable>
        </View>
        {mileageLogs.length === 0 ? (
          <Text
            style={{
              fontSize: 12,
              color: C.textMuted,
              paddingVertical: 12,
              textAlign: 'center',
            }}
          >
            주행 기록이 없습니다
          </Text>
        ) : (
          [...mileageLogs]
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 20)
            .map((log) => (
              <View
                key={log.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 8,
                  borderTopWidth: 1,
                  borderTopColor: C.surfaceAlt,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: C.text }}>
                    {log.date}
                  </Text>
                  <Text style={{ fontSize: 11, color: C.textMuted }}>
                    누적 {formatWon(log.odometerKm)}km
                    {log.dailyDistanceKm
                      ? ` · 주행 ${formatWon(log.dailyDistanceKm)}km`
                      : ''}
                  </Text>
                </View>
                <Pressable
                  onPress={() => onEditMileage(log)}
                  hitSlop={6}
                  style={{ padding: 4 }}
                >
                  <Ionicons name="create-outline" size={18} color={C.primary} />
                </Pressable>
                <Pressable
                  onPress={() =>
                    Alert.alert('주행 기록 삭제', `${log.date} 기록을 삭제할까요?`, [
                      { text: '취소', style: 'cancel' },
                      {
                        text: '삭제',
                        style: 'destructive',
                        onPress: () => onDeleteMileage(log.id),
                      },
                    ])
                  }
                  hitSlop={6}
                  style={{ padding: 4, marginLeft: 2 }}
                >
                  <Ionicons name="trash-outline" size={18} color={C.danger} />
                </Pressable>
              </View>
            ))
        )}
      </View>
      {(fuelLogs.length > 0 || mileageLogs.length > 0) &&
        (() => {
          const eff = summarizeEfficiency(fuelLogs, mileageLogs);
          const defaultVehicleLabel =
            settings.costs.vehicleModel?.trim() || '기본 차량';
          const byVehicle = summarizeEfficiencyByVehicle(fuelLogs, mileageLogs, {
            defaultLabel: defaultVehicleLabel,
          });
          const isPro = reportPlan === 'pro';
          const fleet = isPro
            ? buildFleetSummary(
                settings.costs.vehicleRegistry ?? [],
                fuelLogs,
                mileageLogs,
                defaultVehicleLabel,
              )
            : [];
          const metrics: Array<[string, string]> = [
            ['연비', eff.kmPerLiter != null ? `${eff.kmPerLiter} km/L` : '-'],
            [
              'km당 비용',
              eff.costPerKm != null ? `${formatWon(eff.costPerKm)}원` : '-',
            ],
            ['총 주행', `${formatWon(eff.totalDistanceKm)}km`],
            ['총 주유', `${formatWon(eff.totalFuelCost)}원`],
          ];
          return (
            <View
              style={{
                backgroundColor: C.surface,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: C.outline,
                padding: 14,
                marginBottom: 12,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '800',
                  color: C.text,
                  marginBottom: 12,
                }}
              >
                연비 요약
              </Text>
              <View style={{ flexDirection: 'row' }}>
                {metrics.map(([label, value]) => (
                  <View key={label} style={{ flex: 1, alignItems: 'center' }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: '800',
                        color: C.text,
                      }}
                      numberOfLines={1}
                    >
                      {value}
                    </Text>
                    <Text
                      style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}
                    >
                      {label}
                    </Text>
                  </View>
                ))}
              </View>
              {isPro && fleet.length > 1 ? (
                <View
                  style={{
                    marginTop: 12,
                    borderTopWidth: 1,
                    borderTopColor: C.outline,
                    paddingTop: 10,
                    gap: 8,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      marginBottom: 2,
                    }}
                  >
                    <Text style={{ fontSize: 11, color: C.textMuted }}>
                      차량별 비용
                    </Text>
                    <Ionicons name="star" size={9} color={C.warning} />
                  </View>
                  {fleet.map((row) => (
                    <View key={row.label} style={{ gap: 3 }}>
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: '700',
                            color: row.hasLogs ? C.text : C.textMuted,
                          }}
                          numberOfLines={1}
                        >
                          {row.label}
                          {!row.hasLogs ? ' · 기록 없음' : ''}
                        </Text>
                        <Text style={{ fontSize: 12, color: C.textMuted }}>
                          {formatWon(row.fuelCost)}원
                          {row.kmPerLiter != null
                            ? ` · ${row.kmPerLiter} km/L`
                            : ''}
                        </Text>
                      </View>
                      <View
                        style={{
                          height: 4,
                          borderRadius: 2,
                          backgroundColor: C.surfaceAlt,
                          overflow: 'hidden',
                        }}
                      >
                        <View
                          style={{
                            width: `${Math.max(2, Math.round(row.share * 100))}%`,
                            height: 4,
                            borderRadius: 2,
                            backgroundColor: C.primary,
                          }}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              ) : byVehicle.length > 1 ? (
                <View
                  style={{
                    marginTop: 12,
                    borderTopWidth: 1,
                    borderTopColor: C.outline,
                    paddingTop: 10,
                    gap: 6,
                  }}
                >
                  <Text
                    style={{ fontSize: 11, color: C.textMuted, marginBottom: 2 }}
                  >
                    차량별
                  </Text>
                  {byVehicle.map((entry) => (
                    <View
                      key={entry.vehicle}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Text
                        style={{ fontSize: 12, fontWeight: '700', color: C.text }}
                        numberOfLines={1}
                      >
                        {entry.vehicle}
                      </Text>
                      <Text style={{ fontSize: 12, color: C.textMuted }}>
                        {entry.summary.kmPerLiter != null
                          ? `${entry.summary.kmPerLiter} km/L`
                          : '-'}{' '}
                        · {formatWon(entry.summary.totalDistanceKm)}km
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })()}
      <Pressable
        onPress={() =>
          Share.share({
            message: buildBackupJson({
              orders,
              fuelLogs,
              mileageLogs,
              contactLogs,
              settings,
              exportedAt: new Date().toISOString(),
            }),
            title: 'Routelo 데이터 백업 (JSON)',
          }).catch(() => undefined)
        }
        style={({ pressed }) => [
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: C.outline,
            marginBottom: 12,
          },
          pressed && { opacity: 0.6 },
        ]}
      >
        <Ionicons name="cloud-download-outline" size={18} color={C.textMuted} />
        <Text style={{ color: C.textMuted, fontSize: 13, fontWeight: '700' }}>
          데이터 백업 (JSON 내보내기)
        </Text>
      </Pressable>
      <Pressable
        onPress={() => {
          setRestoreText('');
          setRestoreOpen(true);
        }}
        style={({ pressed }) => [
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: C.outline,
            marginBottom: 12,
          },
          pressed && { opacity: 0.6 },
        ]}
      >
        <Ionicons name="cloud-upload-outline" size={18} color={C.textMuted} />
        <Text style={{ color: C.textMuted, fontSize: 13, fontWeight: '700' }}>
          데이터 복원 (JSON 붙여넣기)
        </Text>
      </Pressable>
      <Modal
        visible={restoreOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setRestoreOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.45)',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: C.surface,
              borderRadius: 20,
              padding: 20,
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: '800',
                color: C.text,
                marginBottom: 6,
              }}
            >
              데이터 복원
            </Text>
            <Text
              style={{ fontSize: 12, color: C.textMuted, marginBottom: 12 }}
            >
              내보낸 백업 JSON을 붙여넣으세요. 복원하면 현재 데이터를 덮어씁니다.
            </Text>
            <TextInput
              value={restoreText}
              onChangeText={setRestoreText}
              multiline
              placeholder="{ &quot;app&quot;: &quot;routelo-for-ios&quot;, ... }"
              placeholderTextColor={C.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                minHeight: 140,
                maxHeight: 240,
                borderWidth: 1,
                borderColor: C.outline,
                borderRadius: 12,
                padding: 12,
                color: C.text,
                fontSize: 12,
                textAlignVertical: 'top',
              }}
            />
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'flex-end',
                gap: 8,
                marginTop: 16,
              }}
            >
              <Pressable
                onPress={() => setRestoreOpen(false)}
                style={({ pressed }) => [
                  {
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                  },
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Text
                  style={{ color: C.textMuted, fontSize: 14, fontWeight: '700' }}
                >
                  취소
                </Text>
              </Pressable>
              <Pressable
                disabled={!canRestore}
                onPress={() => {
                  setRestoreOpen(false);
                  onImportBackup(restoreText);
                }}
                style={({ pressed }) => [
                  {
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    backgroundColor: C.primary,
                    opacity: canRestore ? 1 : 0.4,
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={{ color: C.onPrimary, fontSize: 14, fontWeight: '800' }}>
                  복원
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {selectedItems.length === 0 ? (
        <View style={styles.calendarEmpty}>
          <Ionicons name="calendar-clear-outline" size={30} color={C.textMuted} />
          <Text style={styles.calendarEmptyTitle}>등록된 배달이 없습니다</Text>
          <Text style={styles.calendarEmptyText}>
            날짜만 인식된 OCR 일정도 이곳에 안전하게 표시됩니다.
          </Text>
        </View>
      ) : (
        selectedItems.map((item) => {
          const risk = calendarRisks.get(item.id);
          const order = orders.find(
            (entry) => entry.id === item.deliveryOrderId,
          );
          const delivery = order ? orderToLegacyDelivery(order) : undefined;
          const receiptUri = order?.receiptPhotoPath
            ? resolveReceiptPhotoUri(
                FileSystem.documentDirectory ?? '',
                order.receiptPhotoPath,
              )
            : undefined;
          const primaryTime =
            timeLabel(item.deadlineAt) ||
            timeLabel(item.startAt) ||
            timeLabel(item.eventAt);
          return (
            <Pressable
              key={item.id}
              style={[
                styles.calendarAgendaCard,
                risk?.conflict && styles.calendarAgendaCardConflict,
                risk?.late && styles.calendarAgendaCardLate,
              ]}
              onPress={() => delivery && onDeliveryPress(delivery)}
            >
              <View style={styles.calendarTimeColumn}>
                <Text
                  style={[
                    styles.calendarAgendaTime,
                    item.priority !== 'normal' && { color: C.danger },
                  ]}
                >
                  {primaryTime || '시간 미정'}
                </Text>
                <Text style={styles.calendarPrecision}>
                  {item.timePrecision === 'date-only'
                    ? '날짜만 확인'
                    : item.timePrecision === 'approximate'
                      ? '대략 시간'
                      : '확정 일정'}
                </Text>
              </View>
              <View style={styles.calendarAgendaBody}>
                <Text style={styles.calendarAgendaTitle}>{item.title}</Text>
                <Text style={styles.calendarAgendaAddress}>
                  {showFullAddressInList
                    ? item.address
                    : maskAddressForList(item.address)}
                </Text>
                <View style={styles.calendarMetaRow}>
                  {risk?.conflict && (
                    <Text style={styles.calendarConflictText}>일정 충돌</Text>
                  )}
                  {risk?.late && (
                    <Text style={styles.calendarLateText}>도착 지연 위험</Text>
                  )}
                  {!!item.deadlineAt && (
                    <Text style={styles.calendarUrgentText}>
                      엄수 {timeLabel(item.deadlineAt)}
                    </Text>
                  )}
                  {!!item.eventAt && (
                    <Text style={styles.calendarEventText}>
                      행사 {timeLabel(item.eventAt)}
                    </Text>
                  )}
                </View>
              </View>
              {receiptUri && (
                <Pressable
                  onPress={() => setReceiptPreview(receiptUri)}
                  hitSlop={6}
                  style={({ pressed }) => [
                    {
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      overflow: 'hidden',
                      borderWidth: 1,
                      borderColor: C.outline,
                      alignSelf: 'center',
                    },
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <Image
                    source={{ uri: receiptUri }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />
                </Pressable>
              )}
            </Pressable>
          );
        })
      )}
      <Modal
        visible={Boolean(receiptPreview)}
        transparent
        animationType="fade"
        onRequestClose={() => setReceiptPreview(undefined)}
      >
        <Pressable
          onPress={() => setReceiptPreview(undefined)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.9)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          {receiptPreview && (
            <Image
              source={{ uri: receiptPreview }}
              style={{ width: '100%', height: '80%' }}
              resizeMode="contain"
            />
          )}
          <Text style={{ color: '#fff', marginTop: 16, opacity: 0.8 }}>
            탭하여 닫기 · 인수증 원본
          </Text>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}


function NotificationsScreen() {
  const { C, styles } = useTheme();
  return (
    <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
      <ScreenHeader
        eyebrow="ALERT CENTER"
        title="알림"
        subtitle="긴급도가 높은 알림부터 표시합니다."
      />
      <View style={styles.notificationSummary}>
        <View>
          <Text style={styles.notificationSummaryLabel}>확인 필요한 알림</Text>
          <Text style={styles.notificationSummaryValue}>3건</Text>
        </View>
        <View style={styles.urgencyLegend}>
          <View style={[styles.legendDot, { backgroundColor: C.danger }]} />
          <Text style={styles.legendText}>긴급 1</Text>
          <View style={[styles.legendDot, { backgroundColor: C.warning }]} />
          <Text style={styles.legendText}>주의 1</Text>
        </View>
      </View>
      <SectionHeader title="오늘" />
      <View style={styles.notificationList}>
        <NotificationCard
          tone="danger"
          icon="calendar-outline"
          title="예식 시간 30분 전"
          body="축하 3단 화환 설치를 11:00 이전에 완료해야 합니다."
          time="10:30"
        />
        <NotificationCard
          tone="warning"
          icon="speedometer-outline"
          title="도착 지연 위험"
          body="송파구 목적지의 예상 도착 시간이 엄수 마감과 12분 차이입니다."
          time="10:18"
        />
      </View>
      <SectionHeader title="이전 알림" />
      <NotificationCard
        tone="info"
        icon="checkmark-done-outline"
        title="첫 번째 배송 완료"
        body="강남구 학동로 배송이 정상적으로 완료되었습니다."
        time="09:14"
      />
    </ScrollView>
  );
}

function SettingsScreen({
  account,
  settings,
  onSettingsChange,
  onEditAccount,
  onExportCsv,
}: {
  account?: AccountState;
  settings: RouteloSettings;
  onSettingsChange: (settings: RouteloSettings) => void;
  onEditAccount: () => void;
  onExportCsv?: () => void;
}) {
  const { C, styles } = useTheme();
  const [districtQuery, setDistrictQuery] = useState('');
  const [pendingReports, setPendingReports] = useState(0);
  const plan: AppPlan = resolvePlan(settings.entitlement);
  const [scanToday, setScanToday] = useState(0);
  const [newVehicle, setNewVehicle] = useState('');
  const vehicleRegistry = dedupeVehicles(settings.costs.vehicleRegistry ?? []);
  const addFleetVehicle = () => {
    if (!isValidVehicleLabel(newVehicle)) {
      Alert.alert('차량 이름 확인', '1~24자 이내로 입력해주세요.');
      return;
    }
    const next = addVehicle(vehicleRegistry, newVehicle);
    if (next.length === vehicleRegistry.length) {
      Alert.alert(
        '추가할 수 없음',
        vehicleRegistry.length >= MAX_VEHICLES
          ? `차량은 최대 ${MAX_VEHICLES}대까지 등록할 수 있어요.`
          : '이미 등록된 차량입니다.',
      );
      return;
    }
    updateSettings({
      ...settings,
      costs: { ...settings.costs, vehicleRegistry: next },
    });
    setNewVehicle('');
  };
  const removeFleetVehicle = (label: string) => {
    updateSettings({
      ...settings,
      costs: {
        ...settings.costs,
        vehicleRegistry: removeVehicle(vehicleRegistry, label),
      },
    });
  };
  useEffect(() => {
    pendingReportCount()
      .then(setPendingReports)
      .catch(() => undefined);
    getTodayScanCount(AsyncStorage, new Date())
      .then(setScanToday)
      .catch(() => undefined);
  }, []);
  const [openRegions, setOpenRegions] = useState<{
    Seoul: boolean;
    Gyeonggi: boolean;
  }>({ Seoul: false, Gyeonggi: false });
  const normalizedQuery = districtQuery.trim().replace(/\s/g, '');
  const visibleSeoul = SEOUL_DISTRICTS.filter((district) =>
    district.replace(/\s/g, '').includes(normalizedQuery),
  );
  const visibleGyeonggi = GYEONGGI_DISTRICTS.filter((district) =>
    district.replace(/\s/g, '').includes(normalizedQuery),
  );

  const updateSettings = (next: RouteloSettings) => {
    onSettingsChange(next);
    settingsRepository.save(next).catch(() => undefined);
  };

  const updateDistrictFee = (district: string, value: string) => {
    const numeric = Number(value.replace(/[^\d]/g, ''));
    updateSettings({
      ...settings,
      fees: {
        ...settings.fees,
        districtFees: {
          ...settings.fees.districtFees,
          Seoul: {
            ...settings.fees.districtFees.Seoul,
            ...(SEOUL_DISTRICTS.includes(district as never)
              ? { [district]: Number.isFinite(numeric) ? numeric : 0 }
              : {}),
          },
          Gyeonggi: {
            ...settings.fees.districtFees.Gyeonggi,
            ...(GYEONGGI_DISTRICTS.includes(district as never)
              ? { [district]: Number.isFinite(numeric) ? numeric : 0 }
              : {}),
          },
        },
      },
    });
  };

  const alertModeOptions: Array<{
    mode: NotificationAlertMode;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
  }> = [
    { mode: 'sound', label: '소리', icon: 'volume-high-outline' },
    { mode: 'vibration', label: '진동', icon: 'phone-portrait-outline' },
    { mode: 'both', label: '소리+진동', icon: 'notifications-outline' },
  ];
  const soundOptions: Array<{ name: NotificationSoundName; label: string }> = [
    { name: 'routelo_ding', label: '딩동 (밝게)' },
    { name: 'routelo_bell', label: '벨 (부드럽게)' },
    { name: 'routelo_arp', label: '아르페지오' },
    { name: 'default', label: '기본음' },
  ];
  const setNotifications = (patch: Partial<RouteloSettings['notifications']>) =>
    updateSettings({
      ...settings,
      notifications: { ...settings.notifications, ...patch },
    });

  return (
    <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
      <ScreenHeader
        eyebrow="APP PREFERENCES"
        title="설정"
        subtitle="업무 알림과 경로 계산 방식을 관리합니다."
      />
      <View style={styles.profileCard}>
        <View style={styles.profileAvatar}>
          <Ionicons name="person" size={27} color={C.primary} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.profileName}>
            {account?.profile.displayName || '업무 기사 프로필'}
          </Text>
          <Text style={styles.profileCaption}>
            {account?.profile.accountMode === 'guest'
              ? '게스트 모드 · 로컬 저장'
              : `${account?.vehicles[0]?.model || '차량 미등록'} · 회원 모드`}
          </Text>
        </View>
        <Pressable style={styles.iconButton} onPress={onEditAccount}>
          <Ionicons name="pencil-outline" size={19} color={C.primary} />
        </Pressable>
      </View>

      <SectionHeader title="멤버십" />
      <View style={[styles.settingsGroup, { padding: 14 }]}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons
              name={plan === 'pro' ? 'star' : 'star-outline'}
              size={18}
              color={plan === 'pro' ? C.warning : C.textMuted}
            />
            <Text style={{ color: C.navy, fontSize: 15, fontWeight: '800' }}>
              {plan === 'pro' ? 'Pro · 파운딩 멤버' : '무료 요금제'}
            </Text>
          </View>
          <Pressable
            onPress={() =>
              updateSettings({
                ...settings,
                entitlement: { plan: plan === 'pro' ? 'free' : 'pro' },
              })
            }
            style={({ pressed }) => [
              {
                paddingHorizontal: 12,
                minHeight: 34,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: C.outline,
                alignItems: 'center',
                justifyContent: 'center',
              },
              pressed && { opacity: 0.6 },
            ]}
          >
            <Text style={{ color: C.primary, fontWeight: '700', fontSize: 12 }}>
              {plan === 'pro' ? '무료 체험 미리보기' : 'Pro로 전환'}
            </Text>
          </Pressable>
        </View>
        {plan === 'free' && (
          <View
            style={{
              padding: 10,
              borderRadius: 10,
              backgroundColor: C.surfaceAlt,
              marginBottom: 12,
            }}
          >
            <Text style={{ color: C.textMuted, fontSize: 12, fontWeight: '600' }}>
              오늘 무료 스캔 {remainingFreeScans('free', scanToday)}/
              {FREE_DAILY_SCAN_LIMIT}건 남음
            </Text>
          </View>
        )}
        {PRO_FEATURES.map((feature) => (
          <View
            key={feature.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingVertical: 8,
            }}
          >
            <Ionicons
              name={plan === 'pro' ? 'checkmark-circle' : 'lock-closed'}
              size={18}
              color={plan === 'pro' ? C.success : C.textMuted}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontSize: 13, fontWeight: '700' }}>
                {feature.label}
              </Text>
              <Text style={{ color: C.textMuted, fontSize: 11, marginTop: 2 }}>
                {feature.desc}
              </Text>
            </View>
          </View>
        ))}
        {plan === 'free' && (
          <Pressable
            onPress={() =>
              Alert.alert(
                'Pro 곧 출시',
                'Pro 구독은 준비 중입니다. 관심 감사합니다! 베타 파운딩 멤버에게는 특별 혜택을 드립니다.',
              )
            }
            style={({ pressed }) => [
              {
                marginTop: 10,
                minHeight: 44,
                borderRadius: 12,
                backgroundColor: C.primary,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 6,
              },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Ionicons name="star" size={16} color={C.onPrimary} />
            <Text style={{ color: C.onPrimary, fontWeight: '800', fontSize: 13 }}>
              Pro 알아보기
            </Text>
          </Pressable>
        )}
      </View>

      <SectionHeader title="보안" />
      <View style={styles.settingsGroup}>
        <SettingRow
          icon="lock-closed-outline"
          title="앱 잠금 (PIN)"
          caption="앱을 열 때 PIN을 요구해 민감한 배송 정보를 보호합니다"
          trailing={
            <Switch
              value={settings.security.appLockEnabled}
              onValueChange={(on) => {
                if (on) {
                  Alert.prompt(
                    '앱 잠금 PIN 설정',
                    '4~6자리 숫자를 입력하세요',
                    (pin?: string) => {
                      if (pin && isValidPin(pin)) {
                        setPin(pin).catch(() => undefined);
                        clearLockoutState().catch(() => undefined);
                        updateSettings({
                          ...settings,
                          security: {
                            ...settings.security,
                            appLockEnabled: true,
                          },
                        });
                      } else {
                        Alert.alert('PIN 오류', '4~6자리 숫자를 입력해주세요.');
                      }
                    },
                    'secure-text',
                  );
                } else {
                  clearPin().catch(() => undefined);
                  clearLockoutState().catch(() => undefined);
                  updateSettings({
                    ...settings,
                    security: { ...settings.security, appLockEnabled: false },
                  });
                }
              }}
              trackColor={{ true: C.primary }}
            />
          }
        />
      </View>

      <SectionHeader title="데이터" />
      <View style={styles.settingsGroup}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="배달 기록 CSV 내보내기"
          style={styles.settingRow}
          onPress={() => {
            if (plan === 'pro') onExportCsv?.();
            else
              Alert.alert(
                'Pro 기능',
                'CSV 내보내기는 Pro에서 사용할 수 있어요.',
              );
          }}
        >
          <View style={styles.settingIcon}>
            <Ionicons name="download-outline" size={21} color={C.primary} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.settingTitle}>배달 기록 CSV 내보내기</Text>
            <Text style={styles.settingCaption}>
              {plan === 'pro' ? '엑셀에서 열 수 있는 CSV로 공유' : 'Pro 전용'}
            </Text>
          </View>
          <Ionicons
            name={plan === 'pro' ? 'chevron-forward' : 'lock-closed'}
            size={18}
            color={C.textMuted}
          />
        </Pressable>
      </View>

      <SectionHeader title="차량 관리" />
      <View style={styles.settingsGroup}>
        {plan !== 'pro' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="다중 차량 관리 · Pro 전용"
            style={styles.settingRow}
            onPress={() =>
              Alert.alert(
                'Pro 기능',
                '다중 차량 관리는 Pro에서 사용할 수 있어요.\n차량별 주유·연비·비용을 분리해서 볼 수 있습니다.',
              )
            }
          >
            <View style={styles.settingIcon}>
              <Ionicons name="car-sport-outline" size={21} color={C.primary} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.settingTitle}>다중 차량 관리</Text>
              <Text style={styles.settingCaption}>Pro 전용 · 차량별 비용 분리</Text>
            </View>
            <Ionicons name="lock-closed" size={18} color={C.textMuted} />
          </Pressable>
        ) : (
          <View style={{ padding: 14 }}>
            <Text
              style={{
                color: C.textMuted,
                fontSize: 12,
                fontWeight: '700',
                marginBottom: 8,
              }}
            >
              등록 차량 ({vehicleRegistry.length}/{MAX_VEHICLES})
            </Text>
            {vehicleRegistry.length === 0 ? (
              <Text style={{ fontSize: 12, color: C.textMuted, marginBottom: 10 }}>
                차량을 등록하면 주유·주행 기록에서 칩으로 빠르게 선택할 수 있어요.
              </Text>
            ) : (
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                {vehicleRegistry.map((label) => (
                  <View
                    key={label}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingLeft: 12,
                      paddingRight: 8,
                      paddingVertical: 6,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: C.outline,
                      backgroundColor: C.surfaceAlt,
                    }}
                  >
                    <Text
                      style={{ fontSize: 13, fontWeight: '700', color: C.text }}
                    >
                      {label}
                    </Text>
                    <Pressable
                      onPress={() =>
                        Alert.alert('차량 삭제', `'${label}'을(를) 목록에서 뺄까요?\n(기존 기록은 유지됩니다)`, [
                          { text: '취소', style: 'cancel' },
                          {
                            text: '삭제',
                            style: 'destructive',
                            onPress: () => removeFleetVehicle(label),
                          },
                        ])
                      }
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={`${label} 삭제`}
                    >
                      <Ionicons name="close-circle" size={18} color={C.textMuted} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                value={newVehicle}
                onChangeText={setNewVehicle}
                placeholder="예: 포터2 · 봉고3 · 전기트럭"
                placeholderTextColor={C.textMuted}
                onSubmitEditing={addFleetVehicle}
                returnKeyType="done"
                style={{
                  flex: 1,
                  backgroundColor: C.surfaceAlt,
                  borderWidth: 1,
                  borderColor: C.outline,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  fontSize: 14,
                  color: C.text,
                }}
              />
              <Pressable
                onPress={addFleetVehicle}
                accessibilityRole="button"
                accessibilityLabel="차량 추가"
                style={({ pressed }) => [
                  {
                    paddingHorizontal: 16,
                    justifyContent: 'center',
                    borderRadius: 12,
                    backgroundColor: C.primary,
                  },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={{ color: C.onPrimary, fontSize: 14, fontWeight: '800' }}>
                  추가
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      <SectionHeader title="알림 설정" />
      <View style={styles.settingsGroup}>
        <SettingRow
          icon="alarm-outline"
          title="엄수 마감 알림"
          caption={`${settings.notifications.strictDeadlineLeadMinutes.join('분 · ')}분 전에 알림`}
          trailing={
            <Switch
              value={settings.notifications.strictDeadlineEnabled}
              onValueChange={(enabled) => {
                if (enabled) {
                  ensureNotificationPermission().catch(() => undefined);
                }
                updateSettings({
                  ...settings,
                  notifications: {
                    ...settings.notifications,
                    strictDeadlineEnabled: enabled,
                  },
                });
              }}
              trackColor={{ true: C.primary }}
            />
          }
        />
        <View style={styles.divider} />
        <SettingRow
          icon="calendar-outline"
          title="예식 시간 알림"
          caption="예식 배송을 최우선으로 경고"
          trailing={
            <Switch
              value={settings.notifications.eventTimeEnabled}
              onValueChange={(enabled) => {
                if (enabled) {
                  ensureNotificationPermission().catch(() => undefined);
                }
                updateSettings({
                  ...settings,
                  notifications: {
                    ...settings.notifications,
                    eventTimeEnabled: enabled,
                  },
                });
              }}
              trackColor={{ true: C.primary }}
            />
          }
        />
        <View style={styles.divider} />
        <SettingRow
          icon="warning-outline"
          title="경로 변경·지연 알림"
          caption="도착 지연 가능성이 있을 때 알림"
          trailing={
            <Switch
              value={settings.notifications.delayRiskEnabled}
              onValueChange={(enabled) =>
                updateSettings({
                  ...settings,
                  notifications: {
                    ...settings.notifications,
                    delayRiskEnabled: enabled,
                  },
                })
              }
              trackColor={{ true: C.primary }}
            />
          }
        />
      </View>

      <SectionHeader title="알림음 · 진동" />
      <View style={styles.settingsGroup}>
        <View style={{ padding: 14 }}>
          <Text
            style={{
              color: C.textMuted,
              fontSize: 12,
              fontWeight: '700',
              marginBottom: 8,
            }}
          >
            알림 방식
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {alertModeOptions.map((option) => {
              const active = settings.notifications.alertMode === option.mode;
              return (
                <Pressable
                  key={option.mode}
                  onPress={() => setNotifications({ alertMode: option.mode })}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    gap: 4,
                    paddingVertical: 10,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: active ? C.primary : C.outline,
                    backgroundColor: active ? C.primaryContainer : 'transparent',
                  }}
                >
                  <Ionicons
                    name={option.icon}
                    size={18}
                    color={active ? C.primary : C.textMuted}
                  />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: active ? C.primary : C.textMuted,
                    }}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={styles.divider} />
        <View
          style={{
            padding: 14,
            opacity: settings.notifications.alertMode === 'vibration' ? 0.4 : 1,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 6,
            }}
          >
            <Text style={{ color: C.textMuted, fontSize: 12, fontWeight: '700' }}>
              알림음
            </Text>
            <Pressable
              onPress={() =>
                sendTestNotification(settings.notifications).catch(
                  () => undefined,
                )
              }
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: C.primaryContainer,
                },
                pressed && { opacity: 0.6 },
              ]}
            >
              <Ionicons name="play" size={13} color={C.primary} />
              <Text
                style={{ color: C.primary, fontWeight: '700', fontSize: 12 }}
              >
                테스트
              </Text>
            </Pressable>
          </View>
          {soundOptions.map((option) => {
            const active = settings.notifications.soundName === option.name;
            return (
              <Pressable
                key={option.name}
                disabled={settings.notifications.alertMode === 'vibration'}
                onPress={() => setNotifications({ soundName: option.name })}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingVertical: 11,
                }}
              >
                <Ionicons
                  name={active ? 'radio-button-on' : 'radio-button-off'}
                  size={18}
                  color={active ? C.primary : C.textMuted}
                />
                <Text
                  style={{
                    fontSize: 14,
                    color: C.text,
                    fontWeight: active ? '700' : '500',
                  }}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
          <Text
            style={{
              color: C.textMuted,
              fontSize: 11,
              marginTop: 6,
              lineHeight: 16,
            }}
          >
            iOS는 소리·진동을 시스템 설정과 함께 제어합니다. '진동'만 선택하면 무음
            알림으로 전송돼 진동만 울립니다. 테스트는 1초 뒤 실제 알림으로 미리 들려줍니다.
          </Text>
        </View>
      </View>

      <SectionHeader title="경로 설정" />
      <View style={styles.settingsGroup}>
        <SettingRow icon="car-outline" title="이동 수단" caption="업무용 차량 · 자동차" />
        <View style={styles.divider} />
        <SettingRow
          icon="navigate-outline"
          title="내비게이션 앱"
          caption="경로 안내를 넘길 앱을 선택합니다"
        />
        <View style={styles.navAppOptions}>
          {(['tmap', 'kakao', 'naver'] as NavApp[]).map((app) => {
            const active = settings.route.navApp === app;
            return (
              <Pressable
                key={app}
                style={[styles.navAppOption, active && styles.navAppOptionActive]}
                onPress={() =>
                  updateSettings({
                    ...settings,
                    route: { ...settings.route, navApp: app },
                  })
                }
              >
                <Text
                  style={[
                    styles.navAppOptionText,
                    active && styles.navAppOptionTextActive,
                  ]}
                >
                  {NAV_APP_LABEL[app]}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.divider} />
        <SettingRow
          icon="swap-vertical-outline"
          title="수동 순서 변경"
          caption="배송 순서를 직접 조정할 수 있습니다"
          trailing={
            <Switch
              value={settings.route.allowManualReorder}
              onValueChange={(enabled) =>
                updateSettings({
                  ...settings,
                  route: { ...settings.route, allowManualReorder: enabled },
                })
              }
              trackColor={{ true: C.primary }}
            />
          }
        />
      </View>

      <SectionHeader title="개인정보 보호" />
      <View style={styles.settingsGroup}>
        <SettingRow
          icon="image-outline"
          title="원본 인수증 보관"
          caption="OCR 검증을 위해 촬영 원본을 로컬에 보관합니다"
          trailing={
            <Switch
              value={settings.privacy.preserveOriginalReceiptImage}
              onValueChange={(enabled) =>
                updateSettings({
                  ...settings,
                  privacy: {
                    ...settings.privacy,
                    preserveOriginalReceiptImage: enabled,
                  },
                })
              }
              trackColor={{ true: C.primary }}
            />
          }
        />
        <View style={styles.divider} />
        <SettingRow
          icon="call-outline"
          title="목록에서 전화번호 표시"
          caption="민감정보 노출을 줄이려면 끄는 것을 권장합니다"
          trailing={
            <Switch
              value={settings.privacy.showFullPhoneInList}
              onValueChange={(enabled) =>
                updateSettings({
                  ...settings,
                  privacy: { ...settings.privacy, showFullPhoneInList: enabled },
                })
              }
              trackColor={{ true: C.primary }}
            />
          }
        />
        <View style={styles.divider} />
        <SettingRow
          icon="globe-outline"
          title="온라인 발주처 교차검증"
          caption="발주처 업체명만 온라인 장소검색으로 대조합니다. 수령인 정보는 전송하지 않습니다."
          trailing={
            <Switch
              value={settings.ocr.onlineVendorVerification}
              onValueChange={(enabled) =>
                updateSettings({
                  ...settings,
                  ocr: { ...settings.ocr, onlineVendorVerification: enabled },
                })
              }
              trackColor={{ true: C.primary }}
            />
          }
        />
      </View>

      <SectionHeader title="품질 개선" />
      <View style={styles.settingsGroup}>
        <SettingRow
          icon="shield-checkmark-outline"
          title="익명 품질 리포트 제공"
          caption="OCR 인식 정확도 개선에 익명 데이터를 제공합니다 (선택)"
          trailing={
            <Switch
              value={!!settings.telemetry?.enabled}
              onValueChange={(enabled) => {
                updateSettings({ ...settings, telemetry: { enabled } });
                if (enabled) {
                  flushTelemetry({ enabled: true })
                    .then(() => pendingReportCount())
                    .then(setPendingReports)
                    .catch(() => undefined);
                }
              }}
              trackColor={{ true: C.primary }}
            />
          }
        />
      </View>
      <Text
        style={{
          color: C.textMuted,
          fontSize: 11,
          lineHeight: 17,
          marginTop: 8,
          paddingHorizontal: 4,
        }}
      >
        켜면 인식 결과와 사용자가 고친 값의 차이를 익명으로 수집해 정확도 개선에
        사용합니다. 이름·전화·주소 같은 개인정보는 형태만 남기고 마스킹하며(예:
        홍길동→○○○, 010-…→NNN-…), 영수증 사진은 전송하지 않습니다. 언제든 끌 수
        있습니다.
      </Text>
      {!!settings.telemetry?.enabled && (
        <Pressable
          onPress={() => {
            flushTelemetry({ enabled: true })
              .then(() => pendingReportCount())
              .then(setPendingReports)
              .catch(() => undefined);
          }}
          style={({ pressed }) => [
            {
              marginTop: 10,
              minHeight: 42,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: C.outline,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 6,
            },
            pressed && { opacity: 0.6 },
          ]}
        >
          <Ionicons name="cloud-upload-outline" size={16} color={C.primary} />
          <Text style={{ color: C.primary, fontWeight: '700', fontSize: 13 }}>
            지금 보내기{pendingReports > 0 ? ` (대기 ${pendingReports}건)` : ''}
          </Text>
        </Pressable>
      )}

      <SectionHeader title="앱 설정" />
      <View style={styles.settingsGroup}>
        <SettingRow
          icon="color-palette-outline"
          title="화면 모드"
          caption={settings.appearance.themeMode === 'dark' ? '다크 모드 사용 중' : '라이트 모드 사용 중'}
          trailing={
            <Switch
              value={settings.appearance.themeMode === 'dark'}
              onValueChange={(enabled) =>
                updateSettings({
                  ...settings,
                  appearance: {
                    ...settings.appearance,
                    themeMode: enabled ? 'dark' : 'light',
                  },
                })
              }
              trackColor={{ true: C.primary }}
            />
          }
        />
        <View style={styles.divider} />
        <SettingRow icon="language-outline" title="언어" caption="한국어" />
        <View style={styles.divider} />
        <SettingRow icon="information-circle-outline" title="앱 정보" caption="RouteLO 1.0.0" />
      </View>
      <SectionHeader
        title="지역별 배달 수수료"
        caption="서울 25개 자치구와 경기도 31개 시군별 금액을 회사 정책에 맞게 설정합니다."
      />
      <View style={styles.districtFeePanel}>
        <TextInput
          value={districtQuery}
          onChangeText={setDistrictQuery}
          placeholder="지역 검색"
          placeholderTextColor={C.textMuted}
          style={styles.districtSearchInput}
        />
        {(['Seoul', 'Gyeonggi'] as const).map((region) => {
          const label = region === 'Seoul' ? '서울 지역' : '경기도 지역';
          const all =
            region === 'Seoul' ? SEOUL_DISTRICTS : GYEONGGI_DISTRICTS;
          const visible = region === 'Seoul' ? visibleSeoul : visibleGyeonggi;
          const fees = settings.fees.districtFees[region];
          const expanded = openRegions[region] || normalizedQuery.length > 0;
          return (
            <View key={region} style={styles.districtRegion}>
              <Pressable
                style={styles.districtRegionHeader}
                onPress={() =>
                  setOpenRegions((current) => ({
                    ...current,
                    [region]: !current[region],
                  }))
                }
              >
                <Text style={styles.districtFeeGroupTitle}>{label}</Text>
                <View style={styles.districtRegionRight}>
                  <Text style={styles.districtRegionCount}>
                    {normalizedQuery
                      ? `${visible.length}/${all.length}`
                      : `${all.length}개`}
                  </Text>
                  <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={C.textMuted}
                  />
                </View>
              </Pressable>
              {expanded &&
                visible.map((district) => (
                  <View key={district} style={styles.districtFeeRow}>
                    <Text style={styles.districtFeeName}>{district}</Text>
                    <TextInput
                      value={String(fees[district] || 0)}
                      onChangeText={(value) => updateDistrictFee(district, value)}
                      keyboardType="number-pad"
                      placeholder="15000"
                      placeholderTextColor={C.textMuted}
                      style={styles.districtFeeInput}
                    />
                    <Text style={styles.districtFeeUnit}>원</Text>
                  </View>
                ))}
              {expanded && normalizedQuery.length > 0 && !visible.length && (
                <Text style={styles.districtEmptyText}>검색 결과가 없습니다</Text>
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function OnboardingModal({
  visible,
  initial,
  onComplete,
}: {
  visible: boolean;
  initial?: AccountState;
  onComplete: (state: AccountState) => void;
}) {
  const { C, styles } = useTheme();
  const [mode, setMode] = useState<'choice' | 'member'>(
    initial?.profile.accountMode === 'member' ? 'member' : 'choice',
  );
  const [displayName, setDisplayName] = useState(
    initial?.profile.displayName || '',
  );
  const [email, setEmail] = useState(initial?.profile.email || '');
  const [password, setPassword] = useState('');
  const [vehicleModel, setVehicleModel] = useState(
    initial?.vehicles[0]?.model || '',
  );
  const [energyType, setEnergyType] = useState<EnergyType>(
    initial?.vehicles[0]?.energyType || 'diesel',
  );
  const [capacity, setCapacity] = useState(
    String(
      initial?.vehicles[0]?.tankCapacityLiters ||
        initial?.vehicles[0]?.batteryCapacityKwh ||
        '',
    ),
  );

  useEffect(() => {
    if (!visible) return;
    setMode(initial?.profile.accountMode === 'member' ? 'member' : 'choice');
    setDisplayName(initial?.profile.displayName || '');
    setEmail(initial?.profile.email || '');
    setPassword('');
    setVehicleModel(initial?.vehicles[0]?.model || '');
    setEnergyType(initial?.vehicles[0]?.energyType || 'diesel');
    setCapacity(
      String(
        initial?.vehicles[0]?.tankCapacityLiters ||
          initial?.vehicles[0]?.batteryCapacityKwh ||
          '',
      ),
    );
  }, [initial, visible]);

  const saveGuest = () => {
    const now = new Date().toISOString();
    onComplete({
      profile: {
        schemaVersion: 1,
        id: initial?.profile.id || `guest-${Date.now()}`,
        accountMode: 'guest',
        plan: 'guest',
        status: 'active',
        displayName: displayName.trim() || '게스트 기사',
        createdAt: initial?.profile.createdAt || now,
        updatedAt: now,
      },
      vehicles: initial?.vehicles || [],
    });
  };

  const saveMember = () => {
    if (!displayName.trim() || !email.includes('@')) {
      Alert.alert('가입 정보 확인', '이름과 올바른 이메일을 입력해주세요.');
      return;
    }
    if (!initial && password.length < 8) {
      Alert.alert('비밀번호 확인', '비밀번호는 8자 이상 입력해주세요.');
      return;
    }
    if (!vehicleModel.trim()) {
      Alert.alert('차량 정보 확인', '업무 차량의 차종을 입력해주세요.');
      return;
    }
    const now = new Date().toISOString();
    const userId = initial?.profile.id || `member-${Date.now()}`;
    const numericCapacity = Number(capacity);
    const vehicleId = initial?.vehicles[0]?.id || `vehicle-${Date.now()}`;
    const state: AccountState = {
      profile: {
        schemaVersion: 1,
        id: userId,
        accountMode: 'member',
        plan: initial?.profile.plan === 'premium' ? 'premium' : 'free',
        status: 'active',
        displayName: displayName.trim(),
        email: email.trim(),
        primaryVehicleId: vehicleId,
        createdAt: initial?.profile.createdAt || now,
        updatedAt: now,
      },
      vehicles: [
        {
          schemaVersion: 1,
          id: vehicleId,
          userId,
          nickname: '업무 차량',
          model: vehicleModel.trim(),
          vehicleType: 'truck',
          energyType,
          tankCapacityLiters:
            energyType !== 'electric' && numericCapacity > 0
              ? numericCapacity
              : undefined,
          batteryCapacityKwh:
            energyType === 'electric' && numericCapacity > 0
              ? numericCapacity
              : undefined,
          isPrimary: true,
        },
      ],
    };
    setPassword('');
    onComplete(state);
  };

  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={styles.onboardingApp}>
        <ScrollView contentContainerStyle={styles.onboardingContent}>
          <View style={styles.onboardingBrand}>
            <View style={styles.onboardingLogo}>
              <Ionicons name="navigate" size={30} color={C.onPrimary} />
            </View>
            <Text style={styles.onboardingTitle}>RouteLO 시작하기</Text>
            <Text style={styles.onboardingSubtitle}>
              기사님의 배달 기록과 수익 분석 방식을 선택해주세요.
            </Text>
          </View>
          {mode === 'choice' ? (
            <>
              <Pressable style={styles.onboardingChoice} onPress={saveGuest}>
                <Ionicons name="phone-portrait-outline" size={25} color={C.primary} />
                <View style={styles.flex}>
                  <Text style={styles.onboardingChoiceTitle}>비회원으로 시작</Text>
                  <Text style={styles.onboardingChoiceText}>
                    가입 없이 기기 내부에 배달·주유 기록을 저장합니다.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={C.textMuted} />
              </Pressable>
              <Pressable
                style={styles.onboardingChoice}
                onPress={() => setMode('member')}
              >
                <Ionicons name="person-circle-outline" size={27} color={C.primary} />
                <View style={styles.flex}>
                  <Text style={styles.onboardingChoiceTitle}>회원으로 시작</Text>
                  <Text style={styles.onboardingChoiceText}>
                    프로필과 업무 차량을 등록하고 계정 기반 기능을 준비합니다.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={C.textMuted} />
              </Pressable>
            </>
          ) : (
            <View style={styles.onboardingForm}>
              <Text style={styles.onboardingSectionTitle}>회원 프로필</Text>
              <TextInput
                style={styles.onboardingInput}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="기사님 이름 또는 닉네임"
                placeholderTextColor="#6B7280"
              />
              <TextInput
                style={styles.onboardingInput}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="이메일"
                placeholderTextColor="#6B7280"
              />
              {!initial && (
                <TextInput
                  style={styles.onboardingInput}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder="비밀번호 8자 이상"
                  placeholderTextColor="#6B7280"
                />
              )}
              <Text style={styles.onboardingSectionTitle}>업무 차량</Text>
              <TextInput
                style={styles.onboardingInput}
                value={vehicleModel}
                onChangeText={setVehicleModel}
                placeholder="차종 예: 현대 포터2"
                placeholderTextColor="#6B7280"
              />
              <View style={styles.energyRow}>
                {(['gasoline', 'diesel', 'lpg', 'hybrid', 'electric'] as EnergyType[]).map(
                  (fuel) => (
                    <Pressable
                      key={fuel}
                      style={[
                        styles.energyChip,
                        energyType === fuel && styles.energyChipActive,
                      ]}
                      onPress={() => setEnergyType(fuel)}
                    >
                      <Text
                        style={[
                          styles.energyChipText,
                          energyType === fuel && styles.energyChipTextActive,
                        ]}
                      >
                        {fuel === 'gasoline'
                          ? '휘발유'
                          : fuel === 'diesel'
                            ? '경유'
                            : fuel === 'lpg'
                              ? 'LPG'
                              : fuel === 'hybrid'
                                ? '하이브리드'
                                : '전기'}
                      </Text>
                    </Pressable>
                  ),
                )}
              </View>
              <TextInput
                style={styles.onboardingInput}
                value={capacity}
                onChangeText={setCapacity}
                keyboardType="decimal-pad"
                placeholder={
                  energyType === 'electric'
                    ? '배터리 용량(kWh)'
                    : '연료탱크 용량(L)'
                }
                placeholderTextColor="#6B7280"
              />
              <Text style={styles.onboardingPrivacy}>
                이 정보는 기사님의 배송 수익과 차량 운영비를 더 정확하게 분석하기
                위해 사용됩니다. 필요한 정보만 기기에 저장하며 비밀번호는 이
                프로필에 저장하지 않습니다.
              </Text>
              <Pressable style={styles.scanPrimaryButton} onPress={saveMember}>
                <Text style={styles.scanPrimaryButtonText}>
                  {initial ? '프로필 저장' : '회원 정보 설정 완료'}
                </Text>
              </Pressable>
              {!initial && (
                <Pressable
                  style={styles.scanSecondaryButton}
                  onPress={() => setMode('choice')}
                >
                  <Text style={styles.scanSecondaryButtonText}>이전으로</Text>
                </Pressable>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function DeliveryDetailSheet({
  delivery,
  visible,
  completionPhotoUri,
  recentContacts,
  onClose,
  onToggle,
  onEdit,
  onDelete,
  onToggleHidden,
  onAttachPhoto,
  onRemovePhoto,
  onLogCall,
}: {
  delivery?: Delivery;
  visible: boolean;
  completionPhotoUri?: string;
  recentContacts: ContactLog[];
  onClose: () => void;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleHidden: () => void;
  onAttachPhoto: () => void;
  onRemovePhoto: () => void;
  onLogCall: (label: string, phone: string) => void;
}) {
  const { C, styles, dark } = useTheme();
  const insets = useSafeAreaInsets();
  if (!delivery) return null;
  const confirmDelete = () =>
    Alert.alert('배달 삭제', '이 배달을 삭제할까요? 되돌릴 수 없습니다.', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: onDelete },
    ]);
  const callTargets = dialableTargets([
    { label: '수령인', phone: delivery.recipientTel },
    { label: '발주처', phone: delivery.orderVendorTel },
    { label: '화원', phone: delivery.deliveryVendorTel },
  ]);
  const urgency = deadlineStatus(delivery.deliveryDt, Date.now());
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <GlassSurface
          strength="regular"
          radius={RADIUS.bottomSheet}
          dark={dark}
          colors={{ surface: C.surface, primary: C.primary, outline: C.outline }}
          style={{
            paddingHorizontal: 20,
            paddingBottom: 28 + insets.bottom,
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            borderBottomWidth: 0,
          }}
        >
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetEyebrow}>배송 상세</Text>
              <Text style={styles.sheetTitle}>{delivery.productName}</Text>
            </View>
            <Pressable style={styles.iconButton} onPress={onClose}>
              <Ionicons name="close" size={22} color={C.text} />
            </Pressable>
          </View>
          <StatusBadge status={delivery.status} />
          <View style={styles.sheetAddress}>
            <Ionicons name="location-outline" size={20} color={C.primary} />
            <Text style={styles.sheetAddressText}>{delivery.deliveryAddress}</Text>
          </View>
          <View style={styles.sheetTimeGrid}>
            <View style={styles.sheetTimeItem}>
              <Text style={styles.sheetTimeLabel}>엄수 마감</Text>
              <Text style={[styles.sheetTimeValue, styles.warningText]}>
                {timeOf(delivery.deliveryDt)}
              </Text>
              {(urgency === 'overdue' || urgency === 'soon') &&
                delivery.status !== 'completed' && (
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: '800',
                      marginTop: 3,
                      color: urgency === 'overdue' ? C.danger : C.warning,
                    }}
                  >
                    {urgency === 'overdue' ? '● 마감 지남' : '● 임박'}
                  </Text>
                )}
            </View>
            <View style={styles.sheetTimeItem}>
              <Text style={styles.sheetTimeLabel}>예식 시간</Text>
              <Text style={[styles.sheetTimeValue, isEventDelivery(delivery) && styles.dangerText]}>
                {delivery.eventTime || '-'}
              </Text>
            </View>
            <View style={styles.sheetTimeItem}>
              <Text style={styles.sheetTimeLabel}>수량</Text>
              <Text style={styles.sheetTimeValue}>{delivery.productQuantity}개</Text>
            </View>
          </View>
          <View style={styles.sheetInfoBlock}>
            <Text style={styles.sheetInfoLabel}>요청사항</Text>
            <Text style={styles.sheetInfoText}>{delivery.customerRequests}</Text>
          </View>
          {formatPhone(delivery.recipientTel) !== '' && (
            <View style={styles.sheetInfoBlock}>
              <Text style={styles.sheetInfoLabel}>수령인 연락처</Text>
              <Text style={styles.sheetInfoText}>
                {formatPhone(delivery.recipientTel)}
              </Text>
            </View>
          )}
          {callTargets.length > 0 && (
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 8,
                marginBottom: 10,
              }}
            >
              {callTargets.map((target) => (
                <Pressable
                  key={target.label}
                  onPress={() => {
                    // Log only once the dialer actually opens, so tapping on a
                    // device without telephony doesn't record a phantom call.
                    Linking.openURL(target.href)
                      .then(() =>
                        onLogCall(
                          target.label,
                          target.href.replace(/^tel:/, ''),
                        ),
                      )
                      .catch(() => undefined);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    paddingHorizontal: 12,
                    paddingVertical: 9,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: C.primary,
                  }}
                >
                  <Ionicons name="call-outline" size={16} color={C.primary} />
                  <Text
                    style={{ color: C.primary, fontWeight: '700', fontSize: 12 }}
                  >
                    {target.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          {recentContacts.length > 0 && (
            <View style={styles.sheetInfoBlock}>
              <Text style={styles.sheetInfoLabel}>최근 연락</Text>
              {recentContacts.map((contact) => (
                <View
                  key={contact.id}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingVertical: 4,
                  }}
                >
                  <Text style={{ color: C.text, fontSize: 12, fontWeight: '600' }}>
                    {contact.label} · {formatPhone(contact.phone)}
                  </Text>
                  <Text style={{ color: C.textMuted, fontSize: 11 }}>
                    {formatLocalContactTime(new Date(contact.at))}
                  </Text>
                </View>
              ))}
            </View>
          )}
          <View style={styles.sheetInfoBlock}>
            <Text style={styles.sheetInfoLabel}>완료 사진</Text>
            {completionPhotoUri ? (
              <View style={{ gap: 8 }}>
                <Image
                  source={{ uri: completionPhotoUri }}
                  style={{
                    width: '100%',
                    height: 180,
                    borderRadius: 12,
                    backgroundColor: C.surfaceAlt,
                  }}
                  resizeMode="cover"
                />
                <Pressable
                  onPress={onRemovePhoto}
                  style={({ pressed }) => [
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      paddingVertical: 10,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: C.danger,
                    },
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <Ionicons name="trash-outline" size={16} color={C.danger} />
                  <Text
                    style={{ color: C.danger, fontWeight: '700', fontSize: 12 }}
                  >
                    사진 삭제
                  </Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={onAttachPhoto}
                style={({ pressed }) => [
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    paddingVertical: 11,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: C.outline,
                  },
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Ionicons name="camera-outline" size={18} color={C.textMuted} />
                <Text
                  style={{ color: C.textMuted, fontWeight: '700', fontSize: 12 }}
                >
                  완료 사진 첨부
                </Text>
              </Pressable>
            )}
          </View>
          <View style={styles.sheetActions}>
            <Pressable style={styles.primaryButton} onPress={onToggle}>
              <Ionicons
                name={delivery.status === 'completed' ? 'refresh-outline' : 'checkmark'}
                size={18}
                color="#FFFFFF"
              />
              <Text style={styles.primaryButtonText}>
                {delivery.status === 'completed' ? '대기로 변경' : '배송 완료'}
              </Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <Pressable
              onPress={onEdit}
              style={({ pressed }) => [
                {
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: C.primary,
                },
                pressed && { opacity: 0.6 },
              ]}
            >
              <Ionicons name="create-outline" size={18} color={C.primary} />
              <Text style={{ color: C.primary, fontWeight: '600', marginLeft: 6 }}>
                수정
              </Text>
            </Pressable>
            <Pressable
              onPress={confirmDelete}
              style={({ pressed }) => [
                {
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: C.danger,
                },
                pressed && { opacity: 0.6 },
              ]}
            >
              <Ionicons name="trash-outline" size={18} color={C.danger} />
              <Text style={{ color: C.danger, fontWeight: '600', marginLeft: 6 }}>
                삭제
              </Text>
            </Pressable>
          </View>
          <Pressable
            onPress={onToggleHidden}
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 12,
                marginTop: 10,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: C.outline,
              },
              pressed && { opacity: 0.6 },
            ]}
          >
            <Ionicons
              name={delivery.hidden ? 'eye-outline' : 'eye-off-outline'}
              size={18}
              color={C.textMuted}
            />
            <Text
              style={{ color: C.textMuted, fontWeight: '600', marginLeft: 6 }}
            >
              {delivery.hidden ? '목록에 다시 표시' : '목록에서 숨기기'}
            </Text>
          </Pressable>
        </GlassSurface>
      </View>
    </Modal>
  );
}

const DELIVERY_FORM_FIELDS: Array<{
  key: keyof ManualOrderInput;
  label: string;
  placeholder: string;
  keyboardType?: 'default' | 'numeric' | 'phone-pad';
  multiline?: boolean;
}> = [
  { key: 'productName', label: '상품명 *', placeholder: '예: 축하 3단 화환' },
  { key: 'productQuantity', label: '수량', placeholder: '예: 2', keyboardType: 'numeric' },
  { key: 'deliveryAddress', label: '배송 주소', placeholder: '도로명 주소' },
  { key: 'venueName', label: '장소 / 예식장', placeholder: '예: 강남 웨딩홀' },
  { key: 'serviceDate', label: '배송 날짜', placeholder: 'YYYY-MM-DD' },
  { key: 'strictTime', label: '엄수 시간', placeholder: 'HH:mm' },
  { key: 'eventTime', label: '예식 시간', placeholder: 'HH:mm' },
  { key: 'recipientName', label: '수령인', placeholder: '이름' },
  { key: 'recipientTel', label: '수령인 연락처', placeholder: '01000000000', keyboardType: 'phone-pad' },
  { key: 'orderingVendorName', label: '발주처', placeholder: '상호' },
  { key: 'orderingVendorTel', label: '발주처 연락처', placeholder: '연락처', keyboardType: 'phone-pad' },
  { key: 'fulfillingVendorName', label: '담당 화원', placeholder: '상호' },
  { key: 'fulfillingVendorTel', label: '담당 화원 연락처', placeholder: '연락처', keyboardType: 'phone-pad' },
  { key: 'customerRequests', label: '요청사항', placeholder: '메모', multiline: true },
];

function DeliveryFormModal({
  visible,
  initial,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  initial?: DeliveryOrder;
  onClose: () => void;
  onSubmit: (order: DeliveryOrder) => void;
}) {
  const { C } = useTheme();
  const insets = useSafeAreaInsets();
  const editing = Boolean(initial);
  const toValues = (order?: DeliveryOrder): Record<string, string> => {
    const input = order ? orderToManualInput(order) : ({} as ManualOrderInput);
    const values: Record<string, string> = {};
    DELIVERY_FORM_FIELDS.forEach((field) => {
      const raw = input[field.key];
      values[field.key] = raw === undefined || raw === null ? '' : String(raw);
    });
    return values;
  };
  const [values, setValues] = useState<Record<string, string>>(() =>
    toValues(initial),
  );
  useEffect(() => {
    if (visible) setValues(toValues(initial));
  }, [visible, initial]);

  const submit = () => {
    const quantityText = values.productQuantity?.trim();
    const input: ManualOrderInput = {
      productName: values.productName ?? '',
      productQuantity: quantityText ? Number(quantityText) : undefined,
      orderingVendorName: values.orderingVendorName,
      orderingVendorTel: values.orderingVendorTel,
      fulfillingVendorName: values.fulfillingVendorName,
      fulfillingVendorTel: values.fulfillingVendorTel,
      serviceDate: values.serviceDate,
      strictTime: values.strictTime,
      eventTime: values.eventTime,
      venueName: values.venueName,
      deliveryAddress: values.deliveryAddress,
      recipientName: values.recipientName,
      recipientTel: values.recipientTel,
      customerRequests: values.customerRequests,
    };
    const errors = validateManualOrderInput(input);
    if (errors.length) {
      Alert.alert('입력 확인', errors.join('\n'));
      return;
    }
    try {
      const now = new Date().toISOString();
      const order = initial
        ? applyManualEdit(initial, input, now)
        : createManualDeliveryOrder(input, {
            id: `delivery-${Date.now()}`,
            now,
          });
      onSubmit(order);
      onClose();
    } catch (error) {
      Alert.alert(
        '저장 실패',
        error instanceof Error ? error.message : '알 수 없는 오류',
      );
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView
        style={{ flex: 1, backgroundColor: C.background }}
        edges={['left', 'right', 'bottom']}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 18,
            // Modal 안에서는 SafeAreaView 상단 인셋이 적용되지 않아 X가 노치에
            // 파묻히므로 인셋을 직접 더해 헤더를 내린다.
            paddingTop: insets.top + 14,
            paddingBottom: 14,
            borderBottomWidth: 1,
            borderBottomColor: C.outline,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '800', color: C.text }}>
            {editing ? '배달 수정' : '배달 직접 추가'}
          </Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={24} color={C.text} />
          </Pressable>
        </View>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={{ padding: 18, paddingBottom: 32 }}
            keyboardShouldPersistTaps="handled"
          >
            {DELIVERY_FORM_FIELDS.map((field) => (
              <View key={field.key} style={{ marginBottom: 14 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: C.textMuted,
                    marginBottom: 6,
                  }}
                >
                  {field.label}
                </Text>
                <TextInput
                  value={values[field.key]}
                  onChangeText={(text) =>
                    setValues((current) => ({ ...current, [field.key]: text }))
                  }
                  placeholder={field.placeholder}
                  placeholderTextColor={C.textMuted}
                  keyboardType={field.keyboardType ?? 'default'}
                  multiline={field.multiline}
                  style={{
                    backgroundColor: C.surfaceAlt,
                    borderWidth: 1,
                    borderColor: C.outline,
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    fontSize: 15,
                    color: C.text,
                    minHeight: field.multiline ? 76 : undefined,
                    textAlignVertical: field.multiline ? 'top' : 'center',
                  }}
                />
              </View>
            ))}
          </ScrollView>
        </KeyboardAvoidingView>
        <View
          style={{
            padding: 18,
            paddingBottom: 18 + insets.bottom,
            borderTopWidth: 1,
            borderTopColor: C.outline,
          }}
        >
          <Pressable
            onPress={submit}
            style={({ pressed }) => [
              {
                backgroundColor: C.primary,
                borderRadius: 14,
                paddingVertical: 15,
                alignItems: 'center',
              },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={{ color: C.onPrimary, fontSize: 15, fontWeight: '800' }}>
              {editing ? '수정 저장' : '배달 추가'}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

type ScanStage = 'capture' | 'quality' | 'processing' | 'review';

const OCR_FIELD_ICONS: Record<OcrFieldKey, keyof typeof Ionicons.glyphMap> = {
  orderingVendorName: 'storefront-outline',
  orderingVendorTel: 'call-outline',
  fulfillingVendorName: 'business-outline',
  fulfillingVendorTel: 'call-outline',
  productName: 'flower-outline',
  productQuantity: 'layers-outline',
  ribbonText: 'ribbon-outline',
  deliveryDate: 'calendar-outline',
  deliveryWindowStart: 'play-circle-outline',
  deliveryWindowEnd: 'stop-circle-outline',
  strictTime: 'alarm-outline',
  eventTime: 'time-outline',
  venueName: 'business-outline',
  deliveryAddress: 'location-outline',
  recipientName: 'person-outline',
  recipientTel: 'call-outline',
  memo: 'document-text-outline',
};

function OcrScannerModal({
  visible,
  settings,
  onClose,
  onRegister,
}: {
  visible: boolean;
  settings: RouteloSettings;
  onClose: () => void;
  onRegister: (delivery: Delivery, receiptImageUri?: string) => void;
}) {
  const { C, styles } = useTheme();
  // Modal 안에서는 SafeAreaView 컴포넌트가 상단 인셋을 적용하지 못하는 경우가 있어
  // (노치/다이나믹 아일랜드 밑으로 X가 파묻힘) 인셋을 훅으로 직접 읽어 헤더에 준다.
  const insets = useSafeAreaInsets();
  const [stage, setStage] = useState<ScanStage>('capture');
  const [imageUri, setImageUri] = useState<string>();
  const [assetInfo, setAssetInfo] = useState<{ width?: number; height?: number; fileSize?: number }>({});
  const [result, setResult] = useState<OcrPipelineResult>();
  const [fields, setFields] = useState<OcrFieldResult[]>([]);
  const [vendorCheck, setVendorCheck] = useState<VendorVerification>();

  const reset = () => {
    setStage('capture');
    setImageUri(undefined);
    setAssetInfo({});
    setResult(undefined);
    setFields([]);
    setVendorCheck(undefined);
  };

  useEffect(() => {
    if (!visible) reset();
  }, [visible]);

  const selectImage = async (camera: boolean) => {
    const permission = camera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('권한 필요', '인수증을 촬영하거나 불러오려면 사진 접근 권한이 필요합니다.');
      return;
    }
    const picked = camera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 1,
          allowsEditing: false,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 1,
          allowsEditing: false,
        });
    if (picked.canceled) return;
    const asset = picked.assets[0];
    const info = { width: asset.width, height: asset.height, fileSize: asset.fileSize };
    setImageUri(asset.uri);
    setAssetInfo(info);
    setResult({
      engine: 'fixture',
      rawText: '',
      fields: [],
      documentConfidence: 0,
      quality: inspectCaptureQuality(info),
      processingMs: 0,
      variantsCompared: 0,
      unmapped: [],
      conflicts: [],
      cloudFallback: { trigger: false, reasons: [] },
      eventType: { type: '기타', confidence: 0 },
    });
    setStage('quality');
  };

  const analyze = async () => {
    if (result && !result.quality.passed) {
      Alert.alert('재촬영 권장', result.quality.messages[0] || '촬영 품질을 확인해주세요.');
      return;
    }
    setStage('processing');
    setVendorCheck(undefined);
    try {
      const next = await runReceiptOcr({ ...assetInfo, uri: imageUri });
      setResult(next);
      setFields(next.fields);
      setStage('review');
      // 발주처 온라인 교차검증(옵트인). 업체명만 안전 검증해 provenance로 부착, 자동 입력 없음.
      const vendorName =
        next.fields.find((f) => f.key === 'orderingVendorName')?.value || '';
      const vendorTel =
        next.fields.find((f) => f.key === 'orderingVendorTel')?.value || '';
      if (vendorName) {
        verifyVendor(vendorDirectoryFor(settings), vendorName, {
          ocrPhone: vendorTel,
        })
          .then((verification) =>
            verification.status === 'skipped' ? undefined : setVendorCheck(verification),
          )
          .catch(() => undefined);
      }
    } catch (error) {
      setResult(undefined);
      setFields([]);
      setStage('quality');
      Alert.alert(
        'OCR 인식 준비 중',
        error instanceof OcrRecognizerUnavailableError || error instanceof OcrNoTextDetectedError
          ? error.message
          : '인수증을 분석하지 못했습니다. 다시 촬영해 주세요.',
      );
    }
  };

  const updateField = (key: OcrFieldKey, value: string) => {
    setFields((current) =>
      current.map((item) =>
        item.key === key
          ? {
              ...item,
              value,
              rawValue: item.rawValue || item.value,
              confidence: value ? Math.max(item.confidence, 85) : 0,
              status: value ? 'confirmed' : 'missing',
              extractionMethod: 'manual',
              validationErrors: [],
            }
          : item,
      ),
    );
  };

  const applyVendorCandidate = (candidate: VendorCandidate) => {
    vendorCandidateApplications(candidate).forEach((application) =>
      updateField(application.key, application.value),
    );
  };

  const valueOf = (key: OcrFieldKey) => fields.find((item) => item.key === key)?.value || '';

  const register = () => {
    if (!result?.rawText.trim() || fields.length === 0) {
      Alert.alert(
        '등록할 수 없음',
        '실제 인수증에서 인식되고 검수된 정보가 없습니다. 거짓 정보 생성을 막기 위해 등록을 중단했습니다.',
      );
      return;
    }
    const missing = fields.filter((field) => field.required && !field.value.trim());
    if (missing.length) {
      Alert.alert(
        '필수값 확인',
        `${missing.map((field) => field.label).join(', ')} 항목을 입력해주세요.`,
      );
      return;
    }
    const strictTime = valueOf('strictTime');
    const eventTime = valueOf('eventTime');
    const address = valueOf('deliveryAddress');
    const quantity = Number(valueOf('productQuantity'));
    const delivery: Delivery = {
      id: `delivery-${Date.now()}`,
      orderVendor: valueOf('orderingVendorName'),
      orderVendorTel: valueOf('orderingVendorTel'),
      deliveryVendor: valueOf('fulfillingVendorName'),
      deliveryVendorTel: valueOf('fulfillingVendorTel'),
      productName: valueOf('productName'),
      productQuantity:
        Number.isInteger(quantity) && quantity > 0 ? quantity : 0,
      eventTime,
      deliveryDt: [valueOf('deliveryDate'), strictTime].filter(Boolean).join(' '),
      deliveryAddress: address,
      customerRequests: valueOf('memo'),
      recipientTel: valueOf('recipientTel'),
      status: 'pending',
      distanceKm: 0,
      fee: 0,
      latitude: 0,
      longitude: 0,
    };
    onRegister(delivery, imageUri);
    // 품질 리포트(옵트인): OCR 원본↔사용자 확정 교정쌍을 익명·비식별로 수집.
    if (result) {
      recordScanReview(result, fields, {
        enabled: !!settings.telemetry?.enabled,
      }).catch(() => undefined);
    }
    Alert.alert('등록 완료', '검수된 OCR 정보가 오늘의 배달 목록에 추가되었습니다.');
    onClose();
  };

  const quality = result?.quality;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.scannerApp} edges={['left', 'right', 'bottom']}>
        <StatusBar barStyle="dark-content" />
        <View style={[styles.scannerHeader, { paddingTop: insets.top + 12 }]}>
          <Pressable style={styles.iconButton} onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={22} color={C.text} />
          </Pressable>
          <View style={styles.scannerHeaderCopy}>
            <Text style={styles.scannerEyebrow}>SMART DOCUMENT OCR</Text>
            <Text style={styles.scannerTitle}>
              {stage === 'capture'
                ? '인수증 스캔'
                : stage === 'quality'
                  ? '촬영 품질 검사'
                  : stage === 'processing'
                    ? '문서 분석 중'
                    : '추출 결과 확인'}
            </Text>
          </View>
          <View style={styles.scannerStep}>
            <Text style={styles.scannerStepText}>
              {stage === 'capture' ? '1/4' : stage === 'quality' ? '2/4' : stage === 'processing' ? '3/4' : '4/4'}
            </Text>
          </View>
        </View>

        {stage === 'capture' && (
          <ScrollView contentContainerStyle={styles.scannerContent}>
            <View style={styles.captureGuide}>
              <View style={[styles.captureCorner, styles.captureCornerTopLeft]} />
              <View style={[styles.captureCorner, styles.captureCornerTopRight]} />
              <View style={[styles.captureCorner, styles.captureCornerBottomLeft]} />
              <View style={[styles.captureCorner, styles.captureCornerBottomRight]} />
              <View style={styles.documentPreview}>
                <Ionicons name="document-text-outline" size={55} color="#89A7E8" />
                <Text style={styles.documentPreviewTitle}>인수증 전체를 프레임에 맞춰주세요</Text>
                <Text style={styles.documentPreviewCaption}>
                  흔들림·밝기·기울기·문서 잘림을 촬영 직후 자동 검사합니다.
                </Text>
              </View>
              <View style={styles.autoCaptureBadge}>
                <View style={styles.autoCaptureDot} />
                <Text style={styles.autoCaptureText}>자동 촬영 조건 확인 중</Text>
              </View>
            </View>
            <View style={styles.captureTips}>
              <View style={styles.captureTip}>
                <Ionicons name="sunny-outline" size={20} color={C.primary} />
                <Text style={styles.captureTipText}>밝은 곳</Text>
              </View>
              <View style={styles.captureTip}>
                <Ionicons name="scan-outline" size={20} color={C.primary} />
                <Text style={styles.captureTipText}>문서 전체</Text>
              </View>
              <View style={styles.captureTip}>
                <Ionicons name="phone-portrait-outline" size={20} color={C.primary} />
                <Text style={styles.captureTipText}>수직 촬영</Text>
              </View>
            </View>
            <Pressable style={styles.scanPrimaryButton} onPress={() => selectImage(true)}>
              <Ionicons name="camera" size={21} color={C.onPrimary} />
              <Text style={styles.scanPrimaryButtonText}>카메라로 촬영</Text>
            </Pressable>
            <Pressable style={styles.scanSecondaryButton} onPress={() => selectImage(false)}>
              <Ionicons name="images-outline" size={20} color={C.primary} />
              <Text style={styles.scanSecondaryButtonText}>갤러리에서 선택</Text>
            </Pressable>
          </ScrollView>
        )}

        {stage === 'quality' && quality && (
          <ScrollView contentContainerStyle={styles.scannerContent}>
            <View style={styles.qualityPreview}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.qualityImage} />
              ) : (
                <View style={styles.qualityDemoImage}>
                  <Ionicons name="receipt-outline" size={52} color={C.primary} />
                  <Text style={styles.qualityDemoText}>샘플 배송 인수증</Text>
                </View>
              )}
              <View style={styles.documentBoundary} />
              <View style={[styles.qualityScoreCircle, { borderColor: quality.passed ? C.success : C.warning }]}>
                <Text style={[styles.qualityScore, { color: quality.passed ? C.success : C.warning }]}>
                  {quality.score}
                </Text>
                <Text style={styles.qualityScoreLabel}>품질</Text>
              </View>
            </View>
            <View style={styles.qualityCard}>
              <View style={styles.qualityCardHeader}>
                <Text style={styles.qualityCardTitle}>촬영 품질 분석</Text>
                <View style={[styles.badge, quality.passed ? styles.successBadge : styles.waitBadge]}>
                  <Text style={[styles.badgeText, { color: quality.passed ? C.success : C.warning }]}>
                    {quality.passed ? 'OCR 진행 가능' : '재촬영 권장'}
                  </Text>
                </View>
              </View>
              <QualityMeter label="선명도" value={quality.blur} icon="aperture-outline" />
              <QualityMeter label="밝기" value={quality.brightness} icon="sunny-outline" />
              <QualityMeter label="문서 영역" value={quality.documentCoverage} icon="scan-outline" />
              <QualityMeter label="기울기" value={quality.skew} icon="move-outline" />
              <QualityMeter label="그림자" value={quality.shadow} icon="contrast-outline" />
            </View>
            {quality.messages.map((message) => (
              <View key={message} style={styles.qualityWarning}>
                <Ionicons name="warning-outline" size={18} color={C.warning} />
                <Text style={styles.qualityWarningText}>{message}</Text>
              </View>
            ))}
            <View style={styles.variantInfo}>
              <Ionicons name="layers-outline" size={20} color={C.primary} />
              <Text style={styles.variantInfoText}>
                원본·밝기·대비·기울기·임계값·샤프닝 6개 버전을 비교합니다.
              </Text>
            </View>
            <View style={styles.scanActionRow}>
              <Pressable style={styles.scanSecondaryFlex} onPress={reset}>
                <Text style={styles.scanSecondaryButtonText}>다시 촬영</Text>
              </Pressable>
              <Pressable style={styles.scanPrimaryFlex} onPress={analyze}>
                <Text style={styles.scanPrimaryButtonText}>OCR 분석 시작</Text>
                <Ionicons name="arrow-forward" size={18} color={C.onPrimary} />
              </Pressable>
            </View>
          </ScrollView>
        )}

        {stage === 'processing' && (
          <View style={styles.processingScreen}>
            <View style={styles.processingIcon}>
              <ActivityIndicator size="large" color={C.primary} />
            </View>
            <Text style={styles.processingTitle}>인수증을 정밀 분석하고 있습니다</Text>
            <Text style={styles.processingCaption}>
              문서 보정, 6개 이미지 비교, 한국어 OCR, 필드 후보 검증을 수행합니다.
            </Text>
            {['문서 영역 및 원근 보정', '1차 모바일 OCR', '시간·주소·연락처 후보 분석', '필드별 신뢰도 계산'].map(
              (item, index) => (
                <View key={item} style={styles.processingStep}>
                  <View style={[styles.processingStepIcon, index < 2 && styles.processingStepIconActive]}>
                    <Ionicons
                      name={index < 2 ? 'checkmark' : 'ellipsis-horizontal'}
                      size={15}
                      color={index < 2 ? '#FFFFFF' : C.textMuted}
                    />
                  </View>
                  <Text style={styles.processingStepText}>{item}</Text>
                </View>
              ),
            )}
          </View>
        )}

        {stage === 'review' && result && (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
            <ScrollView contentContainerStyle={styles.reviewContent} keyboardShouldPersistTaps="handled">
              <View style={styles.ocrSummaryCard}>
                <View>
                  <Text style={styles.ocrSummaryLabel}>문서 전체 신뢰도</Text>
                  <Text style={styles.ocrSummaryValue}>{result.documentConfidence}%</Text>
                </View>
                <View style={styles.ocrSummaryMeta}>
                  <Text style={styles.ocrSummaryMetaText}>
                    {result.engine === 'ppocrv5'
                      ? `PP-OCRv5 온디바이스 OCR${result.modelVersion ? ` · ${result.modelVersion}` : ''}`
                      : '명시적 테스트 샘플'}
                  </Text>
                  <Text style={styles.ocrSummaryMetaText}>
                    {result.variantsCompared}개 전처리 비교 · {result.processingMs}ms
                  </Text>
                </View>
              </View>
              <View style={styles.reviewGuide}>
                <Ionicons name="information-circle-outline" size={19} color={C.primary} />
                <Text style={styles.reviewGuideText}>
                  노란색과 빨간색 항목을 확인하세요. 수정한 값은 다음 인식 개선 데이터로 저장할 수 있습니다.
                </Text>
              </View>
              {fields.map((field) => (
                <View
                  key={field.key}
                  style={[
                    styles.ocrFieldCard,
                    field.status === 'warning' || field.status === 'missing'
                      ? styles.ocrFieldCardWarning
                      : undefined,
                  ]}
                >
                  <View style={styles.ocrFieldHeader}>
                    <View style={styles.ocrFieldTitleGroup}>
                      <View style={styles.ocrFieldIcon}>
                        <Ionicons name={OCR_FIELD_ICONS[field.key]} size={19} color={C.primary} />
                      </View>
                      <View>
                        <Text style={styles.ocrFieldLabel}>
                          {field.label}
                          {field.required ? ' *' : ''}
                        </Text>
                        <Text style={styles.ocrFieldSource} numberOfLines={1}>
                          원문: {field.sourceText || '인식된 원문 없음'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.ocrBadgeRow}>
                      {field.phoneKind && (
                        <PhoneKindBadge kind={field.phoneKind} />
                      )}
                      <ConfidenceBadge field={field} />
                    </View>
                  </View>
                  <TextInput
                    value={field.value}
                    onChangeText={(value) => updateField(field.key, value)}
                    placeholder={`${field.label} 입력`}
                    placeholderTextColor="#9AA5B7"
                    multiline={field.key === 'memo' || field.key === 'deliveryAddress'}
                    style={[
                      styles.ocrFieldInput,
                      (field.key === 'memo' || field.key === 'deliveryAddress') && styles.ocrFieldInputMultiline,
                    ]}
                  />
                  {field.alternatives.length > 1 && (
                    <View style={styles.candidateRow}>
                      <Text style={styles.candidateLabel}>다른 후보</Text>
                      {field.alternatives.slice(0, 2).map((candidate) => (
                        <Pressable
                          key={candidate}
                          style={styles.candidateChip}
                          onPress={() => updateField(field.key, candidate)}
                        >
                          <Text style={styles.candidateChipText}>{candidate}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                  {field.key === 'orderingVendorName' && vendorCheck && (
                    <>
                    <View style={styles.vendorCheckRow}>
                      <Ionicons
                        name={
                          vendorCheck.status === 'confirmed'
                            ? 'checkmark-circle'
                            : vendorCheck.status === 'ambiguous'
                              ? 'help-circle'
                              : 'close-circle'
                        }
                        size={15}
                        color={
                          vendorCheck.status === 'confirmed'
                            ? C.success
                            : vendorCheck.status === 'ambiguous'
                              ? C.warning
                              : C.textMuted
                        }
                      />
                      <Text style={styles.vendorCheckText} numberOfLines={2}>
                        {vendorCheck.status === 'confirmed'
                          ? `온라인 확인됨: ${vendorCheck.best?.name ?? ''}${
                              vendorCheck.best?.phone
                                ? ` · ${vendorCheck.best.phone}`
                                : ''
                            }`
                          : vendorCheck.status === 'ambiguous'
                            ? `유사 업체 ${vendorCheck.candidates.length}곳 — 아래에서 선택`
                            : '온라인에서 일치하는 업체를 찾지 못했습니다'}
                      </Text>
                    </View>
                    {vendorCheck.candidates.length > 0 &&
                      vendorCheck.status !== 'notFound' && (
                        <View
                          style={{
                            flexDirection: 'row',
                            flexWrap: 'wrap',
                            gap: 6,
                            marginTop: 6,
                          }}
                        >
                          {vendorCheck.candidates.map((cand, idx) => (
                            <Pressable
                              key={`${cand.name}-${idx}`}
                              style={styles.candidateChip}
                              onPress={() => applyVendorCandidate(cand)}
                            >
                              <Text style={styles.candidateChipText}>
                                {cand.name}
                                {cand.phone ? ` · ${cand.phone}` : ''}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      )}
                    </>
                  )}
                </View>
              ))}
              <View style={styles.privacyNotice}>
                <Ionicons name="shield-checkmark-outline" size={20} color={C.success} />
                <Text style={styles.privacyNoticeText}>
                  사용자 수정 이력은 전화번호·주소를 익명화한 뒤 양식 개선 정보로만 저장합니다.
                </Text>
              </View>
              <Pressable style={styles.scanPrimaryButton} onPress={register}>
                <Ionicons name="checkmark-circle-outline" size={20} color={C.onPrimary} />
                <Text style={styles.scanPrimaryButtonText}>검수 완료 · 배달 목록에 등록</Text>
              </Pressable>
              <Pressable style={styles.scanSecondaryButton} onPress={reset}>
                <Text style={styles.scanSecondaryButtonText}>다른 인수증 촬영</Text>
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

export default function RouteloApp() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const reduceMotion = useReduceMotion();
  const navRipples = useRef(tabs.map(() => new Animated.Value(0))).current;
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const deliveries = useMemo(
    () => orders.map(orderToLegacyDelivery),
    [orders],
  );
  // 숨김 처리된 배달은 홈·목록·동선에서 제외(데이터는 보존). 캘린더는 orders 전체를 받는다.
  const activeDeliveries = useMemo(
    () => deliveries.filter((item) => !item.hidden),
    [deliveries],
  );
  const hiddenDeliveries = useMemo(
    () => deliveries.filter((item) => item.hidden),
    [deliveries],
  );
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery>();
  const [scannerVisible, setScannerVisible] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [formOrder, setFormOrder] = useState<DeliveryOrder | undefined>(
    undefined,
  );
  const [account, setAccount] = useState<AccountState>();
  const [onboardingVisible, setOnboardingVisible] = useState(false);
  const [settings, setSettings] = useState<RouteloSettings>(
    DEFAULT_ROUTELO_SETTINGS,
  );
  // 품질 리포트(옵트인): 앱이 포그라운드로 돌아올 때 밀린 리포트를 전송 시도.
  useEffect(() => {
    if (!settings.telemetry?.enabled) return;
    flushTelemetry({ enabled: true }).catch(() => undefined);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        flushTelemetry({ enabled: true }).catch(() => undefined);
      }
    });
    return () => sub.remove();
  }, [settings.telemetry?.enabled]);
  // 무료 티어는 하루 스캔 한도를 넘으면 스캐너 대신 업그레이드 안내를 띄운다.
  const openScanner = () => {
    if (resolvePlan(settings.entitlement) === 'pro') {
      setScannerVisible(true);
      return;
    }
    getTodayScanCount(AsyncStorage, new Date())
      .then((used) => {
        if (used >= FREE_DAILY_SCAN_LIMIT) {
          Alert.alert(
            '무료 스캔 소진',
            `무료 요금제는 하루 ${FREE_DAILY_SCAN_LIMIT}건까지 스캔할 수 있어요. Pro로 올리면 무제한입니다.`,
            [{ text: '확인' }],
          );
        } else {
          setScannerVisible(true);
        }
      })
      .catch(() => setScannerVisible(true));
  };
  // Pro 기능: 배달 기록을 CSV로 내보내 공유(엑셀/한글 호환 BOM). 본인 데이터 export.
  // 다중 차량 관리(Pro)에서만 등록 차량 칩을 노출한다. 무료는 빈 목록 →
  // 기존처럼 기본 차량/자유 입력으로 동작.
  const fleetRegistry =
    resolvePlan(settings.entitlement) === 'pro'
      ? dedupeVehicles(settings.costs.vehicleRegistry ?? [])
      : [];

  const exportDeliveriesCsv = async () => {
    const headers = [
      '배송일',
      '상품',
      '수량',
      '배송지',
      '발주처',
      '수령인 연락처',
      '예식시간',
      '금액(원)',
      '상태',
    ];
    const rows = orders.map((o) => {
      const d = orderToLegacyDelivery(o);
      return [
        d.deliveryDt,
        d.productName,
        d.productQuantity,
        d.deliveryAddress,
        d.orderVendor,
        d.recipientTel,
        d.eventTime,
        d.fee,
        d.status === 'completed' ? '완료' : '대기',
      ];
    });
    try {
      const dir = `${FileSystem.documentDirectory ?? ''}exports/`;
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(
        () => undefined,
      );
      const uri = `${dir}routelo-deliveries.csv`;
      await FileSystem.writeAsStringAsync(uri, toCsv(headers, rows, { bom: true }));
      await Share.share({ url: uri });
    } catch {
      Alert.alert('내보내기 실패', '파일을 만드는 중 문제가 발생했습니다.');
    }
  };
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [fuelFormVisible, setFuelFormVisible] = useState(false);
  const [fuelFormLog, setFuelFormLog] = useState<FuelLog | undefined>(undefined);
  const [mileageLogs, setMileageLogs] = useState<MileageLog[]>([]);
  const [mileageFormVisible, setMileageFormVisible] = useState(false);
  const [mileageFormLog, setMileageFormLog] = useState<MileageLog | undefined>(
    undefined,
  );
  const [contactLogs, setContactLogs] = useState<ContactLog[]>([]);

  useEffect(() => {
    deliveryRepository
      .initialize()
      .then(async () => {
        const stored = await deliveryRepository.list();
        if (stored.length) setOrders(stored);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    accountRepository
      .get()
      .then((stored) => {
        if (stored) setAccount(stored);
        else setOnboardingVisible(true);
      })
      .catch(() => setOnboardingVisible(true));
  }, []);

  useEffect(() => {
    settingsRepository
      .get()
      .then(setSettings)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    fuelLogRepository
      .list()
      .then((stored) => {
        if (stored.length) setFuelLogs(stored);
      })
      .catch(() => undefined);
  }, []);

  const openCreateFuel = () => {
    setFuelFormLog(undefined);
    setFuelFormVisible(true);
  };
  const editFuel = (log: FuelLog) => {
    setFuelFormLog(log);
    setFuelFormVisible(true);
  };
  const submitFuel = (log: FuelLog) => {
    setFuelLogs((current) =>
      current.some((item) => item.id === log.id)
        ? current.map((item) => (item.id === log.id ? log : item))
        : [log, ...current],
    );
    fuelLogRepository.save(log).catch(() => undefined);
    setFuelFormVisible(false);
  };
  const deleteFuel = (id: string) => {
    setFuelLogs((current) => current.filter((item) => item.id !== id));
    fuelLogRepository.remove(id).catch(() => undefined);
  };

  useEffect(() => {
    mileageLogRepository
      .list()
      .then((stored) => {
        if (stored.length) setMileageLogs(stored);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    contactLogRepository
      .list()
      .then((stored) => {
        if (!stored.length) return;
        // Merge, don't clobber: a call could be logged optimistically before
        // this async read resolves.
        setContactLogs((current) => {
          if (!current.length) return stored;
          const seen = new Set(current.map((log) => log.id));
          return [...current, ...stored.filter((log) => !seen.has(log.id))];
        });
      })
      .catch(() => undefined);
  }, []);

  // Keep OS-scheduled deadline/event reminders in sync with deliveries + setting.
  useEffect(() => {
    const n = settings.notifications;
    if (!n.strictDeadlineEnabled && !n.eventTimeEnabled) {
      cancelAllScheduledNotifications().catch(() => undefined);
      return;
    }
    const lead = n.strictDeadlineLeadMinutes?.[0] ?? 30;
    const plan = planDeliveryNotifications(orders, {
      nowMs: Date.now(),
      leadMinutes: lead,
    }).filter((item) =>
      item.kind === 'deadline' ? n.strictDeadlineEnabled : n.eventTimeEnabled,
    );
    syncScheduledNotifications(plan, settings.notifications).catch(
      () => undefined,
    );
  }, [orders, settings.notifications]);

  const openCreateMileage = () => {
    setMileageFormLog(undefined);
    setMileageFormVisible(true);
  };
  const editMileage = (log: MileageLog) => {
    setMileageFormLog(log);
    setMileageFormVisible(true);
  };
  const submitMileage = (log: MileageLog) => {
    setMileageLogs((current) =>
      current.some((item) => item.id === log.id)
        ? current.map((item) => (item.id === log.id ? log : item))
        : [log, ...current],
    );
    mileageLogRepository.save(log).catch(() => undefined);
    setMileageFormVisible(false);
  };
  const deleteMileage = (id: string) => {
    setMileageLogs((current) => current.filter((item) => item.id !== id));
    mileageLogRepository.remove(id).catch(() => undefined);
  };

  // Restore from a pasted JSON backup. Validation lives in the pure
  // `parseBackup`; here we only confirm the destructive overwrite, persist via
  // the repositories, and mirror the result into in-memory state.
  const importBackup = (json: string) => {
    const result = parseBackup(json);
    if (!result.ok) {
      Alert.alert('복원 실패', result.error);
      return;
    }
    const { backup } = result;
    Alert.alert(
      '백업 복원',
      `현재 데이터를 이 백업으로 덮어씁니다.\n배달 ${backup.orders.length} · 주유 ${backup.fuelLogs.length} · 주행 ${backup.mileageLogs.length} · 연락 ${backup.contactLogs.length}\n\n계속할까요?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '덮어쓰기',
          style: 'destructive',
          onPress: () => {
            applyBackup(backup, {
              saveOrders: (o) => deliveryRepository.saveAll(o),
              replaceFuelLogs: (f) => fuelLogRepository.replaceAll(f),
              replaceMileageLogs: (m) => mileageLogRepository.replaceAll(m),
              replaceContactLogs: (c) => contactLogRepository.replaceAll(c),
              saveSettings: (s) => settingsRepository.save(s),
            })
              .then(() => {
                setOrders(backup.orders);
                setFuelLogs(backup.fuelLogs);
                setMileageLogs(backup.mileageLogs);
                setContactLogs(backup.contactLogs);
                // Mirror the normalized form that was actually persisted, so
                // in-memory settings can't diverge from disk (or crash on a
                // partial settings object).
                setSettings(mergeSettingsV2(backup.settings));
                Alert.alert('복원 완료', '백업 데이터로 복원했습니다.');
              })
              .catch(() => {
                Alert.alert('복원 실패', '저장 중 오류가 발생했습니다.');
                // A restore is not atomic across collections; if a write fails
                // midway, re-read every store so the UI reflects what actually
                // landed on disk instead of stale pre-restore state.
                Promise.all([
                  deliveryRepository.list(),
                  fuelLogRepository.list(),
                  mileageLogRepository.list(),
                  contactLogRepository.list(),
                  settingsRepository.get(),
                ])
                  .then(([o, f, m, c, s]) => {
                    setOrders(o);
                    setFuelLogs(f);
                    setMileageLogs(m);
                    setContactLogs(c);
                    setSettings(s);
                  })
                  .catch(() => undefined);
              });
          },
        },
      ],
    );
  };

  const notificationCount = 3;
  const openNotifications = () => setActiveTab('notifications');
  const toggleSelected = async () => {
    if (!selectedDelivery) return;
    const currentOrder = orders.find(
      (item) => item.id === selectedDelivery.id,
    );
    if (!currentOrder) return;
    const completed = currentOrder.status !== 'completed';
    const nextOrder: DeliveryOrder = {
      ...currentOrder,
      status: completed ? 'completed' : 'pending',
      schedule: {
        ...currentOrder.schedule,
        completedAt: completed ? new Date().toISOString() : undefined,
      },
      updatedAt: new Date().toISOString(),
    };
    setOrders((current) =>
      current.map((item) => (item.id === nextOrder.id ? nextOrder : item)),
    );
    await deliveryRepository.save(nextOrder);
    setSelectedDelivery((current) =>
      current
        ? {
            ...current,
            status: current.status === 'completed' ? 'pending' : 'completed',
          }
        : current,
    );
  };

  const deleteSelected = async () => {
    if (!selectedDelivery) return;
    const { id } = selectedDelivery;
    setOrders((current) => current.filter((item) => item.id !== id));
    setSelectedDelivery(undefined);
    await deliveryRepository.remove(id).catch(() => undefined);
  };

  // 리스트에서 왼쪽 스와이프로 삭제. 실수 방지를 위해 확인 다이얼로그를 먼저 띄운다.
  const deleteDeliveryById = async (id: string) => {
    setOrders((current) => current.filter((item) => item.id !== id));
    setSelectedDelivery((current) => (current?.id === id ? undefined : current));
    await deliveryRepository.remove(id).catch(() => undefined);
  };

  const confirmDeleteDelivery = (delivery: Delivery) => {
    Alert.alert('배송건 삭제', '정말 해당 배송건을 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          deleteDeliveryById(delivery.id);
        },
      },
    ]);
  };

  // 숨김 토글: 데이터는 보존하되 목록에서 감춘다(완료 배송 치우기). 다시 눌러 복원 가능.
  const toggleHiddenById = async (id: string) => {
    const currentOrder = orders.find((item) => item.id === id);
    if (!currentOrder) return;
    const nextOrder: DeliveryOrder = {
      ...currentOrder,
      hidden: !currentOrder.hidden,
      updatedAt: new Date().toISOString(),
    };
    setOrders((current) =>
      current.map((item) => (item.id === nextOrder.id ? nextOrder : item)),
    );
    setSelectedDelivery(undefined);
    await deliveryRepository.save(nextOrder).catch(() => undefined);
  };

  const persistOrder = (next: DeliveryOrder) => {
    setOrders((current) =>
      current.map((item) => (item.id === next.id ? next : item)),
    );
    deliveryRepository.save(next).catch(() => undefined);
  };

  const captureCompletionPhoto = async (
    order: DeliveryOrder,
    source: 'camera' | 'library',
  ) => {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        '권한 필요',
        '사진을 첨부하려면 카메라/사진 접근 권한이 필요합니다.',
      );
      return;
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 0.6,
      allowsEditing: true,
    };
    const picked =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    if (picked.canceled || !picked.assets?.[0]) return;
    const asset = picked.assets[0];
    const docDir = FileSystem.documentDirectory ?? '';
    // Fresh token per attach → new file name → new URI, so RN's Image cache
    // can't show the previous photo after a re-attach.
    const relativePath = completionPhotoRelativePath(order.id, String(Date.now()));
    const dest = resolveCompletionPhotoUri(docDir, relativePath);
    try {
      await FileSystem.makeDirectoryAsync(completionPhotoDir(docDir), {
        intermediates: true,
      }).catch(() => undefined);
      // Drop the previous proof file (different name now) to avoid leaks.
      if (order.completionPhotoPath) {
        await FileSystem.deleteAsync(
          resolveCompletionPhotoUri(docDir, order.completionPhotoPath),
          { idempotent: true },
        ).catch(() => undefined);
      }
      await FileSystem.copyAsync({ from: asset.uri, to: dest });
    } catch {
      Alert.alert('첨부 실패', '사진을 저장하지 못했습니다.');
      return;
    }
    persistOrder({
      ...attachCompletionPhoto(order, relativePath),
      updatedAt: new Date().toISOString(),
    });
  };

  // OCR 등록 직후 인수증 원본을 안정 경로로 복사하고 order에 경로를 저장한다.
  const persistReceiptImage = async (
    order: DeliveryOrder,
    sourceUri: string,
  ) => {
    const docDir = FileSystem.documentDirectory ?? '';
    const relativePath = receiptPhotoRelativePath(order.id, String(Date.now()));
    const dest = resolveReceiptPhotoUri(docDir, relativePath);
    try {
      await FileSystem.makeDirectoryAsync(receiptPhotoDir(docDir), {
        intermediates: true,
      }).catch(() => undefined);
      await FileSystem.copyAsync({ from: sourceUri, to: dest });
    } catch {
      return; // 사진 보존 실패는 배달 등록을 막지 않는다(부가 기능).
    }
    persistOrder({
      ...attachReceiptPhoto(order, relativePath),
      updatedAt: new Date().toISOString(),
    });
  };

  const startCompletionPhoto = () => {
    if (!selectedDelivery) return;
    const order = orders.find((item) => item.id === selectedDelivery.id);
    if (!order) return;
    Alert.alert('완료 사진', '사진을 추가할 방법을 선택하세요.', [
      { text: '카메라', onPress: () => captureCompletionPhoto(order, 'camera') },
      {
        text: '앨범에서 선택',
        onPress: () => captureCompletionPhoto(order, 'library'),
      },
      { text: '취소', style: 'cancel' },
    ]);
  };

  const removeCompletionPhoto = () => {
    if (!selectedDelivery) return;
    const order = orders.find((item) => item.id === selectedDelivery.id);
    if (!order) return;
    if (order.completionPhotoPath) {
      FileSystem.deleteAsync(
        resolveCompletionPhotoUri(
          FileSystem.documentDirectory ?? '',
          order.completionPhotoPath,
        ),
        { idempotent: true },
      ).catch(() => undefined);
    }
    persistOrder({
      ...clearCompletionPhoto(order),
      updatedAt: new Date().toISOString(),
    });
  };

  const logCall = (label: string, phone: string) => {
    if (!selectedDelivery) return;
    const log = buildContactLog({
      id: `c-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      deliveryId: selectedDelivery.id,
      label,
      phone,
      at: new Date().toISOString(),
    });
    setContactLogs((current) => [log, ...current]);
    contactLogRepository.save(log).catch(() => undefined);
  };

  const openCreateForm = () => {
    setFormOrder(undefined);
    setFormVisible(true);
  };

  const editSelected = () => {
    if (!selectedDelivery) return;
    const order = orders.find((item) => item.id === selectedDelivery.id);
    if (!order) return;
    setSelectedDelivery(undefined);
    setFormOrder(order);
    setFormVisible(true);
  };

  const submitManualOrder = (order: DeliveryOrder) => {
    const address = order.destination.address || '';
    const fee = calculateFeeByAddress(address, settings);
    const district = findDistrictByAddress(address, settings);
    const enriched: DeliveryOrder = {
      ...order,
      settlement: { ...order.settlement, fee, district },
    };
    setOrders((current) =>
      current.some((item) => item.id === enriched.id)
        ? current.map((item) => (item.id === enriched.id ? enriched : item))
        : [enriched, ...current],
    );
    deliveryRepository.save(enriched).catch(() => undefined);
    setFormVisible(false);
    setActiveTab('deliveries');
  };

  const screen = useMemo(() => {
    if (activeTab === 'deliveries') {
      return (
        <DeliveryListScreen
          deliveries={activeDeliveries}
          hiddenDeliveries={hiddenDeliveries}
          onDeliveryPress={setSelectedDelivery}
          onUnhide={toggleHiddenById}
          onDeleteDelivery={confirmDeleteDelivery}
          onNotifications={openNotifications}
        />
      );
    }
    if (activeTab === 'calendar') {
      return (
        <CalendarScreen
          orders={orders}
          fuelLogs={fuelLogs}
          mileageLogs={mileageLogs}
          contactLogs={contactLogs}
          settings={settings}
          onDeliveryPress={setSelectedDelivery}
          onNotifications={openNotifications}
          onAddFuel={openCreateFuel}
          onEditFuel={editFuel}
          onDeleteFuel={deleteFuel}
          onAddMileage={openCreateMileage}
          onEditMileage={editMileage}
          onDeleteMileage={deleteMileage}
          onImportBackup={importBackup}
        />
      );
    }
    if (activeTab === 'route') {
      return (
        <RouteScreen
          deliveries={activeDeliveries}
          navApp={settings.route.navApp}
          allowReorder={settings.route.allowManualReorder}
          startAddress={settings.route.startAddress}
          endAddress={settings.route.endAddress}
          onSetLocations={(startAddress, endAddress) => {
            const nextSettings = {
              ...settings,
              route: { ...settings.route, startAddress, endAddress },
            };
            setSettings(nextSettings);
            settingsRepository.save(nextSettings).catch(() => undefined);
          }}
          onDeliveryPress={setSelectedDelivery}
          onDeleteDelivery={confirmDeleteDelivery}
          onNotifications={openNotifications}
        />
      );
    }
    if (activeTab === 'notifications') return <NotificationsScreen />;
    if (activeTab === 'settings') {
      return (
        <SettingsScreen
          account={account}
          settings={settings}
          onSettingsChange={setSettings}
          onEditAccount={() => setOnboardingVisible(true)}
          onExportCsv={exportDeliveriesCsv}
        />
      );
    }
    return (
      <HomeScreen
        deliveries={activeDeliveries}
        greetingName={driverGreetingName(account)}
        onDeliveryPress={setSelectedDelivery}
        onSeeAll={() => setActiveTab('deliveries')}
        onNotifications={openNotifications}
      />
    );
  }, [
    account,
    activeTab,
    activeDeliveries,
    hiddenDeliveries,
    deliveries,
    fuelLogs,
    orders,
    settings,
  ]);

  const darkMode = settings.appearance.themeMode === 'dark';
  const C = darkMode ? DARK : LIGHT;
  const styles = useMemo(() => makeStyles(C), [C]);

  useEffect(() => {
    installGlobalErrorHandler();
  }, []);

  return (
    <ErrorBoundary>
    <ThemeContext.Provider value={{ C, styles, dark: darkMode }}>
    <PrivacyContext.Provider
      value={{
        showFullPhoneInList: settings.privacy.showFullPhoneInList,
        showFullAddressInList: settings.privacy.showFullAddressInList,
      }}
    >
    <LockGate enabled={settings.security.appLockEnabled}>
    <SafeAreaView
      style={styles.app}
      edges={['top', 'left', 'right']}
    >
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.mainContent}>{screen}</View>
      <GlassSurface
        strength="prominent"
        radius={RADIUS.fab}
        dark={darkMode}
        colors={{ surface: C.surface, primary: C.primary, outline: C.outline }}
        style={{
          position: 'absolute',
          right: 18,
          bottom: 78 + insets.bottom + 62,
          zIndex: 20,
        }}
      >
        <Pressable
          testID="open-manual-delivery"
          accessibilityRole="button"
          accessibilityLabel="배달 직접 추가"
          onPress={openCreateForm}
          style={{
            minHeight: 48,
            paddingHorizontal: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <Ionicons name="add" size={20} color={C.primary} />
          <Text
            style={{ color: C.primary, fontSize: 12, fontWeight: '800' }}
            numberOfLines={1}
            maxFontSizeMultiplier={MAX_FONT_MULTIPLIER}
          >
            직접 추가
          </Text>
        </Pressable>
      </GlassSurface>
      <Pressable
        testID="open-ocr-scanner"
        accessibilityRole="button"
        accessibilityLabel="인수증 스캔"
        style={[styles.scanFab, { bottom: 78 + insets.bottom }]}
        onPress={openScanner}
      >
        <Ionicons name="scan-outline" size={23} color={C.onPrimary} />
        <Text
          style={styles.scanFabText}
          numberOfLines={1}
          maxFontSizeMultiplier={MAX_FONT_MULTIPLIER}
        >
          인수증 스캔
        </Text>
      </Pressable>
      <GlassSurface
        strength="prominent"
        radius={RADIUS.floatingNav}
        dark={darkMode}
        colors={{ surface: C.surface, primary: C.primary, outline: C.outline }}
        style={{
          marginHorizontal: 12,
          marginTop: 6,
          marginBottom: Math.max(insets.bottom, 10),
        }}
      >
        <View
          style={[
            styles.bottomNav,
            { minHeight: 60, paddingBottom: 0, paddingHorizontal: 4 },
          ]}
        >
          {tabs.map((tab, index) => {
            const selected = tab.key === activeTab;
            return (
              <Pressable
                key={tab.key}
                testID={`nav-${tab.key}`}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={tab.label}
                style={styles.navItem}
                onPress={() => {
                  setActiveTab(tab.key);
                  if (!reduceMotion) {
                    const ripple = navRipples[index];
                    ripple.setValue(0);
                    Animated.timing(ripple, {
                      toValue: 1,
                      duration: 520,
                      easing: Easing.out(Easing.quad),
                      useNativeDriver: true,
                    }).start();
                  }
                }}
              >
                <Animated.View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    top: 6,
                    left: '50%',
                    marginLeft: -22,
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: C.primary,
                    opacity: navRipples[index].interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.22, 0],
                    }),
                    transform: [
                      {
                        scale: navRipples[index].interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.35, 1.7],
                        }),
                      },
                    ],
                  }}
                />
                <View style={[styles.navIcon, selected && styles.navIconSelected]}>
                  <Ionicons
                    name={selected ? tab.activeIcon : tab.icon}
                    size={22}
                    color={selected ? C.primary : C.textMuted}
                  />
                  {tab.key === 'notifications' && notificationCount > 0 && (
                    <View style={styles.navNotificationDot} />
                  )}
                </View>
                <Text
                  style={[styles.navLabel, selected && styles.navLabelSelected]}
                  numberOfLines={1}
                  maxFontSizeMultiplier={MAX_FONT_MULTIPLIER}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </GlassSurface>
      <DeliveryDetailSheet
        delivery={selectedDelivery}
        visible={Boolean(selectedDelivery)}
        completionPhotoUri={(() => {
          const path = orders.find(
            (item) => item.id === selectedDelivery?.id,
          )?.completionPhotoPath;
          return path
            ? resolveCompletionPhotoUri(
                FileSystem.documentDirectory ?? '',
                path,
              )
            : undefined;
        })()}
        recentContacts={recentContactsForDelivery(
          contactLogs,
          selectedDelivery?.id ?? '',
        )}
        onClose={() => setSelectedDelivery(undefined)}
        onToggle={toggleSelected}
        onEdit={editSelected}
        onDelete={deleteSelected}
        onToggleHidden={() =>
          selectedDelivery && toggleHiddenById(selectedDelivery.id)
        }
        onAttachPhoto={startCompletionPhoto}
        onRemovePhoto={removeCompletionPhoto}
        onLogCall={logCall}
      />
      <DeliveryFormModal
        visible={formVisible}
        initial={formOrder}
        onClose={() => setFormVisible(false)}
        onSubmit={submitManualOrder}
      />
      <FuelFormModal
        visible={fuelFormVisible}
        initial={fuelFormLog}
        defaultVehicle={settings.costs.vehicleModel}
        vehicleRegistry={fleetRegistry}
        onClose={() => setFuelFormVisible(false)}
        onSubmit={submitFuel}
      />
      <MileageFormModal
        visible={mileageFormVisible}
        initial={mileageFormLog}
        defaultVehicle={settings.costs.vehicleModel}
        vehicleRegistry={fleetRegistry}
        onClose={() => setMileageFormVisible(false)}
        onSubmit={submitMileage}
      />
      <OcrScannerModal
        visible={scannerVisible}
        settings={settings}
        onClose={() => setScannerVisible(false)}
        onRegister={(delivery, receiptImageUri) => {
          const fee = calculateFeeByAddress(delivery.deliveryAddress, settings);
          const district = findDistrictByAddress(delivery.deliveryAddress, settings);
          const order = legacyDeliveryToOrder({
            ...delivery,
            fee,
          });
          order.settlement.district = district;
          order.source = { type: 'ocr' };
          setOrders((current) => [order, ...current]);
          deliveryRepository.save(order).catch(() => undefined);
          setActiveTab('deliveries');
          // 무료 티어 한도 계산용 오늘 스캔 횟수 누적(Pro는 한도 무의미).
          incrementScanCount(AsyncStorage, new Date()).catch(() => undefined);
          // 인수증 원본 이미지를 문서 디렉터리로 복사해 캘린더/기록에서 다시 볼 수 있게 보존.
          if (receiptImageUri) {
            void persistReceiptImage(order, receiptImageUri);
          }
        }}
      />
      <OnboardingModal
        visible={onboardingVisible}
        initial={account}
        onComplete={(state) => {
          setAccount(state);
          setOnboardingVisible(false);
          accountRepository.save(state).catch(() => undefined);
        }}
      />
    </SafeAreaView>
    </LockGate>
    </PrivacyContext.Provider>
    </ThemeContext.Provider>
    </ErrorBoundary>
  );
}

