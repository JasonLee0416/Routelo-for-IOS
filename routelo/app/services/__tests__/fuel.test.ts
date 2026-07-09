import {
  applyFuelLogEdit,
  createFuelLog,
  fuelLogToInput,
  normalizeVehicle,
  validateFuelLogInput,
} from '../fuel';

describe('normalizeVehicle', () => {
  test('trims, and maps blank to undefined', () => {
    expect(normalizeVehicle('  1톤 트럭 ')).toBe('1톤 트럭');
    expect(normalizeVehicle('   ')).toBeUndefined();
    expect(normalizeVehicle(undefined)).toBeUndefined();
  });

  test('createFuelLog carries the normalized vehicle; round-trips via input', () => {
    const log = createFuelLog(
      { date: '2026-07-03', liters: 30, pricePerLiter: 1700, vehicle: ' 트럭 ' },
      { id: 'f1' },
    );
    expect(log.vehicle).toBe('트럭');
    expect(fuelLogToInput(log).vehicle).toBe('트럭');
  });
});

describe('validateFuelLogInput', () => {
  test('accepts a valid input with a unit price', () => {
    expect(
      validateFuelLogInput({ date: '2026-07-03', liters: 30, pricePerLiter: 1700 }),
    ).toEqual([]);
  });

  test('requires a valid date', () => {
    expect(
      validateFuelLogInput({ date: '2026/7/3', liters: 30, pricePerLiter: 1700 }),
    ).toContain('주유 날짜 형식은 YYYY-MM-DD 입니다.');
  });

  test('requires positive liters', () => {
    expect(
      validateFuelLogInput({ date: '2026-07-03', liters: 0, pricePerLiter: 1700 }),
    ).toContain('주유량(L)은 0보다 커야 합니다.');
  });

  test('requires a price or an amount', () => {
    expect(validateFuelLogInput({ date: '2026-07-03', liters: 30 })).toContain(
      '리터당 단가 또는 총 주유금액 중 하나는 입력해야 합니다.',
    );
  });
});

describe('createFuelLog', () => {
  test('computes amount from price × liters', () => {
    expect(
      createFuelLog(
        { date: '2026-07-03', liters: 30, pricePerLiter: 1700, odometerKm: 12345 },
        { id: 'f1' },
      ),
    ).toEqual({
      id: 'f1',
      date: '2026-07-03',
      liters: 30,
      pricePerLiter: 1700,
      amount: 51000,
      odometerKm: 12345,
    });
  });

  test('derives unit price from an explicit total amount', () => {
    const log = createFuelLog(
      { date: '2026-07-03', liters: 40, amount: 68000 },
      { id: 'f2' },
    );
    expect(log.amount).toBe(68000);
    expect(log.pricePerLiter).toBe(1700); // 68000 / 40
    expect(log.odometerKm).toBe(0);
  });

  test('throws on invalid input', () => {
    expect(() =>
      createFuelLog({ date: '2026-07-03', liters: 0 }, { id: 'f3' }),
    ).toThrow();
  });
});

describe('applyFuelLogEdit / fuelLogToInput', () => {
  test('edits preserve id and recompute money', () => {
    const original = createFuelLog(
      { date: '2026-07-03', liters: 30, pricePerLiter: 1700 },
      { id: 'f1' },
    );
    const edited = applyFuelLogEdit(original, {
      date: '2026-07-04',
      liters: 20,
      pricePerLiter: 1800,
    });
    expect(edited.id).toBe('f1');
    expect(edited.date).toBe('2026-07-04');
    expect(edited.amount).toBe(36000);
  });

  test('round-trips through fuelLogToInput', () => {
    const log = createFuelLog(
      { date: '2026-07-03', liters: 30, pricePerLiter: 1700, odometerKm: 100 },
      { id: 'f1' },
    );
    expect(fuelLogToInput(log)).toEqual({
      date: '2026-07-03',
      liters: 30,
      pricePerLiter: 1700,
      amount: 51000,
      odometerKm: 100,
    });
  });
});
