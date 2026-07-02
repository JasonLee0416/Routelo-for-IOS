import { Delivery } from '../models';
import { RouteloSettings } from '../settings';

const toRadians = (value: number) => (value * Math.PI) / 180;

export function distanceBetween(
  a: Pick<Delivery, 'latitude' | 'longitude'>,
  b: Pick<Delivery, 'latitude' | 'longitude'>,
) {
  const earthRadiusKm = 6371;
  const latDelta = toRadians(b.latitude - a.latitude);
  const lonDelta = toRadians(b.longitude - a.longitude);
  const latA = toRadians(a.latitude);
  const latB = toRadians(b.latitude);
  const haversine =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(latA) * Math.cos(latB) * Math.sin(lonDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function optimizeByNearestNeighbor(
  deliveries: Delivery[],
  start = { latitude: 37.5033, longitude: 127.0442 },
) {
  const remaining = [...deliveries];
  const result: Delivery[] = [];
  let current = start;

  while (remaining.length) {
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    remaining.forEach((delivery, index) => {
      const distance = distanceBetween(current, delivery);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    const [nearest] = remaining.splice(nearestIndex, 1);
    result.push(nearest);
    current = nearest;
  }

  return result;
}

const districtFeeEntries = (settings: RouteloSettings) =>
  Object.entries(settings.fees.districtFees).flatMap(([, fees]) =>
    Object.entries(fees),
  );

export function calculateFeeByAddress(address: string, settings: RouteloSettings) {
  const district = findDistrictByAddress(address, settings);
  const configuredFee = districtFeeEntries(settings).find(
    ([name]) => name === district,
  )?.[1];
  return configuredFee ?? settings.fees.defaultFee;
}

export function findDistrictByAddress(address: string, settings: RouteloSettings) {
  const compactAddress = address.replace(/\s/g, '');
  return districtFeeEntries(settings).map(([name]) => name).find((name) =>
    compactAddress.includes(name.replace(/\s/g, '')),
  );
}

export async function geocodeAddress(address: string) {
  // Google Maps 길찾기 링크는 API 키 없이 사용할 수 있습니다.
  // MVP에서는 주소 등록 흐름을 끊지 않도록 서울 중심부의 안정적인 대체 좌표를 반환합니다.
  const seed = [...address].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return {
    latitude: 37.48 + (seed % 45) / 1000,
    longitude: 127.01 + (seed % 70) / 1000,
  };
}
