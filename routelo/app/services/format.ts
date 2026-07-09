import { Delivery } from '../models';

// Small pure formatters / predicates shared by the screens, extracted from the
// monolith so they can be unit-tested and reused.

// 목록용 주소 마스킹: 앞 2개 토큰(시/구)만 남기고 이후를 가린다.
export const maskAddressForList = (address: string): string => {
  const parts = address.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return address;
  return `${parts.slice(0, 2).join(' ')} ···`;
};

export const formatWon = (value: number) =>
  `${Math.round(value).toLocaleString('ko-KR')}원`;

export function timeOf(value: string) {
  return value.split(' ')[1] || value;
}

export function addMinutes(time: string, minutes: number) {
  const [hour, minute] = time.split(':').map(Number);
  const total = hour * 60 + minute + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(
    total % 60,
  ).padStart(2, '0')}`;
}

export function isEventDelivery(delivery: Delivery) {
  return Boolean(delivery.eventTime) || delivery.productName.includes('축하');
}

export function priorityOf(delivery: Delivery) {
  if (isEventDelivery(delivery)) return 'urgent';
  if (delivery.distanceKm >= 10) return 'risk';
  return delivery.status === 'completed' ? 'completed' : 'normal';
}
