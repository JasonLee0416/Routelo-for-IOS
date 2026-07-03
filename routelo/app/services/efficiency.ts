import { FuelLog, MileageLog } from '../models';

export type EfficiencySummary = {
  totalDistanceKm: number;
  totalLiters: number;
  totalFuelCost: number;
  kmPerLiter: number | null; // null when there is no fuel logged
  costPerKm: number | null; // null when there is no distance logged
};

// Combines fuel logs and mileage logs into fuel-efficiency figures. Distance is
// the sum of the logged daily distances; km/L and cost/km are null (not zero)
// when the denominator is missing, so the UI can distinguish "no data" from 0.
export function summarizeEfficiency(
  fuelLogs: FuelLog[],
  mileageLogs: MileageLog[],
): EfficiencySummary {
  const totalLiters = fuelLogs.reduce((sum, log) => sum + (log.liters || 0), 0);
  const totalFuelCost = fuelLogs.reduce(
    (sum, log) => sum + (log.amount || 0),
    0,
  );
  const totalDistanceKm = mileageLogs.reduce(
    (sum, log) => sum + (log.dailyDistanceKm || 0),
    0,
  );
  return {
    totalDistanceKm,
    totalLiters,
    totalFuelCost,
    kmPerLiter:
      totalLiters > 0
        ? Math.round((totalDistanceKm / totalLiters) * 10) / 10
        : null,
    costPerKm:
      totalDistanceKm > 0 ? Math.round(totalFuelCost / totalDistanceKm) : null,
  };
}
