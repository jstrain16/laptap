import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatWait, untilMidnight } from './countdown.ts';

test('the countdown runs to the next local midnight', () => {
  const now = new Date(2026, 9, 12, 17, 20); // 5:20 pm local
  assert.equal(untilMidnight(now), (6 * 60 + 40) * 60_000);
  assert.equal(formatWait(untilMidnight(now)), '6h 40m');
  // One second to midnight.
  assert.equal(formatWait(untilMidnight(new Date(2026, 9, 12, 23, 59, 59))), '1m');
  assert.equal(formatWait(0), 'under a minute');
  assert.equal(formatWait(untilMidnight(new Date(2026, 9, 12, 23, 48))), '12m');
  // Across the end of a month and a DST change, it is still the next calendar day.
  assert.equal(untilMidnight(new Date(2026, 9, 31, 23, 0)), 60 * 60_000);
  assert.ok(untilMidnight(new Date(2026, 10, 1, 0, 30)) > 20 * 3_600_000);
});
