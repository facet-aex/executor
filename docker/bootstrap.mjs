import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const work = process.env.FACET_RUNNER_WORK_DIR ?? '/work';
const output = process.env.FACET_RUNNER_OUTPUT_DIR ?? '/output';
const MAX_BYTES = 1024 * 1024;
const logs = [];
console.log = (...parts) => {
  if (logs.length < 100) logs.push(parts.map(String).join(' ').slice(0, 2048));
};

function record(item) {
  return item !== null && typeof item === 'object' && !Array.isArray(item);
}

try {
  const input = JSON.parse(await readFile(join(work, 'input.json'), 'utf8'));
  const mod = await import(pathToFileURL(join(work, 'actor.mjs')).href);
  const run = mod.default ?? mod.run;
  if (typeof run !== 'function') throw new Error('Actor must export run(input)');
  const raw = await run(input);
  const dataset = Array.isArray(raw) ? raw : [raw];
  if (!dataset.every(record)) throw new Error('Actor dataset items must be objects');
  const result = Array.isArray(raw) ? { items: dataset, count: dataset.length } : raw;
  const serialized = JSON.stringify({ result, dataset, logs });
  if (serialized === undefined || Buffer.byteLength(serialized) > MAX_BYTES) throw new Error('Actor output exceeds 1 MiB');
  await writeFile(join(output, 'result.json'), serialized);
} catch (error) {
  process.stderr.write(String(error?.message ?? error).slice(0, 2048) + '\n');
  process.exitCode = 1;
}
