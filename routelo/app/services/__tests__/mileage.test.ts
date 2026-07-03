import {
  applyMileageLogEdit,
  createMileageLog,
  mileageLogToInput,
  validateMileageLogInput,
} from '../mileage';

describe('validateMileageLogInput', () => {
  test('accepts a valid input', () => {
    expect(
      validateMileageLogInput({
        date: '2026-07-03',
        odometerKm: 12345,
        dailyDistanceKm: 80,
      }),
    ).toEqual([]);
  });

  test('requires a valid date', () => {
    expect(
      validateMileageLogInput({ date: '2026/7/3', odometerKm: 100 }),
    ).toContain('기록 날짜 형식은 YYYY-MM-DD 입니다.');
  });

  test('requires a non-negative finite odometer', () => {
    expect(
      validateMileageLogInput({ date: '2026-07-03', odometerKm: -1 }),
    ).toContain('누적 주행거리(km)는 0 이상의 숫자여야 합니다.');
    expect(
      validateMileageLogInput({ date: '2026-07-03', odometerKm: Number.NaN }),
    ).toContain('누적 주행거리(km)는 0 이상의 숫자여야 합니다.');
  });

  test('rejects a negative daily distance', () => {
    expect(
      validateMileageLogInput({
        date: '2026-07-03',
        odometerKm: 100,
        dailyDistanceKm: -5,
      }),
    ).toContain('일일 주행거리(km)는 0 이상이어야 합니다.');
  });
});

describe('createMileageLog / applyMileageLogEdit / mileageLogToInput', () => {
  test('creates with a default daily distance', () => {
    expect(
      createMileageLog({ date: '2026-07-03', odometerKm: 12345 }, { id: 'm1' }),
    ).toEqual({
      id: 'm1',
      date: '2026-07-03',
      odometerKm: 12345,
      dailyDistanceKm: 0,
    });
  });

  test('edits preserve id', () => {
    const original = createMileageLog(
      { date: '2026-07-03', odometerKm: 100, dailyDistanceKm: 40 },
      { id: 'm1' },
    );
    const edited = applyMileageLogEdit(original, {
      date: '2026-07-04',
      odometerKm: 180,
      dailyDistanceKm: 80,
    });
    expect(edited.id).toBe('m1');
    expect(edited).toMatchObject({
      date: '2026-07-04',
      odometerKm: 180,
      dailyDistanceKm: 80,
    });
  });

  test('round-trips through input', () => {
    const log = createMileageLog(
      { date: '2026-07-03', odometerKm: 100, dailyDistanceKm: 40 },
      { id: 'm1' },
    );
    expect(mileageLogToInput(log)).toEqual({
      date: '2026-07-03',
      odometerKm: 100,
      dailyDistanceKm: 40,
    });
  });

  test('throws on invalid input', () => {
    expect(() =>
      createMileageLog({ date: '2026-07-03', odometerKm: -1 }, { id: 'm2' }),
    ).toThrow();
  });
});
