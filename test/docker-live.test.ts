import { expect, test } from 'vitest';
import { executeActor } from '../src/execute-actor.js';

test.skipIf(process.env.FACET_DOCKER_TEST !== '1')('runs sourced Actor code with cheerio in capped Docker image', async () => {
  const output = await executeActor('import * as cheerio from "cheerio"; export default async () => ({ title: cheerio.load("<h1>ok</h1>")("h1").text(), secret: process.env.FACET_RUNNER_PRIVATE_KEY ?? null });', {}, 15000, 'docker');
  expect(output.dataset).toEqual([{ title: 'ok', secret: null }]);
});

test.skipIf(process.env.FACET_DOCKER_TEST !== '1')('kills a Docker Actor that exceeds its wall-clock timeout', async () => {
  await expect(executeActor('export default async function run() { while (true) {} }', {}, 1000, 'docker')).rejects.toThrow('Actor timeout');
});

test.skipIf(process.env.FACET_DOCKER_TEST !== '1')('rejects Docker Actor output above 1 MiB', async () => {
  await expect(executeActor('export default async () => ({ text: "x".repeat(1100000) });', {}, 15000, 'docker')).rejects.toThrow('exceeds 1 MiB');
});
