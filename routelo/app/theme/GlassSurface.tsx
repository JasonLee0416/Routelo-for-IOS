import { BlurView } from '@react-native-community/blur';
import { ReactNode, useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

import { withAlpha } from './color';
import { GLASS, GlassStrength } from './tokens';

export type GlassColors = {
  surface: string; // solid fallback surface
  primary: string; // tint source
  outline: string; // solid fallback border
};

// Tracks the OS "Reduce Transparency" setting so glass falls back to a solid
// surface (LUCENT rule 9). Also covers Increase Contrast on most platforms.
export function useReduceTransparency(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceTransparencyEnabled?.()
      .then((value) => mounted && setReduce(Boolean(value)))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      (value) => setReduce(Boolean(value)),
    );
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);
  return reduce;
}

// Tracks the OS "Reduce Motion" setting so animations can be skipped.
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((value) => mounted && setReduce(Boolean(value)))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (value) => setReduce(Boolean(value)),
    );
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);
  return reduce;
}

type Props = {
  strength: Exclude<GlassStrength, 'none'>;
  radius: number;
  colors: GlassColors;
  dark: boolean;
  tint?: string; // defaults to colors.primary
  reduceTransparency?: boolean; // override the hook
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

// The single glass primitive: a blurred, tinted, edge-lit control surface with
// a continuous-corner radius. Content stays solid — use this only for control
// layers (nav, toolbar, FAB, sheet, chips, search).
export function GlassSurface({
  strength,
  radius,
  colors,
  dark,
  tint,
  reduceTransparency,
  style,
  children,
}: Props) {
  const autoReduce = useReduceTransparency();
  const reduce = reduceTransparency ?? autoReduce;
  const g = GLASS[strength];

  const shadow = {
    shadowColor: dark ? '#000000' : '#0A1E4A',
    shadowOpacity: g.shadowOpacity,
    shadowRadius: Math.round(radius * 0.9),
    shadowOffset: { width: 0, height: 12 },
    elevation: Math.round(6 + g.blur / 4),
  } as const;

  if (reduce) {
    return (
      <View
        style={[
          {
            backgroundColor: colors.surface,
            borderRadius: radius,
            borderWidth: 1,
            borderColor: colors.outline,
          },
          shadow,
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  const baseRgb = dark ? '28,28,30' : '255,255,255';
  return (
    <View
      style={[
        {
          borderRadius: radius,
          borderWidth: 1,
          borderColor: `rgba(255,255,255,${g.strokeOpacity})`,
          overflow: 'hidden',
        },
        shadow,
        style,
      ]}
    >
      <BlurView
        blurAmount={Math.min(100, Math.round(g.blur))}
        blurType={dark ? 'dark' : 'light'}
        reducedTransparencyFallbackColor={colors.surface}
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: `rgba(${baseRgb},${g.bgOpacity})` },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: withAlpha(tint ?? colors.primary, g.tintOpacity) },
        ]}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          backgroundColor: `rgba(255,255,255,${g.highlightOpacity})`,
        }}
      />
      {children}
    </View>
  );
}
