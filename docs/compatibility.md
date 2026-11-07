# What has actually run in Windows Sandbox?

sandbox-mcp is framework-neutral: the input is a Windows executable, installer, script or app package, not a
WinUI project. That does **not** mean every Windows app can run in Sandbox. This page records concrete builds
and observations rather than turning a list of frameworks into a support guarantee.

## Measured results

Measured **2026-11-07 UTC** (2026-11-06 Pacific), Windows 11 guest **10.0.26100.0**, x64. Each measured row used its own
fresh guest, `--network off` (shared-folder mailbox), default five-second settle, a sample UIA test, screenshots
and application-error checks, followed by teardown. No SDK, shared modern .NET runtime, shared Windows App SDK
runtime or VC++ redistributable was installed in the guest. App-local self-contained payloads are part of the build.
Total time includes boot, copy/install, test and teardown, but not the host build.

| App type / sample | Packaging | Result | Boot / total | Evidence and notes |
|---|---|---|---|---|
| WinForms / HelloSandbox | .NET Framework 4.8 EXE | PASS | 15.6 / 41.9 s | [After test](compatibility/hello.png): type a name, invoke Greet, compare label with saved file. Uses inbox Framework. |
| WPF / Wpf | .NET 10.0.14 self-contained x64 EXE | PASS | 16.7 / 45.6 s | [After test](compatibility/wpf.png): invoke Greet, wait for the output TextBlock. |
| WinForms / WinForms | .NET 10.0.14 self-contained x64 EXE | PASS | 16.6 / 45.0 s | [After test](compatibility/winforms.png): invoke Greet, wait for the output label. |
| Native Win32 / NativeWin32 | x64 EXE, static CRT (`/MT`) | PASS | 16.1 / 41.6 s | [After test](compatibility/native.png): native button invocation and text assertion; no VC++ redist needed. |
| Native Win32 / NativeWin32 | Dev-signed MSIX, x64 | PASS | 18.0 / 48.2 s | [After test](compatibility/native-msix.png): guest-only public certificate trust, Add-AppxPackage, AUMID activation, same UIA test against the actual app PID. |
| WinUI 3 / HelloWinUI | .NET 10.0.14 + Windows App SDK 2.6.5 self-contained EXE | PASS | 14.4 / 42.7 s | [After test](compatibility/winui.png): greeting, counter and blank-name fallback through native UIA. |
| WinUI 3 / HelloWinUI | Same self-contained payload, dev-signed MSIX | PASS | 12.7 / 45.4 s | [After test](compatibility/winui-msix.png): `sandbox_run` over MCP, certificate trust, AUMID activation and the same UIA assertions. |
| Framework-dependent modern .NET variants | EXE plus explicitly provisioned runtime | Pending provisioning integration | Not measured | Not a pass or a compatibility failure; the clean baseline deliberately does not install these runtimes. |

Passing rows have **three screenshots, UIA test exit 0, a live app window and zero matching crash events**.
The WinUI MSIX row exercised the MCP server end-to-end; the other rows used the CLI.
The [machine-readable observations](compatibility/results.json) contain exact times, separate Sandbox IDs,
test output, package identity when applicable and raw report locations relative to
`%LOCALAPPDATA%\sandbox-mcp-lanes\anyapp`. Screenshots here are downscaled to at most 600 pixels wide;
full-size PNGs remain beside each raw report.

Build host: Windows build 26340, Node 26.13.0, .NET SDK 10.0.403, Visual Studio x64 C++ tools and winapp CLI 0.7.1.
These are measured versions, not an exact-SDK requirement for using sandbox-mcp.

## Reproduce

Use the [source samples and build commands](https://github.com/shanselman/sandbox-mcp/tree/main/samples). Invoke `Wpf.exe`, `WinForms.exe` and
`HelloWinUI.exe` explicitly: self-contained .NET folders can contain `createdump.exe`, so a bare folder is
deliberately ambiguous. The entire folder is still copied when an EXE is selected.

```powershell
.\samples\Wpf\build.ps1
sbx run .\samples\Wpf\bin\publish\Wpf.exe --network off --test .\samples\Wpf\test.ps1

.\samples\NativeWin32\package.ps1
sbx run .\samples\NativeWin32\bin\NativeWin32.msix --cert .\samples\NativeWin32\bin\devcert.cer --network off --test .\samples\NativeWin32\test.ps1

pwsh -NoProfile -File .\samples\WinUI\build.ps1
sbx run .\samples\WinUI\bin\unpackaged\HelloWinUI.exe --network off --test .\samples\WinUI\test.ps1
sbx run .\samples\WinUI\bin\HelloWinUI.msix --cert .\samples\WinUI\bin\SandboxShowcase.cer --network off --test .\samples\WinUI\test.ps1
```

Dev-signing keys are generated under ignored `bin` folders, not checked in or trusted on the host. `--cert`
copies only the public CER into the disposable guest. Package dependency folders are explicit offline inputs;
these two MSIX samples are self-contained and have no external framework-package requirement.

## Failures found while building the fixtures

The initial WPF test found a real runner issue: PowerShell's UIA compiler resolved `System.dll` from the
self-contained app's working directory, finding a modern .NET facade instead of the inbox Framework assembly.
The runner now supplies explicit inbox Framework assembly paths, with a regression test. WPF and WinForms
subsequently passed with their actual self-contained working directories.

The initial WinUI distributions omitted `App.xbf`, `MainWindow.xbf` and the merged resource index during
publish, even though compilation produced them. Both variants installed/launched far enough to report a real
process, then failed in `Microsoft.UI.Xaml.dll` with a stowed exception. Including only the app XBFs was
insufficient: the [collected startup diagnostic](compatibility/winui-startup-failure.txt) identified the missing
WinUI theme resource. The sample now includes the merged index as `resources.pri`; build guards dump that index
and check the actual `Files/Microsoft.UI.Xaml/Themes/themeresources.xbf` entry in addition to the app XBFs.
A rebuilt payload was not treated as proof: both distributions were rerun in separate fresh guests and
passed the full UIA/screenshot/crash-check flow. The final table records those successful reruns; the
[initial failure records](compatibility/initial-winui-failures.json) are retained rather than erased.
This fixture defect is not evidence that WinUI itself is unsupported.

## Boundaries of this snapshot

- Live package checks exercised **MSIX**, guest-only development-certificate trust and full-trust desktop AUMIDs.
  Unit tests cover bundle manifest identities, offline dependency arguments, multiple Application Ids, publisher/
  version/architecture collisions and deployment-error activity logs. Appx and bundle extensions are accepted,
  but this snapshot does not claim a separate live run for every extension or every dependency graph.
- Console, Electron, PyInstaller, installers and detonation are valid entry-point categories, not extra passing
  rows inferred from these UI samples. Installer audit and detonation have separate tests and reports.
- No x86/Arm64, Store licensing, AppContainer-only, GPU/hardware integration, reboot-requiring installer or
  driver compatibility is established here. Such requirements need their own real guest proof.
- The default clean guest exposes missing dependencies. Provisioning is an explicit opt-in, not something a
  passing self-contained result implies was installed behind the scenes.
