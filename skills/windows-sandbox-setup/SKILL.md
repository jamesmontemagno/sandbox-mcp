---
name: windows-sandbox-setup
description: Get Windows Sandbox and the sandbox-mcp tools working on a PC. Use when a sandbox tool or sbx command says "Windows Sandbox isn't ready", when the sandbox_* tools are missing or fail to start, when a sandbox is already running and blocks a new one, or before first use.
---

# Set up Windows Sandbox

Windows Sandbox runs only on **Windows 11 24H2 or later, Pro, Enterprise or Education**. Home and Server editions can't run it, and neither can macOS or Linux hosts. The agent must run on that Windows PC itself.

## Check the PC

Run the read-only check. It never enables features, elevates or restarts anything.

```powershell
sbx doctor
```

If `sbx` isn't on PATH (the plugin only adds MCP tools), use:

```powershell
npx --yes --package=github:shanselman/sandbox-mcp sbx doctor
```

To install the portable package with its bundled Node.js and verified download, follow [the agent setup guide](https://raw.githubusercontent.com/shanselman/sandbox-mcp/main/docs/agent-setup.md). It asks before admin changes or a restart.

Exit code 0 means ready. Exit code 1 lists each problem with its `Fix:` line; add `--json` for structured output. `sandbox_start` and the one-shot tools report the same list when they fail with "Windows Sandbox isn't ready on this PC".

## Fix what it reports

Pass the fixes to the user, in order. They usually need an administrator and a restart, so don't run them yourself or try to work around them.

- **Sandbox feature off:** in an administrator PowerShell, run `Enable-WindowsOptionalFeature -Online -FeatureName Containers-DisposableClientVM -All`, then restart Windows.
- **`wsb` tool missing:** open Windows Sandbox from the Start menu once, then close it. It updates itself from the Microsoft Store, which adds `wsb`.
- **Virtualization off:** turn on Intel VT-x or AMD-V in UEFI/BIOS. Inside a VM, the host must enable nested virtualization.
- **Node.js too old:** `winget install OpenJS.NodeJS.LTS --source winget`, then restart the agent so it sees the new PATH.
- **Home or Server edition:** there is no fix short of a different Windows edition. Tell the user and stop.

## Confirm it works

Call `sandbox_run` with `app: "C:\\Windows\\System32\\charmap.exe"`, or run `sbx run C:\Windows\System32\charmap.exe --open`. It should report PASS in under a minute.

## If the MCP tools don't appear

The plugin starts the server with `cmd /d /c npx --yes github:shanselman/sandbox-mcp#<version>`, which needs Node.js 20 or later on PATH and network access for the first download. Run that command in a terminal to see the error; a working server logs `ready` to stderr and then waits on stdin. Press Ctrl+C to stop it.

## If a sandbox is already running

Windows allows one sandbox at a time. Check with `sandbox_status`. Stop only a guest you own, with `sandbox_stop`. If you don't own it, it may hold someone's work, so ask its owner or the user rather than interrupting it. Only with their approval, call `sandbox_stop` with `force: true`.

## Settings

Set these in the MCP server's environment:

| Variable | Default | Purpose |
|---|---|---|
| `SANDBOX_MCP_HOME` | `%LOCALAPPDATA%\sandbox-mcp` | Where runs, screenshots and reports are kept |
| `SANDBOX_MCP_ALLOWED_ROOTS` | any folder | `;`-separated host folders that may be copied in |
| `SANDBOX_MCP_IDLE_MINUTES` | `30` | Guest shuts down after this long idle; `0` disables |
| `SANDBOX_MCP_KEEP_ON_EXIT` | unset | `1` leaves the sandbox running when the client disconnects |
