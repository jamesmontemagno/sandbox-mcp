import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
const json = (file) => JSON.parse(read(file));
const skillNames = fs.readdirSync(new URL('../../skills/', import.meta.url));
const skills = skillNames.map((folder) => ({ folder, text: read(`skills/${folder}/SKILL.md`) }));
const serverTools = [...read('src/server.js').matchAll(/registerTool\('(\w+)'/g)].map((m) => m[1]);

test('every version the plugin publishes matches package.json', () => {
  const { version } = json('package.json');
  const entry = json('.github/plugin/marketplace.json').plugins.find((p) => p.name === json('plugin.json').name);
  assert.equal(json('plugin.json').version, version);
  assert.equal(entry?.version, version);
  // The release workflow only publishes tags named v<package.json version>, so this is what a released plugin can fetch.
  assert.equal(json('mcp.json').mcpServers['windows-sandbox'].args.at(-1), `github:shanselman/sandbox-mcp#v${version}`);
});

test('skills follow the Agent Skills naming rules', () => {
  assert.ok(skills.length > 0);
  for (const { folder, text } of skills) {
    const frontmatter = text.match(/^---\r?\n(.*?)\r?\n---/s)?.[1];
    assert.ok(frontmatter, `${folder} is missing frontmatter`);
    const name = frontmatter.match(/^name:\s*(.+)$/m)?.[1].trim();
    const description = frontmatter.match(/^description:\s*(.+)$/m)?.[1].trim();
    assert.equal(name, folder);
    assert.match(name, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    assert.ok(name.length <= 64, `${folder}: name is too long`);
    assert.ok(description && description.length <= 1024, `${folder}: description is missing or too long`);
    assert.doesNotMatch(description, /: /, `${folder}: a colon followed by a space makes the description invalid YAML`);
  }
});

test('skills name only real tools, and every tool is covered by a skill', () => {
  const mentioned = new Set(skills.flatMap(({ text }) => [...text.matchAll(/\bsandbox_[a-z]\w*/g)].map((m) => m[0])));
  assert.deepEqual([...mentioned].filter((t) => !serverTools.includes(t)), []);
  assert.deepEqual(serverTools.filter((t) => !mentioned.has(t)), []);
});

test('skills link only to skills that exist', () => {
  for (const { folder, text } of skills) {
    for (const [ref] of text.matchAll(/\bwindows-sandbox-[a-z-]*[a-z]\b/g)) {
      assert.ok(skillNames.includes(ref), `${folder} refers to a skill that doesn't exist: ${ref}`);
    }
  }
});
