import { Component, ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { recordError } from './errorReporting';

// 렌더 에러가 앱 전체를 흰 화면으로 만들지 않도록 잡아, 기록하고 복구 UI를 보여준다.
type Props = { children: ReactNode };
type State = { hasError: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    void recordError(error, false);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 28,
          backgroundColor: '#F5F7FB',
        }}
      >
        <Text
          style={{
            fontSize: 18,
            fontWeight: '800',
            color: '#1F2937',
            marginBottom: 8,
          }}
        >
          일시적인 오류가 발생했어요
        </Text>
        <Text
          style={{
            fontSize: 13,
            color: '#6B7280',
            textAlign: 'center',
            lineHeight: 20,
            marginBottom: 20,
          }}
        >
          데이터는 안전하게 보관돼 있습니다. 다시 시도해 주세요.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="다시 시도"
          onPress={() => this.setState({ hasError: false })}
          style={{
            minHeight: 46,
            paddingHorizontal: 24,
            borderRadius: 14,
            backgroundColor: '#2C7CEF',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>
            다시 시도
          </Text>
        </Pressable>
      </View>
    );
  }
}
