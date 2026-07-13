import IoniconsBase from 'react-native-vector-icons/Ionicons';
import glyphMap from 'react-native-vector-icons/glyphmaps/Ionicons.json';

// @expo/vector-icons 호환: 컴포넌트에 glyphMap 정적 필드를 붙여
// `keyof typeof Ionicons.glyphMap` 아이콘 이름 타입이 그대로 동작한다.
export const Ionicons = Object.assign(IoniconsBase, { glyphMap });
