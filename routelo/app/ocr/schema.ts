import { OcrFieldKey } from '../models';

// 정규화 필드 키는 앱의 단일 진실 OcrFieldKey를 그대로 쓴다.
// (services/ocr.ts 파이프라인과 동일한 필드 집합)
export type ReceiptFieldKey = OcrFieldKey;

// OCR 엔진이 뱉는 원본 한 줄. text만 보관해도 무손실이며,
// box는 디버깅/재정렬용 옵션(기본 미저장 → 용량 절약).
export type RawOcrLine = {
  text: string;
  box?: [number, number, number, number]; // [x, y, w, h] 정수
};

// 레지스트리에 매칭되지 못한 라벨/값. 버리지 않고 그대로 보존한다.
export type UnmappedField = {
  label: string; // 라벨이 없는 순수 텍스트 줄이면 빈 문자열
  value: string;
};

// 한 장의 인수증 = 한 개의 레코드. 외부 파일(JSON)로 저장된다.
export type ReceiptRecord = {
  id: string;
  capturedAt: string; // ISO 8601
  imageUri?: string; // 원본 인수증 이미지 경로 보존
  raw: { lines: string[] }; // 무손실 원본 텍스트
  fields: Partial<Record<ReceiptFieldKey, string>>; // 정규화된 값
  unmapped: UnmappedField[]; // 매칭 실패분 (손실 방지)
  registryVersion: number; // 어떤 별칭 레지스트리로 매핑했는지 추적
};

// 정규화 결과(저장 전 중간 산출물)
export type NormalizeResult = {
  fields: Partial<Record<ReceiptFieldKey, string>>;
  unmapped: UnmappedField[];
};
