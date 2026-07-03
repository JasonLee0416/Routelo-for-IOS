import { FuelLog, MileageLog } from '../../models';
import { summarizeEfficiency } from '../efficiency';

const fuel = (liters: number, amount: number): FuelLog => ({
  id: `f${liters}`,
  date: '2026-07-03',
  liters,
  pricePerLiter: liters ? amount / liters : 0,
  amount,
  odometerKm: 0,
});

const mileage = (dailyDistanceKm: number): MileageLog => ({
  id: `m${dailyDistanceKm}`,
  date: '2026-07-03',
  odometerKm: 0,
  dailyDistanceKm,
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
