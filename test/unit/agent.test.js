// The guest agent runs on Windows PowerShell 5.1, whose Add-Type only compiles C# 5. Catch syntax slips on the host
// instead of in a sandbox that takes 15 s to boot.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../../src/core.js';

const ps = (script) => execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', timeout: 120_000 });
const agent = (f) => path.join(ROOT, 'agent', f);

test('agent PowerShell files parse', () => {
  const files = fs.readdirSync(path.join(ROOT, 'agent')).filter((f) => /\.ps(m?)1$/i.test(f));
  assert.ok(files.length >= 3);
  for (const f of files) {
    const out = ps(`$e = $null; [void][Management.Automation.Language.Parser]::ParseFile('${agent(f)}', [ref]$null, [ref]$e); ($e | ForEach-Object { "$($_.Extent.StartLineNumber): $($_.Message)" }) -join [char]10`);
    assert.equal(out.trim(), '', `${f} has parse errors`);
  }
});

test('snap.cs compiles with Windows PowerShell 5.1 (C# 5)', () => {
  const out = ps(`Add-Type -TypeDefinition ([IO.File]::ReadAllText('${agent('snap.cs')}')) -Language CSharp -ErrorAction Stop; [SbxSnap].Name`);
  assert.equal(out.trim(), 'SbxSnap');
});

test('uia.cs compiles against the UIAutomationCore interop', () => {
  const out = ps(`$m = Import-Module '${agent('SbxUi.psm1')}' -PassThru; & $m { Initialize-SbxUi }; [SbxUia].Name`);
  assert.equal(out.trim().split(/\r?\n/).pop(), 'SbxUia');
});