import { ReactNode, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  getLockoutState,
  getPinHash,
  saveLockoutState,
  verifyPin,
} from './appLock';
import {
  LockoutState,
  initialLockoutState,
  isLockedOut,
  registerFailure,
  registerSuccess,
  remainingLockMs,
} from './lockout';

// 앱 잠금 게이트: 잠금이 켜져 있고 PIN이 설정돼 있으면, 실행/포그라운드 복귀 시
// PIN 화면으로 가린다. 통과해야 앱 내용이 보인다. 무차별 대입 방지를 위해 시도
// 횟수 제한 + 지수적 잠금 지연(lockout.ts)을 적용한다.
export function LockGate({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  const [pinHash, setPinHash] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [entry, setEntry] = useState('');
  const [error, setError] = useState(false);
  const [lockout, setLockout] = useState<LockoutState>(initialLockoutState());
  const [nowTick, setNowTick] = useState(() => Date.now());
  const lockoutRef = useRef<LockoutState>(lockout);
  lockoutRef.current = lockout;

  useEffect(() => {
    let mounted = true;
    if (!enabled) {
      setLocked(false);
      return;
    }
    const load = () => {
      getPinHash().then((h) => {
        if (!mounted) return;
        setPinHash(h);
        if (h) setLocked(true);
      });
      getLockoutState().then((s) => {
        if (mounted) setLockout(s);
      });
    };
    load();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') load();
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, [enabled]);

  // 잠금 지연 중에는 1초마다 남은 시간을 갱신해 카운트다운을 보여준다.
  const lockedOut = isLockedOut(lockout, nowTick);
  useEffect(() => {
    if (!locked || !lockedOut) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [locked, lockedOut]);

  if (!enabled || !pinHash || !locked) return <>{children}</>;

  const submit = () => {
    const now = Date.now();
    if (isLockedOut(lockoutRef.current, now)) {
      setError(true);
      setEntry('');
      return;
    }
    if (verifyPin(entry, pinHash)) {
      const reset = registerSuccess();
      setLockout(reset);
      saveLockoutState(reset).catch(() => undefined);
      setEntry('');
      setError(false);
      setLocked(false);
    } else {
      const next = registerFailure(lockoutRef.current, now);
      setLockout(next);
      saveLockoutState(next).catch(() => undefined);
      setError(true);
      setEntry('');
      setNowTick(now);
    }
  };

  const remainingSec = Math.ceil(remainingLockMs(lockout, nowTick) / 1000);
  const lockMsg =
    remainingSec > 60
      ? `${Math.ceil(remainingSec / 60)}분 후 다시 시도하세요`
      : `${remainingSec}초 후 다시 시도하세요`;

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 28,
        backgroundColor: '#0F1B2E',
      }}
    >
      <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '800' }}>
        잠금 해제
      </Text>
      <Text style={{ color: '#9EADC7', fontSize: 13, marginTop: 8 }}>
        PIN을 입력하세요
      </Text>
      <TextInput
        value={entry}
        onChangeText={(t) => {
          setEntry(t.replace(/[^\d]/g, ''));
          setError(false);
        }}
        onSubmitEditing={submit}
        editable={!lockedOut}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={6}
        accessibilityLabel="PIN 입력"
        placeholder="••••"
        placeholderTextColor="#5A6B86"
        style={{
          marginTop: 22,
          width: 180,
          minHeight: 52,
          borderRadius: 14,
          backgroundColor: '#1C2A44',
          color: '#FFFFFF',
          fontSize: 22,
          textAlign: 'center',
          letterSpacing: 8,
          opacity: lockedOut ? 0.5 : 1,
        }}
      />
      {lockedOut ? (
        <Text style={{ color: '#FFC46B', fontSize: 12, marginTop: 10 }}>
          시도가 많습니다 · {lockMsg}
        </Text>
      ) : error ? (
        <Text style={{ color: '#FF8A8A', fontSize: 12, marginTop: 10 }}>
          PIN이 올바르지 않습니다
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="잠금 해제"
        accessibilityState={{ disabled: lockedOut }}
        onPress={submit}
        disabled={lockedOut}
        style={{
          marginTop: 20,
          minHeight: 48,
          paddingHorizontal: 40,
          borderRadius: 14,
          backgroundColor: lockedOut ? '#37476A' : '#2C7CEF',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 15 }}>
          확인
        </Text>
      </Pressable>
    </View>
  );
}
