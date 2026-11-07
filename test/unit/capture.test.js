import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapCapturePoint } from '../../src/capture.js';

const shot = { captureId: 'one', left: -100, top: 20, width: 1001, height: 501, previewWidth: 500, previewHeight: 250 };
test('capture maps preview to its own bounds, including negative screen origins', () => {
  assert.deepEqual(mapCapturePoint(shot, 250, 125), { x: 401, y: 271 });
});
test('capture rejects missing, nonfinite and out-of-image points', () => {
  assert.throws(() => mapCapturePoint(null, 0, 0), /Unknown captureId/);
  assert.throws(() => mapCapturePoint({ scale: 1, left: 0, top: 0 }, 0, 0), /incomplete capture metadata/);
  for (const [x, y] of [[-1, 0], [500, 0], [0, 250], [NaN, 0], [0, Infinity]]) {
    assert.throws(() => mapCapturePoint(shot, x, y), /outside capture/);
  }
});
