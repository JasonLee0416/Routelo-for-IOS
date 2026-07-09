import { createContext, useContext } from 'react';

import { AppStyles, makeStyles } from './appStyles';
import { LIGHT, Palette } from './palette';

export type ThemeValue = { C: Palette; styles: AppStyles; dark: boolean };

export const ThemeContext = createContext<ThemeValue | null>(null);

export const useTheme = (): ThemeValue =>
  useContext(ThemeContext) ?? {
    C: LIGHT,
    styles: makeStyles(LIGHT),
    dark: false,
  };

// 목록에서의 민감정보 노출 제어(설정 privacy). 증거 보존과 무관하게 "표시"만 가린다.
export type PrivacyValue = {
  showFullPhoneInList: boolean;
  showFullAddressInList: boolean;
};

export const PrivacyContext = createContext<PrivacyValue>({
  showFullPhoneInList: false,
  showFullAddressInList: true,
});

export const usePrivacy = (): PrivacyValue => useContext(PrivacyContext);
