import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
const html = read('site/index.html');
const siteUrl = 'https://shanselman.github.io/sandbox-mcp/';
const attrs = [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
const serverTools = [...read('src/server.js').matchAll(/registerTool\('(\w+)'/g)].map((m) => m[1]);

test('local files and in-page links resolve', () => {
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  for (const target of attrs.filter((a) => !/^https?:/.test(a))) {
    if (target.startsWith('#')) assert.ok(ids.has(target.slice(1)), `no element with id ${target}`);
    else assert.ok(fs.existsSync(new URL(`../../site/${target}`, import.meta.url)), `missing file: ${target}`);
  }
});

test('social image exists where the absolute URL says it does', () => {
  const image = html.match(/property="og:image" content="([^"]+)"/)[1];
  assert.ok(image.startsWith(siteUrl));
  assert.ok(fs.existsSync(new URL(`../../site/${image.slice(siteUrl.length)}`, import.meta.url)));
});

test('install commands match the plugin and marketplace names', () => {
  const plugin = JSON.parse(read('plugin.json')).name;
  const marketplace = JSON.parse(read('.github/plugin/marketplace.json')).name;
  assert.ok(html.includes(`copilot plugin install ${plugin}@${marketplace}`));
  assert.ok(html.includes('copilot plugin marketplace add shanselman/sandbox-mcp'));
});

test('site positions the CLI as standalone and MCP as optional', () => {
  assert.match(html, /optional MCP adapter/i);
  assert.match(html, /same engine/i);
  assert.match(html, /CLI does not require this plugin/i);
  assert.match(html, /no Node\.js install, MCP setup or PATH changes/i);
});

test('the site only names real MCP tools and states the right tool count', () => {
  const named = [...html.matchAll(/\bsandbox_[a-z]\w*/g)].map((m) => m[0]);
  assert.deepEqual(named.filter((t) => !serverTools.includes(t)), []);
  assert.equal(Number(html.match(/data-tool-count>(\d+)</)[1]), serverTools.length);
});
