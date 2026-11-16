import { afterEach, expect, test } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { canonicalJson, sha256Hex } from '../src/canonical-json.js';

const dirs: string[] = [];
afterEach(async () => { await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))); });

async function runActor(code: string, input: unknown = { value: 2 }) {
  const root = await mkdtemp(join(tmpdir(), 'facet-bootstrap-'));
  dirs.push(root);
  const work = join(root, 'work');
  const output = join(root, 'output');
  await mkdir(work); await mkdir(output);
  await writeFile(join(work, 'input.json'), JSON.stringify(input));
  await writeFile(join(work, 'actor.mjs'), code);
  const run = spawnSync(process.execPath, [resolve('docker/bootstrap.mjs')], { env: { ...process.env, FACET_RUNNER_WORK_DIR: work, FACET_RUNNER_OUTPUT_DIR: output }, encoding: 'utf8' });
  return { run, output: run.status === 0 ? JSON.parse(await readFile(join(output, 'result.json'), 'utf8')) : null };
}

test('normalizes an array of records into a dataset', async () => {
  const { run, output } = await runActor('export default async function run(input) { return [{ x: input.value }, { x: 3 }]; }');
  expect(run.status).toBe(0);
  expect(output).toEqual({ result: { items: [{ x: 2 }, { x: 3 }], count: 2 }, dataset: [{ x: 2 }, { x: 3 }], logs: [] });
});

test('normalizes one record into a single dataset item', async () => {
  const { output } = await runActor('export default async function run(input) { return { x: input.value }; }');
  expect(output).toEqual({ result: { x: 2 }, dataset: [{ x: 2 }], logs: [] });
});

test.each(['null', '42', '"text"', '[null]', '[1]'])('rejects invalid output %s', async (raw) => {
  const { run } = await runActor(`export default async function run() { return ${raw}; }`);
  expect(run.status).not.toBe(0);
});

test('rejects output above 1 MiB', async () => {
  const { run } = await runActor('export default async function run() { return { text: "x".repeat(1100000) }; }');
  expect(run.status).not.toBe(0);
});

test('canonical JSON sorts nested object keys before hashing', () => {
  expect(canonicalJson({ z: 1, a: { y: 2, b: 3 } })).toBe('{"a":{"b":3,"y":2},"z":1}');
  expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
