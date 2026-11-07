import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapCapturePoint, captureFile } from '../../src/capture.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

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

test('capture filenames cannot read or delete an outside tripwire or follow reparse paths', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx-capture-path-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const directory = path.join(root, 'screenshots');
  fs.mkdirSync(directory);
  const tripwire = path.join(root, 'tripwire.png');
  fs.writeFileSync(tripwire, 'untouched');
  for (const name of ['..\\tripwire.png', '../tripwire.png', tripwire, '\\\\server\\share\\x.png', 'x.png:stream', 'CON.png', 'x.txt']) {
    assert.throws(() => captureFile(directory, name), /PNG leaf/);
  }
  fs.symlinkSync(root, path.join(directory, 'linked'), 'junction');
  assert.throws(() => captureFile(path.join(directory, 'linked'), 'tripwire.png'), /reparse point/);
  fs.symlinkSync(tripwire, path.join(directory, 'linked.png'));
  assert.throws(() => captureFile(directory, 'linked.png'), /reparse point/);
  assert.equal(fs.readFileSync(tripwire, 'utf8'), 'untouched');
  fs.writeFileSync(path.join(directory, 'valid.preview.png'), 'png');
  assert.equal(captureFile(directory, 'valid.preview.png'), path.join(directory, 'valid.preview.png'));
  assert.throws(() => captureFile(path.join(directory, 'linked', 'screenshots'), 'tripwire.png'), /reparse point/,
    'a reparse ancestor is rejected, not just the final directory');
});

test('capture allows legitimate Windows 8.3 directory aliases without treating them as reparse escapes', () => {
  const short = 'C:\\PROGRA~1';
  assert.ok(fs.existsSync(short), 'Windows Program Files short alias is required for this Windows-only regression.');
  const canonical = fs.realpathSync.native(short);
  assert.notEqual(short.toLowerCase(), canonical.toLowerCase());
  assert.ok(!fs.lstatSync(short).isSymbolicLink());
  assert.equal(captureFile(short, 'pending-proof.png'), path.join(short, 'pending-proof.png'));
  assert.equal(captureFile(canonical, 'pending-proof.png'), path.join(canonical, 'pending-proof.png'));
});
