import { FuelLog, MileageLog } from '../../models';
import {
  summarizeEfficiency,
  summarizeEfficiencyByVehicle,
} from '../efficiency';

const fuel = (liters: number, amount: number, vehicle?: string): FuelLog => ({
  id: `f${liters}-${vehicle ?? ''}`,
  date: '2026-07-03',
  liters,
  pricePerLiter: liters ? amount / liters : 0,
  amount,
  odometerKm: 0,
  vehicle,
});

const mileage = (dailyDistanceKm: number, vehicle?: string): MileageLog => ({
  id: `m${dailyDistanceKm}-${vehicle ?? ''}`,
  date: '2026-07-03',
  odometerKm: 0,
  dailyDistanceKm,
  vehicle,
});

describe('summarizeEfficiency', () => {
  test('computes totals, km/L, and cost/km', () => {
    const summary = summarizeEfficiency(
      [fuel(30, 51000), fuel(20, 34000)], // 50 L, 85,000원
      [mileage(400), mileage(200)], // 600 km
    );
    expect(summary).toEqual({
      totalDistanceKm: 600,
      totalLiters: 50,
      totalFuelCost: 85000,
      kmPerLiter: 12, // 600 / 50
      costPerKm: 142, // round(85000 / 600)
    });
  });

  test('rounds km/L to one decimal', () => {
    expect(summarizeEfficiency([fuel(30, 45000)], [mileage(400)]).kmPerLiter).toBe(
      13.3, // 400 / 30 = 13.33
    );
  });

  test('returns null km/L when there is no fuel', () => {
    const summary = summarizeEfficiency([], [mileage(100)]);
    expect(summary.kmPerLiter).toBeNull();
    expect(summary.costPerKm).toBe(0); // distance present, cost 0
    expect(summary.totalDistanceKm).toBe(100);
  });

  test('returns null cost/km when there is no distance', () => {
    const summary = summarizeEfficiency([fuel(30, 51000)], []);
    expect(summary.costPerKm).toBeNull();
    expect(summary.kmPerLiter).toBe(0); // 0 distance / 30 L
    expect(summary.totalFuelCost).toBe(51000);
  });

  test('is all zero/null with no data', () => {
    expect(summarizeEfficiency([], [])).toEqual({
      totalDistanceKm: 0,
      totalLiters: 0,
      totalFuelCost: 0,
      kmPerLiter: null,
      costPerKm: null,
    });
  });
});

describe('summarizeEfficiencyByVehicle', () => {
  test('groups by vehicle label and summarizes each', () => {
    const result = summarizeEfficiencyByVehicle(
      [fuel(30, 45000, '1톤 트럭'), fuel(20, 30000, '스타렉스')],
      [mileage(400, '1톤 트럭'), mileage(300, '스타렉스')],
      { defaultLabel: '기본 차량' },
    );
    const truck = result.find((r) => r.vehicle === '1톤 트럭');
    const van = result.find((r) => r.vehicle === '스타렉스');
    expect(truck?.summary.kmPerLiter).toBe(13.3); // 400/30
    expect(van?.summary.kmPerLiter).toBe(15); // 300/20
    expect(result).toHaveLength(2);
  });

  test('folds logs with no vehicle into the default label', () => {
    const result = summarizeEfficiencyByVehicle(
      [fuel(10, 15000)],
      [mileage(100), mileage(50, '  ')], // blank vehicle → default
      { defaultLabel: '기본 차량' },
    );
    expect(result).toHaveLength(1);
    expect(result[0].vehicle).toBe('기본 차량');
    expect(result[0].summary.totalDistanceKm).toBe(150);
  });

  test('sorts vehicles by name and returns [] with no logs', () => {
    expect(
      summarizeEfficiencyByVehicle([], [], { defaultLabel: '기본 차량' }),
    ).toEqual([]);
    const sorted = summarizeEfficiencyByVehicle(
      [fuel(1, 1, 'B'), fuel(1, 1, 'A')],
      [],
      { defaultLabel: '기본 차량' },
    ).map((r) => r.vehicle);
    expect(sorted).toEqual(['A', 'B']);
  });
});
