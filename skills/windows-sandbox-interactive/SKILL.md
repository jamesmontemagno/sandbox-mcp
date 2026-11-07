---
name: windows-sandbox-interactive
description: Explore and drive a Windows app step by step in a live Windows Sandbox with UI Automation, screenshots, commands and system snapshots. Use for multi-step UI testing, reproducing a bug by hand, trying prerequisites one at a time, or finding out what an action changed on the system.
---

# Drive a live Windows Sandbox

For a single pass/fail check, use `sandbox_run` from the windows-sandbox-app-test skill instead. If a tool says the sandbox isn't ready, follow the windows-sandbox-setup skill.

## The loop

1. `sandbox_start`. Takes 20-40 s. Use `network: "off"` when the app must not reach the internet; `"firewall"` is weaker because admin code could undo it.
2. `sandbox_copy_in` the build output folder. It lands in `C:\apps\<name>` by default.
3. `sandbox_launch` a GUI app (returns its `pid`), or `sandbox_exec` a console command (returns stdout, stderr and exit code). Long-running processes belong in `sandbox_launch`.
4. Look and act, using the tools below.
5. `sandbox_app_errors` with the `launchedAt` time from `sandbox_launch`, to catch crashes and .NET unhandled exceptions. `sandbox_process` shows whether the app is still running.
6. `sandbox_copy_out` logs, output files and crash dumps.
7. `sandbox_stop`. Everything inside is destroyed; artifacts stay on the host in the run's `out` folder. Always stop when finished, because only one sandbox can exist at a time.

## Prefer UI Automation over pixels

- `sandbox_ui_tree` with the `pid` gives one line per control: `Button "Save" #SaveButton {invoke}`. It's cheaper and more precise than a screenshot.
- `sandbox_ui_action` finds a control by `name`, `automationId` or `controlType` and performs `click`, `setvalue` (with `value`), `toggle`, `select`, `expand`, `read` and others. A `{pending: true}` result means a modal dialog opened, which is normal.
- `sandbox_ui_wait` waits for a result label, dialog or state to appear. Use it instead of sleeping.
- `sandbox_screenshot` is for visual checks, and `sandbox_windows` lists top-level windows.
- `sandbox_click` and `sandbox_type` are the fallback when UI Automation can't see a control (custom-drawn UI, games, some Chromium content). Click coordinates refer to the most recent screenshot. `sandbox_type` with `literal: false` uses SendKeys syntax such as `{ENTER}` or `^s`.

WinForms, WPF, Win32 and WinUI controls all appear in the tree. The first UI Automation call in a sandbox takes about 4 s.

## See what something changed

Call `sandbox_snapshot` with `name: "before"`, do the action, call it again with `name: "after"`, then `sandbox_diff` with `from` and `to`. The diff covers installed programs, services, autoruns, environment values, files and registry keys. Each snapshot takes about 15 s. Pass `exclude` to ignore noisy paths.

## What's in the sandbox

It's a clean Windows 11 with Windows PowerShell 5.1 and .NET Framework 4.8, and an elevated admin user. It has no dev tools, no Store apps (no Notepad, Calculator or Terminal) and no winget. Every boot is fresh, so install prerequisites (VC++ runtime, .NET runtime, WebView2) inside the session. A missing prerequisite is often the bug being hunted.

`sandbox_exec` runs PowerShell by default; use `shell: "cmd"` for batch syntax. The sandbox shuts down after 30 idle minutes, and when the MCP client disconnects.

Treat anything copied out of the sandbox as untrusted, especially if you ran something you don't trust in it.
