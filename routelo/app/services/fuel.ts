import { FuelLog } from '../models';

// User-facing input for logging a fuel purchase. Either a per-liter price or a
// total amount is required; the other is derived.
export type FuelLogInput = {
  date: string; // YYYY-MM-DD
  liters: number;
  pricePerLiter?: number;
  amount?: number;
  odometerKm?: number;
  vehicle?: string;
};

// Normalize a free-text vehicle label: trimmed, or undefined when blank so it
// falls back to the default vehicle everywhere.
export const normalizeVehicle = (vehicle?: string): string | undefined => {
  const trimmed = vehicle?.trim();
  return trimmed ? trimmed : undefined;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateFuelLogInput(input: FuelLogInput): string[] {
  const errors: string[] = [];
  if (!input.date || !DATE_RE.test(input.date)) {
    errors.push('주유 날짜 형식은 YYYY-MM-DD 입니다.');
  }
  if (!(input.liters > 0)) {
    errors.push('주유량(L)은 0보다 커야 합니다.');
  }
  const hasPrice = input.pricePerLiter !== undefined && input.pricePerLiter > 0;
  const hasAmount = input.amount !== undefined && input.amount > 0;
  if (!hasPrice && !hasAmount) {
    errors.push('리터당 단가 또는 총 주유금액 중 하나는 입력해야 합니다.');
  }
  if (input.pricePerLiter !== undefined && input.pricePerLiter < 0) {
    errors.push('단가는 0 이상이어야 합니다.');
  }
  if (input.amount !== undefined && input.amount < 0) {
    errors.push('주유금액은 0 이상이어야 합니다.');
  }
  if (input.odometerKm !== undefined && input.odometerKm < 0) {
    errors.push('주행거리는 0 이상이어야 합니다.');
  }
  return errors;
}

// Reconciles the money fields: an explicit total wins and back-fills the unit
// price; otherwise the total is the unit price times liters.
function resolveMoney(input: FuelLogInput): {
  amount: number;
  pricePerLiter: number;
} {
  const { liters } = input;
  if (input.amount !== undefined && input.amount > 0) {
    const amount = Math.round(input.amount);
    const pricePerLiter =
      input.pricePerLiter && input.pricePerLiter > 0
        ? input.pricePerLiter
        : liters > 0
          ? Math.round((amount / liters) * 10) / 10
          : 0;
    return { amount, pricePerLiter };
  }
  const pricePerLiter = input.pricePerLiter ?? 0;
  return { amount: Math.round(pricePerLiter * liters), pricePerLiter };
}

export function createFuelLog(
  input: FuelLogInput,
  opts: { id: string },
): FuelLog {
  const errors = validateFuelLogInput(input);
  if (errors.length) throw new Error(errors.join(' '));
  const { amount, pricePerLiter } = resolveMoney(input);
  return {
    id: opts.id,
    date: input.date,
    liters: input.liters,
    pricePerLiter,
    amount,
    odometerKm: input.odometerKm ?? 0,
    vehicle: normalizeVehicle(input.vehicle),
  };
}

export function applyFuelLogEdit(log: FuelLog, input: FuelLogInput): FuelLog {
  const errors = validateFuelLogInput(input);
  if (errors.length) throw new Error(errors.join(' '));
  const { amount, pricePerLiter } = resolveMoney(input);
  return {
    ...log,
    date: input.date,
    liters: input.liters,
    pricePerLiter,
    amount,
    odometerKm: input.odometerKm ?? 0,
    vehicle: normalizeVehicle(input.vehicle),
  };
}

export function fuelLogToInput(log: FuelLog): FuelLogInput {
  return {
    date: log.date,
    liters: log.liters,
    pricePerLiter: log.pricePerLiter || undefined,
    amount: log.amount || undefined,
    odometerKm: log.odometerKm || undefined,
    vehicle: log.vehicle,
  };
}
