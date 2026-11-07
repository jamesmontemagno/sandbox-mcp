# sandbox-mcp Agent Plugin

A portable [Agent Plugin](https://agent-plugins.org/) (spec 1.0.0) that gives AI agents fresh, throwaway Windows machines for testing apps.

| Component | What it adds |
|---|---|
| `mcp.json` | The `windows-sandbox` stdio MCP server, launched with `cmd /d /c npx --yes github:shanselman/sandbox-mcp#v<version>` |
| `skills/` | `windows-sandbox-setup`, `windows-sandbox-app-test`, `windows-sandbox-interactive`, `windows-sandbox-installer-test`, `windows-sandbox-detonate` |

## Before you install

1. Use Windows 11 24H2 or later, Pro, Enterprise or Education. The plugin doesn't work on other systems, because the server needs Windows Sandbox on the PC running the agent.
2. Install [Node.js 20 or later](https://nodejs.org/) with `winget install OpenJS.NodeJS.LTS --source winget`. Unlike the portable ZIP, the plugin uses your installed Node.js and npm.
3. Turn on Windows Sandbox if you haven't. [Turn on Windows Sandbox](../README.md#turn-on-windows-sandbox) covers the steps.

To check your PC, run the read-only readiness check:

```powershell
npx --yes --package=github:shanselman/sandbox-mcp sbx doctor
```

## Install

### GitHub Copilot CLI

From the marketplace:

```powershell
copilot plugin marketplace add shanselman/sandbox-mcp
copilot plugin install sandbox-mcp@sandbox-mcp
```

Or install directly, with no marketplace:

```powershell
copilot plugin install shanselman/sandbox-mcp
```

To update or remove it later:

```powershell
copilot plugin update sandbox-mcp
copilot plugin uninstall sandbox-mcp
```

### VS Code

From the marketplace:

1. Open **Chat: Open Customizations**, then select **Browse** > **Configure Marketplaces** > **Add Marketplace**.
2. Add `shanselman/sandbox-mcp`.
3. Browse the marketplace and install `sandbox-mcp`.

Or install directly:

1. Run **Chat: Install Plugin from Source** from the Command Palette.
2. Enter the repository URL:
   ```text
   https://github.com/shanselman/sandbox-mcp.git
   ```

Confirm `sandbox-mcp` is enabled in **Chat: Open Customizations** > **Plugins**, then start a new session and check its skills and MCP tools.

### Other clients

For another Agent Plugins-compatible client, use that client's plugin install flow. If your agent doesn't support plugins, use the [manual MCP setup](../README.md#use-it-from-an-agent-mcp).

## Try it

Start a new session and ask:

> Build this app, run it on a clean machine and show me a screenshot.

> Does this installer clean up after itself when it's uninstalled?

> What does `invoice.js` do when it runs?

## How it's put together

- **Layout:** the manifest ([`plugin.json`](../plugin.json)), MCP configuration ([`mcp.json`](../mcp.json)) and [`skills/`](../skills) are at the repository root, so direct installs find the whole plugin. The catalog is [`.github/plugin/marketplace.json`](../.github/plugin/marketplace.json).
- **Server code is pinned to a release tag:** `mcp.json` fetches the server from this repository's `v<version>` tag, so its code only changes when you update the plugin. The first launch downloads the server and its dependencies, and npm caches them for later launches.
- **The `cmd /d /c` wrapper:** on Windows `npx` is a `.cmd` file, which some clients can't start directly. `/d` skips any `cmd` AutoRun commands, whose output could corrupt the MCP messages on stdout.
- **Permissions:** the agent can start a sandbox, copy in any host path that it names, and run commands inside the sandbox. To limit which host folders it can copy in, set `SANDBOX_MCP_ALLOWED_ROOTS`. See the [security notes](../README.md#security-notes).
