// Starts the MCP server exactly the way an installed agent plugin does (the command in mcp.json) and talks to it over
// stdio. Needs the network. SANDBOX_MCP_PLUGIN_SPEC swaps the pinned release for another npm spec, which lets CI test a
// commit whose release tag doesn't exist yet.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

if (process.platform !== 'win32') throw new Error('The plugin smoke test requires Windows.');

const config = JSON.parse(fs.readFileSync(new URL('../mcp.json', import.meta.url), 'utf8'));
const { command, args } = config.mcpServers['windows-sandbox'];
const launch = process.env.SANDBOX_MCP_PLUGIN_SPEC ? [...args.slice(0, -1), process.env.SANDBOX_MCP_PLUGIN_SPEC] : args;
console.log(`Starting: ${command} ${launch.join(' ')}`);

const client = new Client({ name: 'plugin-smoke', version: '1.0.0' });
const transportErrors = [];
client.onerror = (error) => transportErrors.push(error.message);

// The first launch downloads the server and its dependencies, far longer than the SDK's default timeout allows.
await client.connect(new StdioClientTransport({ command, args: launch }), { timeout: 240_000 });
const { tools } = await client.listTools();
assert.ok(tools.some((tool) => tool.name === 'sandbox_run'), 'tools/list did not return sandbox_run.');
assert.deepEqual(transportErrors, [], 'Something other than MCP messages was written to stdout.');

// The client waits 2 s for the server to exit on stdin EOF before it kills the process. Killing cmd.exe wouldn't reach the
// node process under it, and that node process is what destroys the sandbox when the client goes away.
const closing = Date.now();
await client.close();
assert.ok(Date.now() - closing < 2_000, 'The server did not exit when stdin closed.');
console.log(`Plugin smoke test passed (${tools.length} tools, clean stdout, exits on stdin EOF).`);
