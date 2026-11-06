# sandbox-mcp

**Fresh, throwaway Windows machines for testing your apps.** One command (or one MCP tool call) boots a clean
Windows 11 in [Windows Sandbox](https://learn.microsoft.com/windows/security/application-security/application-isolation/windows-sandbox/),
copies your build in, runs it, drives its UI, screenshots it, checks for crashes, copies the results out and
deletes the machine. About 35 seconds, start to finish.

```text
> sbx run .\samples\HelloSandbox\bin --test .\samples\HelloSandbox\test.ps1

[sbx] booting a fresh Windows Sandbox (network on)
[sbx] started 4ebd5e89-0df5-457e-b15e-70f48dce0591
[sbx] ip 172.25.229.32
[sbx] folders shared
[sbx] user session ready
[sbx] agent up as 6CB5E6E5-FD41-4\WDAGUtilityAccount
[sbx] copying D:\github\sandbox-mcp\samples\HelloSandbox\bin to C:\apps\HelloSandbox
[sbx] running HelloSandbox.exe
[sbx] running test test.ps1
[sbx] destroying the sandbox
PASS  HelloSandbox.exe on a fresh Windows Sandbox (37.4s)
  sandbox  network on, booted in 14.9s
  process  still running, window "Hello Sandbox"
  crashes  none
  test     test.ps1 passed
  shots    3 screenshot(s)
  report   C:\Users\you\AppData\Local\sandbox-mcp\runs\20261106-190012\out\report.md
```

The test script typed a name into the app with UI Automation, clicked **Greet** and waited for the answer. This is the
screenshot it brought back from inside the sandbox:

![HelloSandbox in a fresh Windows Sandbox after its test](docs/hello-after-test.png)

It's both:

- an **MCP server** so AI agents (GitHub Copilot, Claude, Cursor, VS Code, ...) can test the apps they just built
  on a machine that isn't yours, and
- a **CLI (`sbx`)** for you, your scripts and your CI.

They share state, so you can `sbx start`, let an agent poke at the app, then `sbx stop`.

## Why

"It works on my machine" is usually true: your machine has every runtime, SDK, redistributable, font, registry key
and PATH entry you ever installed. Your users' machines don't. Windows Sandbox is a pristine Windows that boots in
seconds and is **deleted** when it closes, which makes it the perfect "brand-new customer PC". But it has no API:
it was built for a person clicking around. sandbox-mcp makes it scriptable.

|                              | sandbox-mcp (Windows Sandbox)       | Hyper-V / VMware VM        | Windows containers           | Cloud dev VMs (devvm, Codespaces, Dev Box) |
|------------------------------|-------------------------------------|----------------------------|------------------------------|--------------------------------------------|
| Real Windows desktop + GUI   | ✅                                  | ✅                         | ❌ no desktop                 | Linux mostly / ✅ (Dev Box)                 |
| Clean state every run        | ✅ always, by design                | snapshots to manage        | ✅                            | ❌ persistent                               |
| Startup                      | ~15 s                               | minutes                    | seconds                      | minutes                                    |
| Images to build or download  | none (uses your installed Windows)  | a 20+ GB VHD               | multi-GB base images         | none, but it's someone else's computer     |
| Cost                         | free with Windows Pro/Enterprise    | free-ish + disk            | free                         | 💸                                          |
| Runs offline / local         | ✅                                  | ✅                         | ✅                            | ❌                                          |
| Parallel instances           | ❌ one at a time                    | ✅                         | ✅                            | ✅                                          |
| Persistent environment       | ❌                                  | ✅                         | via volumes                  | ✅                                          |

If you need many machines, persistence, or Linux, use a VM or a cloud box. If you want to know *"does my Windows app
install, launch and work on a clean PC, and what does it look like?"* as quickly and cheaply as possible, this is it.

## What you can do

- **Clean-machine smoke tests:** does the exe even start without the VC++ runtime / .NET runtime / WebView2 you
  forgot to bundle? `sbx run` tells you, with a screenshot and the crash events.
- **Drive the UI with UI Automation, not pixels:** read the control tree (`Button "Save" #SaveButton {invoke}`),
  set text, click, toggle, select, wait for results. Works for WinForms, WPF, Win32 and WinUI apps, and things like
  File Explorer. Screenshots, mouse and keyboard are there for everything else.
- **Let an agent close the loop:** "build it, test it on a clean machine, look at the screenshot, fix it, repeat",
  without the agent touching your real desktop.
- **Run things with no network at all:** `--network off` boots the sandbox with no network adapter. Control still
  works (through a shared folder), so you can watch an app's offline behavior or open something you don't trust.
- **Collect evidence:** every run keeps screenshots, copied-out files, a markdown report and an audit log on the
  host after the sandbox is gone.

## Requirements

- Windows 11 24H2 or later, Pro / Enterprise / Education (Windows Sandbox isn't available on Home).
- Windows Sandbox enabled: `Enable-WindowsOptionalFeature -Online -FeatureName Containers-DisposableClientVM`
  (as admin, then reboot), or *Turn Windows features on or off* > *Windows Sandbox*.
- **Launch Windows Sandbox from the Start menu once.** That updates it to the Store version, which includes the
  `wsb` command-line tool this project drives. Check with `wsb --version`.
- Node.js 20+.

## Quick start

```powershell
git clone https://github.com/shanselman/sandbox-mcp
cd sandbox-mcp
npm install
npm link            # puts `sbx` and `sandbox-mcp` on your PATH (or use `node src/cli.js`)

sbx run C:\Windows\System32\charmap.exe --open     # try it on something that exists everywhere
```

Try the included sample (needs nothing but Windows; it compiles with the .NET Framework's `csc.exe`):

```powershell
.\samples\HelloSandbox\build.ps1
sbx run .\samples\HelloSandbox\bin --test .\samples\HelloSandbox\test.ps1   # passes
sbx run .\samples\HelloSandbox\bin --args --crash                            # fails, and shows the crash
```

### Use it from an agent (MCP)

Add the server to your MCP client. For example VS Code (`.vscode/mcp.json`) or GitHub Copilot CLI
(`~/.copilot/mcp-config.json`):

```json
{
  "servers": {
    "windows-sandbox": {
      "type": "stdio",
      "command": "node",
      "args": ["C:\\path\\to\\sandbox-mcp\\src\\server.js"]
    }
  }
}
```

(Claude Desktop and others use `"mcpServers"` instead of `"servers"`. After `npm link` you can use
`"command": "sandbox-mcp"` with no args.)

Then ask: *"Build the app, run it in a fresh Windows Sandbox, type my name in the box, click Greet and show me a
screenshot."*

There's also an agent skill in [`skills/windows-sandbox-app-test`](skills/windows-sandbox-app-test/SKILL.md) that
teaches agents the workflow; copy it into your agent's skills folder (for example `~/.copilot/skills/`).

## MCP tools

| Tool | What it does |
|---|---|
| `sandbox_run` | The whole loop in one call: boot, copy in, launch or run, observe, test script, collect, destroy, report. |
| `sandbox_start` | Boot a fresh sandbox (`network`: on / firewall / off, `memoryMB`, `vGpu`). Waits until the guest agent answers. |
| `sandbox_status` | Is one running, its id/IP/network mode, is the agent healthy. |
| `sandbox_stop` | Destroy it. Lists the artifacts left on the host. |
| `sandbox_copy_in` | Copy a host file or folder in (default `C:\apps\<name>`). |
| `sandbox_copy_out` | Copy a sandbox file or folder out to the run's `out\files`. |
| `sandbox_exec` | Run a PowerShell (or `cmd`) command; returns stdout, stderr, exit code. |
| `sandbox_launch` | Start a GUI app without waiting; returns pid and main window. |
| `sandbox_process` | Running? Exit code? Window title? |
| `sandbox_windows` | Visible top-level windows with titles, pids and bounds. |
| `sandbox_screenshot` | PNG of the desktop or one window, returned inline (and saved on the host). |
| `sandbox_click` / `sandbox_type` | Mouse and keyboard, in screenshot coordinates / SendKeys syntax. |
| `sandbox_ui_tree` | The UI Automation tree of a window: type, name, automation id, value, state, supported actions. |
| `sandbox_ui_action` | Find a control by name / automation id / type and click, set a value, toggle, select, expand, read... |
| `sandbox_ui_wait` | Wait for a control (a result, a dialog) to appear. |
| `sandbox_app_errors` | Application event log errors: crashes, hangs, .NET unhandled exceptions. |

## CLI

```text
sbx run <app.exe|folder> [--exe <name>] [--args "<args>"] [--console] [--wait <sec>]
                         [--test <script.ps1>] [--collect <sandbox path>]... [--keep] [--open]

sbx start [--network on|firewall|off] [--memory <MB>] [--no-gpu] [--minimized]
sbx push <host path> [sandbox path]          sbx pull <sandbox path> [name]
sbx exec [--cmd] [--cwd <dir>] <command...>  sbx launch <exe> [--args "..."]
sbx shot [--window <title>|--pid <pid>]      sbx windows   sbx proc <pid>
sbx ui [tree] [--pid <pid>]                  sbx ui click --name Save
sbx ui set --id NameBox --value Scott        sbx ui wait --name "Saved" --timeout 10
sbx click <x> <y>   sbx type "text" [--keys] sbx errors   sbx status   sbx stop
sbx mcp                                      # run the MCP server
```

Add `--json` to any command for machine-readable output. `sbx exec` and `sbx run` exit with meaningful codes, so they
drop straight into scripts. `sbx help` has the details.

## Test scripts

`sbx run --test smoke.ps1` (or `sandbox_run` with `testScript`) runs your script **inside** the sandbox after the app
starts, with:

- `$env:SBX_APP_PID`, `$env:SBX_APP_DIR`, `$env:SBX_OUT` (anything you write to `SBX_OUT` comes back to the host),
- these commands already imported:

```powershell
Get-SbxUiTree [-ProcessId <pid>] [-WindowTitle <title>] [-Depth <n>]     # objects: type, name, automationId, value, actions...
Invoke-SbxUi  -Action <click|setvalue|toggle|select|expand|read|...> [-Name <text>] [-AutomationId <id>]
              [-ControlType <Button|Edit|...>] [-Index <n>] [-Value <text>] [-ProcessId <pid>]
Wait-SbxUi    [-Name <text>] [-AutomationId <id>] [-ControlType <type>] [-TimeoutSec <n>] [-ProcessId <pid>]
```

Throw, or exit non-zero, to fail the run. Example ([samples/HelloSandbox/test.ps1](samples/HelloSandbox/test.ps1)):

```powershell
$app = [int]$env:SBX_APP_PID
Invoke-SbxUi -ProcessId $app -AutomationId NameBox -Action setvalue -Value 'Sandbox'
Invoke-SbxUi -ProcessId $app -Name Greet -Action click
Wait-SbxUi   -ProcessId $app -Name 'Hello, Sandbox!' -TimeoutSec 5 | Out-Null
```

## Network modes

| Mode | How | Use it for |
|---|---|---|
| `on` (default) | Normal NAT networking. | Apps that need the internet, downloading prerequisites. |
| `firewall` | Guest firewall blocks all outbound traffic (DNS included); only the control channel from the host is allowed. | Testing offline behavior quickly. Admin code in the guest *could* undo it. |
| `off` | The sandbox has **no network adapter**. sandbox-mcp talks to it through a shared-folder mailbox (~100 ms per call). | Untrusted files, malware-ish things, and proving an app works with no network at all. |

## Security notes

- Each sandbox is a separate Hyper-V-isolated kernel. It's thrown away on stop, together with everything that ran in it.
- Hardened defaults: clipboard, printer, microphone and camera redirection are off, and *Protected Client* mode is on.
- The host shares exactly three folders: the guest agent (read-only), a staging folder for files you copy in
  (read-only) and an output folder (read-write). Nothing else from your disk is visible.
- The control channel needs a random per-sandbox token. In `on`/`firewall` mode it's TCP to the sandbox's private
  NAT address; in `off` mode it's the shared folder.
- `SANDBOX_MCP_ALLOWED_ROOTS` limits which host folders can be copied in (handy when an agent is driving).
- Every operation is appended to `audit.jsonl` in the run folder.
- When the MCP client disconnects, the sandbox is destroyed. An idle watchdog inside the guest shuts it down after
  30 minutes with no calls.
- With `network: on` the guest has internet access like any other machine on your network's NAT. Use `off` for
  anything you don't trust.

## Configuration

| Environment variable | Default | |
|---|---|---|
| `SANDBOX_MCP_HOME` | `%LOCALAPPDATA%\sandbox-mcp` | Where runs, screenshots and reports are kept. |
| `SANDBOX_MCP_ALLOWED_ROOTS` | (any) | `;`-separated host folders that may be copied into the sandbox. |
| `SANDBOX_MCP_IDLE_MINUTES` | `30` | Guest shuts itself down after this long with no calls. `0` disables. |
| `SANDBOX_MCP_KEEP_ON_EXIT` | (unset) | Set to `1` to leave the sandbox running when the MCP client disconnects. |

## How it works

Windows Sandbox has no COM or WMI API. Since Windows 11 24H2 its Store version ships `wsb.exe`
(`start / stop / list / ip / exec / share / connect`), but `wsb exec` returns only an exit code: no output, no
screenshots, no UI. So:

1. The host creates a run folder and calls `wsb start` with a hardened config (and `<Networking>Disable` in `off` mode).
2. It shares the guest agent folder and starts [`agent/agent.ps1`](agent/agent.ps1) inside with `wsb exec`, in the
   interactive user session (it needs a desktop for windows and screenshots).
3. The agent is a small PowerShell server: exec with real output, file copy, process launch, screenshots, mouse and
   keyboard, window list, event log, and UI Automation through [`agent/uia.cs`](agent/uia.cs). That uses *native* UI
   Automation (the managed `System.Windows.Automation` can't see inside WinForms apps), with an interop assembly
   generated on the fly from the OS type library, so nothing needs installing.
4. With the network on, the host talks to it over TCP. In `off` mode it uses a mailbox in the shared folders.
   (The guest caches "file not found" for ~5 s, so the host bumps a sequence file the guest polls, bringing a round
   trip from 5 s down to ~100 ms.)
5. `wsb stop` destroys the VM. The run folder stays on the host.

## Limits

- **One sandbox at a time.** That's a Windows Sandbox rule. `sbx run` calls queue nothing; they fail fast if one is running.
- Every boot is pristine, so prerequisites get installed every time (that's the point, but it costs time).
- No Microsoft Store apps, winget, Notepad, Calculator or Windows Terminal inside. Windows PowerShell 5.1 and
  .NET Framework 4.8 are there.
- The first UI Automation call in a sandbox takes ~4 s (it generates the interop); later calls are fast.
- Needs a logged-in Windows session on the host (Windows Sandbox is a desktop feature).

## Related projects

- [fmuecke/windows-sandbox-mcp](https://github.com/fmuecke/windows-sandbox-mcp) is another MCP server for Windows
  Sandbox, focused on running agent-generated code safely and with `Networking Disable` by default. Its ideas
  (true offline by default, stop on disconnect, an idle watchdog, an audit log, allowed folders) shaped this
  project. sandbox-mcp leans the other way: testing *your* app on a clean machine, with UI Automation, screenshots
  and one-shot reports.
- [devvm.dev](https://devvm.dev/): disposable cloud dev machines for agents. The inspiration for "just give the agent a fresh box".

## License

[MIT](LICENSE)
