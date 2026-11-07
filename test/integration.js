// Real CLI/MCP interoperability proof. Acquire the host's Sandbox coordination lock before running.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtimeRoot = process.env.SANDBOX_MCP_TEST_ROOT ? path.resolve(process.env.SANDBOX_MCP_TEST_ROOT) : root;
const execute = promisify(execFile);
const network = process.argv[2] || 'off';
assert.ok(['off', 'on'].includes(network), 'Usage: node test/integration.js [off|on]');
assert.ok(process.env.SANDBOX_MCP_HOME, 'Set a lane-specific SANDBOX_MCP_HOME before running.');
const evidenceDir = path.join(process.env.SANDBOX_MCP_HOME, 'integration');
fs.mkdirSync(evidenceDir, { recursive: true });
const evidence = { network, runtimeRoot, runtime: process.execPath, startedAt: new Date().toISOString(), checks: [] };
const record = (name, detail) => {
  evidence.checks.push({ name, detail });
  console.log(`ok ${name}${detail ? `: ${JSON.stringify(detail)}` : ''}`);
};
const save = () => fs.writeFileSync(path.join(evidenceDir, `${network}.json`), JSON.stringify(evidence, null, 2));
async function cli(...args) {
  const { stdout } = await execute(process.execPath, [path.join(runtimeRoot, 'src', 'cli.js'), ...args, '--json'], {
    cwd: runtimeRoot, timeout: 600_000, maxBuffer: 8 * 1024 * 1024, windowsHide: true,
  });
  return JSON.parse(stdout);
}
const client = new Client({ name: 'integration-proof', version: '1.0.0' });
let connected = false;
let ownedId;
async function call(name, args = {}) {
  const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 180_000 });
  const text = result.content.filter((part) => part.type === 'text').map((part) => part.text).join('\n');
  assert.ok(!result.isError, `${name}: ${text}`);
  return { result, text };
}
const json = async (name, args) => JSON.parse((await call(name, args)).text);

try {
  evidence.sha = process.env.SANDBOX_MCP_TEST_SHA || (await execute('git', ['rev-parse', 'HEAD'], { cwd: root })).stdout.trim();
  if (process.env.SANDBOX_MCP_EXPECT_NO_HOST_NODE === '1') {
    const lookup = await execute('where.exe', ['node'], { timeout: 10_000 }).then(
      (result) => ({ code: 0, stdout: result.stdout }),
      (error) => ({ code: error.code, stdout: error.stdout }),
    );
    assert.equal(lookup.code, 1, `Host Node is visible on PATH: ${lookup.stdout}`);
    assert.equal(path.resolve(process.execPath), path.join(runtimeRoot, 'node.exe'));
    record('bundled runtime with host Node absent from PATH');
  }
  await execute('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
    path.join(root, 'samples', 'HelloSandbox', 'build.ps1')], { cwd: root, timeout: 60_000 });
  await client.connect(new StdioClientTransport({
    command: process.execPath, args: [path.join(runtimeRoot, 'src', 'server.js')], stderr: 'inherit', env: { ...process.env },
  }));
  connected = true;
  const tools = (await client.listTools()).tools;
  record('MCP stdio initialization', tools.map((tool) => tool.name));
  const boot = network === 'off'
    ? await cli('start', '--network', network, '--minimized')
    : await json('sandbox_start', { network, window: 'minimized' });
  ownedId = boot.id;
  evidence.runDir = boot.runDir;
  record('fresh guest started', { id: boot.id, bootSeconds: boot.bootSeconds, runDir: boot.runDir });
  assert.equal((await json('sandbox_status')).id, ownedId);
  assert.equal((await cli('status')).id, ownedId);
  record('CLI and MCP share one guest');
  if (network === 'off') {
    const adapters = await call('sandbox_exec', { command: '@(Get-NetAdapter -ErrorAction SilentlyContinue).Count' });
    assert.match(adapters.text.trim(), /--- stdout ---\r?\n0$/);
    record('offline guest has no network adapter');
  }
  await call('sandbox_copy_in', {
    hostPath: path.join(root, 'samples', 'HelloSandbox', 'bin'), sandboxPath: 'C:\\apps\\integration',
  });
  const launched = await json('sandbox_launch', { path: 'C:\\apps\\integration\\HelloSandbox.exe', waitForWindowSec: 20 });
  assert.ok(launched.pid > 0);
  const tree = await call('sandbox_ui_tree', { pid: launched.pid });
  assert.match(tree.text, /#GreetButton/);
  await call('sandbox_ui_action', { pid: launched.pid, automationId: 'NameBox', action: 'setvalue', value: `Integration ${network}` });
  await call('sandbox_ui_action', { pid: launched.pid, automationId: 'GreetButton', action: 'click' });
  await call('sandbox_ui_wait', {
    pid: launched.pid, automationId: 'Output', name: `Hello, Integration ${network}!`, timeoutSec: 10,
  });
  const copied = await json('sandbox_copy_out', { sandboxPath: 'C:\\apps\\integration\\greeting.txt', name: `greeting-${network}.txt` });
  assert.equal(fs.readFileSync(copied.hostPath, 'utf8'), `Hello, Integration ${network}!`);
  record('WinForms UIA and durable copied evidence', copied.hostPath);
  const capture = await call('sandbox_screenshot', { pid: launched.pid, name: `integration-${network}`, maxWidth: 400 });
  assert.ok(capture.result.content.some((part) => part.type === 'image' && part.data.length > 100));
  record('MCP image and screenshot artifact', capture.text);
  const statuses = await Promise.all([json('sandbox_status'), cli('status'), json('sandbox_windows')]);
  assert.equal(statuses[0].id, ownedId);
  assert.equal(statuses[1].id, ownedId);
  assert.ok(statuses[2].some((window) => window.title === 'Hello Sandbox'));
  record('concurrent CLI and MCP readers');
} catch (error) {
  evidence.error = error.stack;
  console.error(error);
  process.exitCode = 1;
} finally {
  try {
    if (ownedId) {
      const state = await cli('status');
      assert.equal(state.id, ownedId, 'Refusing to stop a guest not started by this test.');
      const stopped = await cli('stop');
      assert.ok(stopped.stopped.includes(ownedId));
      const { stdout } = await execute('wsb.exe', ['list', '--raw'], { timeout: 30_000 });
      assert.equal((JSON.parse(stdout).WindowsSandboxEnvironments || []).length, 0, 'Guest teardown left a Sandbox running.');
      record('owned guest stopped and wsb list empty');
    }
  } catch (error) {
    evidence.teardownError = error.stack;
    console.error(error);
    process.exitCode = 1;
  }
  if (connected) await client.close();
  evidence.finishedAt = new Date().toISOString();
  evidence.pass = !evidence.error && !evidence.teardownError;
  save();
}
