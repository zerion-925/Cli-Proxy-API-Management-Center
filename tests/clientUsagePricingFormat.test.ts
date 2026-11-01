import { expect, test } from 'bun:test';
import { formatEstimatedUsd } from '../src/features/dashboard/pricing';

test('USD estimate formatting preserves unknown, free and tiny positive amounts', () => {
  expect(formatEstimatedUsd(null, 'en', 'unavailable')).toBe('unavailable');
  expect(formatEstimatedUsd(0, 'en', 'unavailable')).toContain('0.00');
  expect(formatEstimatedUsd(0.000000001, 'en', 'unavailable')).toStartWith('<');
  expect(formatEstimatedUsd(0.024, 'en', 'unavailable')).toContain('0.024');
});
