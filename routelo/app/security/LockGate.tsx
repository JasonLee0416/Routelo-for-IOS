import { ReactNode, useEffect, useState } from 'react';
import {
  AppState,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { getPinHash, verifyPin } from './appLock';

// 앱 잠금 게이트: 잠금이 켜져 있고 PIN이 설정돼 있으면, 실행/포그라운드 복귀 시
// PIN 화면으로 가린다. 통과해야 앱 내용이 보인다.
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

  useEffect(() => {
    let mounted = true;
    if (!enabled) {
      setLocked(false);
      return;
    }
    getPinHash().then((h) => {
      if (!mounted) return;
      setPinHash(h);
      if (h) setLocked(true);
    });
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        getPinHash().then((h) => {
          setPinHash(h);
          if (h) setLocked(true);
        });
      }
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, [enabled]);

  if (!enabled || !pinHash || !locked) return <>{children}</>;

  const submit = () => {
    if (verifyPin(entry, pinHash)) {
      setEntry('');
      setError(false);
      setLocked(false);
    } else {
      setError(true);
      setEntry('');
    }
  };

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
        }}
      />
      {error && (
        <Text style={{ color: '#FF8A8A', fontSize: 12, marginTop: 10 }}>
          PIN이 올바르지 않습니다
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="잠금 해제"
        onPress={submit}
        style={{
          marginTop: 20,
          minHeight: 48,
          paddingHorizontal: 40,
          borderRadius: 14,
          backgroundColor: '#2C7CEF',
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
