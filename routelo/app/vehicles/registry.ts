// 다중 차량 관리(Pro). 주유·주행 기록은 이미 free-text `vehicle` 라벨로 차량을
// 구분한다. 문제는 매번 손으로 입력하면 오타로 같은 차가 여러 그룹으로 쪼개진다는
// 것. 등록된 라벨 목록(레지스트리)을 두고 폼에서 칩으로 골라 넣으면 라벨이
// 일관되게 유지된다. 여기 함수는 전부 순수 함수라 그대로 유닛 테스트한다.
import { FuelLog, MileageLog } from '../models';
import { summarizeEfficiencyByVehicle } from '../services/efficiency';

export const MAX_VEHICLES = 8;
const MAX_LABEL_LEN = 24;

export function normalizeVehicleLabel(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function isValidVehicleLabel(value: string): boolean {
  const normalized = normalizeVehicleLabel(value);
  return normalized.length >= 1 && normalized.length <= MAX_LABEL_LEN;
}

// 대소문자 무시 중복 제거(입력 순서 유지).
export function dedupeVehicles(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const label = normalizeVehicleLabel(raw);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

// 라벨 추가(정규화·중복 무시·최대 대수 제한). 무효/한도 초과면 원본 그대로 반환.
export function addVehicle(list: string[], label: string): string[] {
  if (!isValidVehicleLabel(label)) return list;
  const normalized = normalizeVehicleLabel(label);
  const existing = dedupeVehicles(list);
  if (existing.some((v) => v.toLowerCase() === normalized.toLowerCase())) {
    return existing;
  }
  if (existing.length >= MAX_VEHICLES) return existing;
  return [...existing, normalized];
}

export function removeVehicle(list: string[], label: string): string[] {
  const target = normalizeVehicleLabel(label).toLowerCase();
  return dedupeVehicles(list).filter((v) => v.toLowerCase() !== target);
}

export type VehicleCostRow = {
  label: string;
  fuelCost: number;
  distanceKm: number;
  liters: number;
  kmPerLiter: number | null;
  costPerKm: number | null;
  share: number; // 총 주유비 대비 비중 0..1
  hasLogs: boolean;
};

// 등록 라벨 + 기록에 등장한 라벨을 합쳐 차량별 비용/연비를 낸다. 기록이 없는
// 등록 차량도 0으로 노출(관리 목적). 총 주유비 대비 비중을 함께 계산하고,
// 주유비 내림차순 → 라벨 오름차순으로 안정 정렬한다.
export function buildFleetSummary(
  registry: string[],
  fuelLogs: FuelLog[],
  mileageLogs: MileageLog[],
  defaultLabel: string,
): VehicleCostRow[] {
  const byVehicle = summarizeEfficiencyByVehicle(fuelLogs, mileageLogs, {
    defaultLabel,
  });
  const summaryByLabel = new Map(byVehicle.map((v) => [v.vehicle, v.summary]));

  const labels = dedupeVehicles([
    ...registry,
    ...byVehicle.map((v) => v.vehicle),
  ]);

  const totalFuelCost = byVehicle.reduce(
    (sum, v) => sum + v.summary.totalFuelCost,
    0,
  );

  const rows: VehicleCostRow[] = labels.map((label) => {
    const summary = summaryByLabel.get(label);
    const fuelCost = summary?.totalFuelCost ?? 0;
    return {
      label,
      fuelCost,
      distanceKm: summary?.totalDistanceKm ?? 0,
      liters: summary?.totalLiters ?? 0,
      kmPerLiter: summary?.kmPerLiter ?? null,
      costPerKm: summary?.costPerKm ?? null,
      share: totalFuelCost > 0 ? fuelCost / totalFuelCost : 0,
      hasLogs: summary != null,
    };
  });

  return rows.sort(
    (a, b) => b.fuelCost - a.fuelCost || a.label.localeCompare(b.label),
  );
}
