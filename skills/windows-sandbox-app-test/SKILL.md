---
name: windows-sandbox-app-test
description: Test a Windows desktop or console app, or its installer, on a fresh, throwaway Windows machine (Windows Sandbox) through the sandbox-mcp tools or the sbx CLI. Use when asked to "try my build on a clean machine", check that an exe runs without the dev box's installed runtimes, smoke-test a GUI with screenshots and UI Automation, check what an installer changes or what its uninstaller leaves behind, find out what an untrusted file or script does when run, reproduce "works on my machine" bugs, or run something risky where it can't touch the real PC.
---

# Testing apps in Windows Sandbox

Windows Sandbox is a clean Windows 11 VM that boots in ~15-20 s and is **destroyed on stop**. Only **one** can run at a
time. Nothing from the host is installed in it: no dev tools, no Store apps (no Notepad, Calculator, Terminal),
no winget. It has Windows PowerShell 5.1 and .NET Framework 4.8. Treat it like a brand-new customer PC.

## Pick the shortest path

1. **"Does my build run on a clean machine?"** -> `sandbox_run` (or `sbx run <app.exe|folder>`). One call boots,
   copies the app in, launches it, screenshots it, checks the event log for crashes, optionally runs a test script,
   copies files out, destroys the sandbox and writes `report.md`. `pass` / the exit code is the verdict.
2. **"Does my installer work? Does the uninstaller clean up?"** -> `sandbox_install_test` (or
   `sbx install-test setup.msi`). Snapshots, installs silently, snapshots, uninstalls via Add/Remove Programs,
   snapshots, and reports what was added and what was left behind (files, registry, services, tasks, autoruns).
   `.msi` gets `/qn` automatically; for `.exe` pass the silent switch in `args` (`/S` NSIS, `/VERYSILENT` Inno).
   A hung install comes back with a screenshot of the dialog it was waiting on.
3. **"What does this file do? Is it safe to run?"** -> `sandbox_detonate` (or `sbx detonate <file>`). Runs it with no
   network (by default), Windows auditing on, and reports processes with command lines, names looked up, connections
   tried (`network: "firewall"` to see addresses), autoruns, scheduled tasks, services and files it planted, plus
   screenshots and findings. Findings are heuristics: tell the user what it did, not "it's safe".
4. **Interactive exploration or multi-step UI testing** -> `sandbox_start`, the step tools below, `sandbox_stop`.
   `sandbox_snapshot` before and after anything + `sandbox_diff` shows what it changed on the system.

## Step-by-step loop

1. `sandbox_start` (`network: "off"` when the app must not reach the internet; `"firewall"` is weaker).
2. `sandbox_copy_in` the build output folder (it lands in `C:\apps\<name>` by default).
3. `sandbox_launch` the exe (GUI) or `sandbox_exec` it (console; returns stdout/stderr/exit code).
4. Look and drive, **preferring UI Automation over pixels**:
   - `sandbox_ui_tree` with the pid -> one line per control: `Button "Save" #SaveButton {invoke}`.
   - `sandbox_ui_action` by `name` / `automationId` / `controlType`: `click`, `setvalue` (+ `value`), `toggle`,
     `select`, `expand`, `read`, ... Returns `{pending:true}` if a modal dialog opened; that is normal.
   - `sandbox_ui_wait` for a result label, dialog or state to appear.
   - `sandbox_screenshot` for visual checks; `sandbox_click` / `sandbox_type` only when UIA can't see the control
     (custom-drawn, games, some Chromium content). Click coordinates refer to the last screenshot.
5. `sandbox_app_errors` (since `launchedAt`) to catch crashes and .NET unhandled exceptions.
6. `sandbox_copy_out` logs, output files, crash dumps.
7. `sandbox_stop`. Everything inside is gone; artifacts stay on the host in the run's `out` folder.

## Tips

- If a tool says "Windows Sandbox isn't ready on this PC", pass its fix list on to the user (it usually needs an
  admin command and a restart); don't try to work around it. `sbx doctor` re-checks.
- One sandbox at a time: if `sandbox_start` says one is running, stop it (or ask the user if it isn't ours).
- Boot is fresh every time, so install prerequisites (VC++ runtime, .NET runtime, WebView2) inside the run if the
  app needs them; a missing prerequisite is often exactly the bug being hunted.
- `sandbox_exec` runs Windows PowerShell 5.1 as an admin user in the interactive session. Use `shell: "cmd"` for
  batch syntax. Long-running or GUI processes belong in `sandbox_launch`.
- In `sbx run --test script.ps1`, the script runs inside the sandbox with `$env:SBX_APP_PID`, `$env:SBX_APP_DIR`,
  `$env:SBX_OUT` and the `Invoke-SbxUi`, `Wait-SbxUi`, `Get-SbxUiTree` commands already imported. Throw or exit
  non-zero to fail.
- WinForms, WPF, Win32 and WinUI controls all show up in the UI tree (native UI Automation is used).
- The sandbox shuts itself down after 30 idle minutes, and when the MCP client disconnects.
