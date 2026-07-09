import { MileageLog } from '../models';
import { normalizeVehicle } from './fuel';

// User-facing input for a daily odometer / driving-distance record.
export type MileageLogInput = {
  date: string; // YYYY-MM-DD
  odometerKm: number;
  dailyDistanceKm?: number;
  vehicle?: string;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateMileageLogInput(input: MileageLogInput): string[] {
  const errors: string[] = [];
  if (!input.date || !DATE_RE.test(input.date)) {
    errors.push('기록 날짜 형식은 YYYY-MM-DD 입니다.');
  }
  if (!Number.isFinite(input.odometerKm) || input.odometerKm < 0) {
    errors.push('누적 주행거리(km)는 0 이상의 숫자여야 합니다.');
  }
  if (
    input.dailyDistanceKm !== undefined &&
    (!Number.isFinite(input.dailyDistanceKm) || input.dailyDistanceKm < 0)
  ) {
    errors.push('일일 주행거리(km)는 0 이상이어야 합니다.');
  }
  return errors;
}

export function createMileageLog(
  input: MileageLogInput,
  opts: { id: string },
): MileageLog {
  const errors = validateMileageLogInput(input);
  if (errors.length) throw new Error(errors.join(' '));
  return {
    id: opts.id,
    date: input.date,
    odometerKm: input.odometerKm,
    dailyDistanceKm: input.dailyDistanceKm ?? 0,
    vehicle: normalizeVehicle(input.vehicle),
  };
}

export function applyMileageLogEdit(
  log: MileageLog,
  input: MileageLogInput,
): MileageLog {
  const errors = validateMileageLogInput(input);
  if (errors.length) throw new Error(errors.join(' '));
  return {
    ...log,
    date: input.date,
    odometerKm: input.odometerKm,
    dailyDistanceKm: input.dailyDistanceKm ?? 0,
    vehicle: normalizeVehicle(input.vehicle),
  };
}

export function mileageLogToInput(log: MileageLog): MileageLogInput {
  return {
    date: log.date,
    odometerKm: log.odometerKm,
    dailyDistanceKm: log.dailyDistanceKm || undefined,
    vehicle: log.vehicle,
  };
}
