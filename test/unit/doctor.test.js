import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sandboxChecks, formatChecks, ENABLE_SANDBOX } from '../../src/core.js';

const ready = {
  caption: 'Windows 11 Pro', build: 26100, edition: 'Professional', feature: 1, hypervisor: true, vt: false,
  wsb: 'C:\\Users\\me\\AppData\\Local\\Microsoft\\WindowsApps\\wsb.exe', alias: null, version: '0.8.107.0', node: '22.11.0',
};
const failing = (f) => sandboxChecks(f).filter((c) => !c.ok);

test('a ready PC passes every check', () => {
  const checks = sandboxChecks(ready);
  assert.ok(checks.every((c) => c.ok));
  assert.match(formatChecks(checks), /✅ wsb command-line tool: .*wsb\.exe \(Windows Sandbox 0\.8\.107\.0\)/);
});

test('Home editions stop at the edition check', () => {
  const checks = sandboxChecks({ ...ready, caption: 'Windows 11 Home', edition: 'CoreSingleLanguage', feature: null, wsb: null });
  assert.equal(checks.length, 1);
  assert.match(checks[0].detail, /Home/);
  assert.match(checks[0].fix, /Pro, Enterprise or Education/);
});

test('feature off gives the one-line enable command', () => {
  const bad = failing({ ...ready, feature: 2, hypervisor: false, vt: true, wsb: null, version: '' });
  assert.deepEqual(bad.map((c) => c.detail), ['Windows Sandbox feature is off', "The wsb command-line tool isn't installed"]);
  assert.ok(bad[0].fix.includes(ENABLE_SANDBOX));
  assert.match(bad[1].fix, /Start menu once/);
});

test('virtualization off in firmware, or a restart still pending', () => {
  assert.match(failing({ ...ready, feature: 2, hypervisor: false, vt: false })[1].fix, /VT-x or AMD-V/);
  assert.deepEqual(failing({ ...ready, hypervisor: false, vt: true }).map((c) => c.fix), ['Restart Windows.']);
});

test('old builds, wsb not on PATH, old Node', () => {
  assert.match(failing({ ...ready, build: 22631 })[0].fix, /24H2/);
  assert.equal(failing({ ...ready, wsb: null, alias: 'C:\\Users\\me\\AppData\\Local\\Microsoft\\WindowsApps\\wsb.exe' })[0].fix,
    'Add C:\\Users\\me\\AppData\\Local\\Microsoft\\WindowsApps to PATH.');
  assert.match(failing({ ...ready, node: '18.19.0' })[0].fix, /Node\.js 20/);
});
