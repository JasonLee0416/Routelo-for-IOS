import { FuelLog, MileageLog } from '../../models';
import {
  addVehicle,
  buildFleetSummary,
  dedupeVehicles,
  isValidVehicleLabel,
  MAX_VEHICLES,
  normalizeVehicleLabel,
  removeVehicle,
} from '../registry';

const fuel = (amount: number, liters: number, vehicle?: string): FuelLog => ({
  id: `f-${vehicle ?? 'x'}-${amount}`,
  date: '2026-07-01',
  pricePerLiter: liters > 0 ? Math.round(amount / liters) : 0,
  liters,
  amount,
  odometerKm: 0,
  vehicle,
});

const mileage = (km: number, vehicle?: string): MileageLog => ({
  id: `m-${vehicle ?? 'x'}-${km}`,
  date: '2026-07-01',
  odometerKm: 0,
  dailyDistanceKm: km,
  vehicle,
});

describe('label helpers', () => {
  it('normalizes surrounding and inner whitespace', () => {
    expect(normalizeVehicleLabel('  1톤   트럭 ')).toBe('1톤 트럭');
  });

  it('validates length 1..24', () => {
    expect(isValidVehicleLabel('  ')).toBe(false);
    expect(isValidVehicleLabel('포터2')).toBe(true);
    expect(isValidVehicleLabel('x'.repeat(25))).toBe(false);
  });

  it('dedupes case-insensitively keeping first order', () => {
    expect(dedupeVehicles(['Porter', 'porter', ' 봉고 ', 'Bongo', 'BONGO'])).toEqual(
      ['Porter', '봉고', 'Bongo'],
    );
  });
});

describe('addVehicle / removeVehicle', () => {
  it('adds a normalized label, ignoring duplicates', () => {
    expect(addVehicle(['포터2'], ' 봉고3 ')).toEqual(['포터2', '봉고3']);
    expect(addVehicle(['포터2'], '포터2')).toEqual(['포터2']);
    expect(addVehicle(['포터2'], 'PORTER2'.toLowerCase())).toEqual([
      '포터2',
      'porter2',
    ]); // 다른 문자열이면 추가
  });

  it('rejects invalid labels', () => {
    expect(addVehicle(['포터2'], '   ')).toEqual(['포터2']);
  });

  it('caps at MAX_VEHICLES', () => {
    const full = Array.from({ length: MAX_VEHICLES }, (_, i) => `v${i}`);
    expect(addVehicle(full, 'extra')).toEqual(full);
  });

  it('removes a label case-insensitively', () => {
    expect(removeVehicle(['포터2', '봉고3'], '봉고3')).toEqual(['포터2']);
    expect(removeVehicle(['Porter', '봉고3'], 'porter')).toEqual(['봉고3']);
  });
});

describe('buildFleetSummary', () => {
  it('computes per-vehicle cost/efficiency, share, sorted by cost', () => {
    const fuelLogs = [
      fuel(60000, 30, '포터2'),
      fuel(20000, 10, '봉고3'),
    ];
    const mileageLogs = [mileage(300, '포터2'), mileage(100, '봉고3')];

    const rows = buildFleetSummary(
      ['포터2', '봉고3'],
      fuelLogs,
      mileageLogs,
      '기본 차량',
    );

    expect(rows.map((r) => r.label)).toEqual(['포터2', '봉고3']);
    const porter = rows[0];
    expect(porter.fuelCost).toBe(60000);
    expect(porter.distanceKm).toBe(300);
    expect(porter.kmPerLiter).toBe(10); // 300 / 30
    expect(porter.costPerKm).toBe(200); // 60000 / 300
    expect(porter.share).toBeCloseTo(0.75, 5); // 60000 / 80000
    expect(porter.hasLogs).toBe(true);
  });

  it('includes registered vehicles with no logs as zero rows', () => {
    const rows = buildFleetSummary(
      ['포터2', '전기트럭'],
      [fuel(30000, 15, '포터2')],
      [],
      '기본 차량',
    );
    const ev = rows.find((r) => r.label === '전기트럭')!;
    expect(ev.fuelCost).toBe(0);
    expect(ev.hasLogs).toBe(false);
    expect(ev.share).toBe(0);
    expect(ev.kmPerLiter).toBeNull();
  });

  it('folds untagged logs into the default label', () => {
    const rows = buildFleetSummary(
      [],
      [fuel(10000, 5)],
      [],
      '기본 차량',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe('기본 차량');
    expect(rows[0].fuelCost).toBe(10000);
    expect(rows[0].share).toBe(1);
  });

  it('merges registry labels with labels only present in logs', () => {
    const rows = buildFleetSummary(
      ['포터2'],
      [fuel(10000, 5, '임시차')],
      [],
      '기본 차량',
    );
    expect(rows.map((r) => r.label).sort()).toEqual(['임시차', '포터2']);
  });
});
