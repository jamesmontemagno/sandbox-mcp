# Releasing

A release is a tag plus a Windows x64 portable ZIP (bundled Node, `sbx`, the MCP server, guest agent and skills).
GitHub Actions builds and attaches the ZIP; nothing is uploaded by hand.

1. **Bump the version:** `npm version X.Y.Z --no-git-tag-version` (updates `package.json` and the lockfile). Commit,
   push to `main` and wait for `ci` to go green.
2. **Dry run:** `gh workflow run release.yml`, then `gh run watch`. It runs the tests, builds the ZIP, smoke-tests it and
   keeps it as the `sandbox-mcp-win-x64` artifact. It never touches a release. Do this before every release: the
   hosted runner is the only place the packaged CLI is tested on a PC that isn't yours.
3. **Publish:** `gh release create vX.Y.Z --target main --title "..." --notes-file notes.md`. Publishing runs the
   workflow again, which refuses to upload unless the tag equals `v<package.json version>`, then attaches
   `sandbox-mcp-win-x64-vX.Y.Z.zip`.
4. **Check the asset:** download `releases/latest/download/sandbox-mcp-win-x64-vX.Y.Z.zip`, compare its SHA256 with the
   digest GitHub shows, and run `node test/package-smoke.js <zip>`. Then do one real run, because CI can't boot a
   sandbox: extract it, take Node off PATH, and `sbx run C:\Windows\System32\charmap.exe --open`.

Roll back a bad release with `gh release delete vX.Y.Z --cleanup-tag --yes`.

## Things that have bitten us

- **The CI runner is Windows Server, not Windows Pro.** It has no Windows Sandbox and no `wsb`, so `sbx doctor` must
  degrade gracefully there. The first dry run caught `doctor --json` printing nothing on the runner.
- **Keep the readiness probe in `src/core.js` to one PowerShell statement per fact.** It runs under
  `$ErrorActionPreference = 'SilentlyContinue'`, where one failing element inside a single `[ordered]@{...}` literal
  silences the whole output. An optional value written as `$(if (...) { ... })` serializes as `{}` when empty, which
  is truthy in JS; assign it inside the `if` instead.
- Only Windows x64 is tested natively. There is no ARM64 package.
