import { afterEach, expect, test } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { encodePacked, keccak256, recoverMessageAddress } from 'viem';
import { createExecutorServer } from '../src/server.js';
import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';

const RUNNER_KEY = `0x${'1'.repeat(64)}` as const;
const TOKEN = 'local-test-token-at-least-32-characters';
const RUN_ID = '019a1234-5678-7abc-8def-123456789abc';
const FACET_ID = '019a1234-5678-7abc-8def-123456789abd';
const CODE = 'export default async function run(input) { return [{ value: input.value }]; }';
const sha = (value: string) => createHash('sha256').update(value).digest('hex');

let server: FastifyInstance | undefined;
afterEach(async () => { await server?.close(); server = undefined; });

function request(overrides: Record<string, unknown> = {}) {
  return {
    runId: RUN_ID, facetId: FACET_ID, facetVersionId: '019a1234-5678-7abc-8def-123456789abe',
    facetType: 'HOSTED_ACTOR', input: { value: 4 }, timeoutMs: 15000,
    actorBundle: { code: CODE, imageDigest: `sha256:${sha(`facet/node-actor-runner:1.0\n${CODE.trim()}`)}` },
    ...overrides,
  };
}

function app() {
  server = createExecutorServer({ runnerMode: 'subprocess', runnerPrivateKey: RUNNER_KEY, executorToken: TOKEN, facetEnv: 'local' });
  return server;
}

test('rejects unauthenticated execution', async () => {
  const response = await app().inject({ method: 'POST', url: '/v1/execute', payload: request() });
  expect(response.statusCode).toBe(401);
});

test('executes an actor once and signs exact usage fields', async () => {
  const response = await app().inject({ method: 'POST', url: '/v1/execute', headers: { 'x-facet-executor-token': TOKEN }, payload: request() });
  expect(response.statusCode).toBe(200);
  const body = response.json();
  expect(body.status).toBe('SUCCEEDED');
  expect(body.dataset).toEqual([{ value: 4 }]);
  expect(body.usage.itemCount).toBe(1);
  expect(body.usage.outputHash).toBe(`sha256:${sha('[{"value":4}]')}`);
  const digest = keccak256(encodePacked(
    ['bytes32', 'bytes32', 'bytes32', 'bytes32', 'uint256'],
    [keccak256(new TextEncoder().encode(RUN_ID)), keccak256(new TextEncoder().encode(FACET_ID)), `0x${sha('{"value":4}')}`, `0x${sha('[{"value":4}]')}`, 1n],
  ));
  expect(await recoverMessageAddress({ message: { raw: digest }, signature: body.usage.runnerSignature })).toBe(privateKeyToAccount(RUNNER_KEY).address);
});

test('rejects image-digest mismatch before execution', async () => {
  const body = request({ actorBundle: { code: CODE, imageDigest: `sha256:${'0'.repeat(64)}` } });
  const response = await app().inject({ method: 'POST', url: '/v1/execute', headers: { 'x-facet-executor-token': TOKEN }, payload: body });
  expect(response.statusCode).toBe(400);
});

test('rejects unsupported type and excessive timeout', async () => {
  const instance = app();
  for (const body of [request({ facetType: 'EXTERNAL_HTTP_API' }), request({ timeoutMs: 30001 })]) {
    const response = await instance.inject({ method: 'POST', url: '/v1/execute', headers: { 'x-facet-executor-token': TOKEN }, payload: body });
    expect(response.statusCode).toBe(400);
  }
});

test('forbids subprocess execution outside local mode', async () => {
  expect(() => createExecutorServer({ runnerMode: 'subprocess', runnerPrivateKey: RUNNER_KEY, executorToken: TOKEN, facetEnv: 'production' })).toThrow();
});

test('does not pass executor signing secrets to actor process', async () => {
  process.env.FACET_RUNNER_PRIVATE_KEY = RUNNER_KEY;
  try {
    const code = 'export default async function run() { return { leaked: process.env.FACET_RUNNER_PRIVATE_KEY ?? null }; }';
    const payload = request({ actorBundle: { code, imageDigest: `sha256:${sha(`facet/node-actor-runner:1.0\n${code.trim()}`)}` } });
    const response = await app().inject({ method: 'POST', url: '/v1/execute', headers: { 'x-facet-executor-token': TOKEN }, payload });
    expect(response.statusCode).toBe(200);
    expect(response.json().dataset).toEqual([{ leaked: null }]);
  } finally {
    delete process.env.FACET_RUNNER_PRIVATE_KEY;
  }
});
