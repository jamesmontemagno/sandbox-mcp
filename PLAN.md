# sandbox-mcp — automating Windows Sandbox like devvm.dev

Goal: an MCP server that lets an agent spin up a disposable Windows Sandbox, mount a project,
run commands with real stdout/exit codes, and throw it away — "devvm for Windows".

## What Windows exposes (findings, 2026-11-06)

| API | Status on this box | Notes |
|---|---|---|
| `.wsb` config file (`WindowsSandbox.exe x.wsb`) | ✅ works | MappedFolders, LogonCommand, Networking, vGPU, Memory. One sandbox at a time. |
| `wsb.exe` CLI (`start/list/exec/stop/share/connect/ip`, `--raw` JSON) | ✅ after upgrade | Ships with the **Store** version of Sandbox (24H2+). Launch Sandbox from Start once to auto-upgrade. |
| `wsb exec` | — | **No stdout/stderr capture** (documented). `-r System` avoids needing an RDP session. |
| COM / WMI | none public | The CLI is the only supported control plane. |

## Spike results (`spike/`)

1. Booted via `spike.wsb` (old inbox app) → **~44 s** cold boot to guest agent "ready".
2. **Shared-folder job queue** (`agent.ps1`): works — stdout, exit code, internet (200 from example.com),
   isolation (`D:\github` not visible), runs as `WDAGUtilityAccount`, PowerShell 5.1, no winget/git/node/python.
   But **10–20 s per job** (mapped-folder change visibility latency). Fine for bootstrapping, bad for interactive.
3. **TCP channel** (`tcpserver.ps1` on :5985, host → sandbox IP): **~2 s per call**, almost all of it is
   spawning `powershell.exe` per command. An in-process/runspace server should get to ~tens of ms.

4. **Store Sandbox + `wsb` 0.8.107.0 (installed via WindowsApps alias)** — fully headless, no window:
   - `wsb start --raw` → `{"Id": ...}` in ~3 s (returns before guest is ready; poll `wsb ip`).
   - `wsb ip --raw` → `Networks[0].IpV4Address`; `wsb share` mounts folders into a *running* sandbox (no `.wsb` needed).
   - `wsb exec -r System` works with no logon/RDP session, ~0.7 s, returns `ExitCode` only.
   - Bootstrap = `share` agent folder → `exec -r System` start agent → TCP: agent reachable ~30 s after start.
   - Gotchas: only one sandbox (`CO_E_APPSINGLEUSE` if one is already running); a `start` immediately
     after `stop` silently died — add a settle delay / verify with `wsb list`.

## Architecture

```
Agent ──MCP(stdio)──► sandbox-mcp (host)
                         │  lifecycle: wsb start/stop/ip (fallback: .wsb + WindowsSandbox.exe)
                         │  bootstrap: mapped folder C:\sbx (ro: guest agent, rw: project)
                         └──HTTP/TCP──► guest agent in sandbox (started by LogonCommand or wsb exec -r System)
                                          exec / read_file / write_file / install
```

- Shared folder = **bootstrap + bulk files** (project source, artifacts).
- Network socket = **command channel** (fast, streams output).
- Auth: random token generated per sandbox, written into the read-only mapped folder, required on every call.

## MCP tools (v1)

- `sandbox_start({ projectPath, writable, networking, memoryMB, tools[] })` → id, ip
- `sandbox_exec({ id, command, cwd, timeoutSec })` → stdout, stderr, exitCode
- `sandbox_read_file` / `sandbox_write_file`
- `sandbox_install({ id, packages[] })` — bootstrap winget/git/node/python/dotnet
- `sandbox_screenshot` (optional, for UI testing)
- `sandbox_list`, `sandbox_stop`

## Open questions / risks

- **One sandbox at a time** (Windows Sandbox limit) — no parallel VMs like devvm. Hyper-V VMs would be the escape hatch.
- **Every boot is pristine** → toolchain install cost on each start. Mitigate: cache installers/offline packages in a
  read-only mapped folder; measure how much `winget`-less install costs.
- No winget / Store apps inside (24H2 docs confirm). Need direct installers or zip toolchains.
- Network egress allowlist (devvm's proxy idea): Sandbox only has Networking on/off. Could force a host proxy via
  env vars + guest firewall rules — v2.
- Guest firewall: spike disabled it entirely; v1 should open just the agent port.

## Status (v1 work, 2026-11-06)

Steps 1-3 and 5 below are done and shipped as the MCP server + `sbx` CLI (see README.md). What changed from this plan:

- The guest agent is one persistent PowerShell process (TCP, or a shared-folder mailbox when there's no network), not a
  per-call `powershell.exe`. exec ~1.6 s, file-mailbox round trip ~100 ms.
- The focus moved from "dev VM" to "test my app on a clean machine": `sbx run`, screenshots, native UI Automation,
  crash detection, reports.
- No `sandbox_install` / toolchain caching yet (step 4).

Roadmap: installer change tracking (files/registry/services before vs after), detonation mode for untrusted files,
recorded runs/video, toolchain cache.

## Next steps (original)

1. ~~Upgrade to the Store Sandbox and re-test with `wsb`~~ ✅ done — headless lifecycle confirmed.
2. Replace per-call `powershell.exe` with a persistent runspace HTTP server (measure latency).
3. Build the MCP server (C#/.NET or Node), tools above, against the `wsb` CLI with `.wsb` fallback.
4. Toolchain cache experiment: time to get git + node + dotnet working from a mapped cache.
5. Demo: agent clones a repo into the sandbox, builds, runs tests, returns results, sandbox destroyed.
