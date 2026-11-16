import Fastify from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import type { Hex } from 'viem';
import { executeActor } from './execute-actor.js';
import { sha256Hex } from './canonical-json.js';
import { signUsage, usageHashes } from './usage-proof.js';

interface Config {
  runnerMode: 'docker' | 'subprocess';
  runnerPrivateKey: Hex;
  executorToken: string;
  facetEnv: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HASH = /^sha256:[0-9a-f]{64}$/i;
const IMAGE = 'facet/node-actor-runner:1.0';
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

export function createExecutorServer(config: Config) {
  if (!/^0x[0-9a-f]{64}$/i.test(config.runnerPrivateKey)) throw new Error('FACET_RUNNER_PRIVATE_KEY missing');
  if (config.executorToken.length < 32) throw new Error('FACET_EXECUTOR_TOKEN must have at least 32 characters');
  if (config.runnerMode === 'subprocess' && config.facetEnv !== 'local') throw new Error('Subprocess runner restricted to local');
  const app = Fastify({ logger: false, bodyLimit: 512 * 1024 });
  app.get('/health/live', async () => ({ status: 'ok' }));
  app.post('/v1/execute', async (request, reply) => {
    const provided = request.headers['x-facet-executor-token'];
    const providedBytes = Buffer.from(typeof provided === 'string' ? provided : '');
    const expectedBytes = Buffer.from(config.executorToken);
    if (providedBytes.length !== expectedBytes.length || !timingSafeEqual(providedBytes, expectedBytes)) return reply.code(401).send({ error: 'UNAUTHORIZED' });
    const body = request.body;
    if (!record(body) || !UUID.test(String(body.runId)) || !UUID.test(String(body.facetId)) || !UUID.test(String(body.facetVersionId)) || !record(body.input) || body.facetType !== 'HOSTED_ACTOR') return reply.code(400).send({ error: 'INVALID_REQUEST' });
    const timeoutMs = body.timeoutMs === undefined ? 15_000 : body.timeoutMs;
    if (!Number.isInteger(timeoutMs) || (timeoutMs as number) < 1 || (timeoutMs as number) > 30_000) return reply.code(400).send({ error: 'INVALID_TIMEOUT' });
    const bundle = body.actorBundle;
    if (!record(bundle) || typeof bundle.code !== 'string' || bundle.code.length > 256 * 1024 || typeof bundle.imageDigest !== 'string' || !HASH.test(bundle.imageDigest)) return reply.code(400).send({ error: 'INVALID_ACTOR_BUNDLE' });
    const actualDigest = `sha256:${sha256Hex(`${IMAGE}\n${bundle.code.trim()}`)}`;
    if (actualDigest.toLowerCase() !== bundle.imageDigest.toLowerCase()) return reply.code(400).send({ error: 'IMAGE_DIGEST_MISMATCH' });
    const started = Date.now();
    try {
      const { result, dataset, logs } = await executeActor(bundle.code, body.input, timeoutMs as number, config.runnerMode);
      const { inputHash, outputHash } = usageHashes(body.input, dataset);
      const runnerSignature = await signUsage(config.runnerPrivateKey, body.runId as string, body.facetId as string, inputHash, outputHash, dataset.length);
      return { status: 'SUCCEEDED', result, dataset, logs, usage: { itemCount: dataset.length, durationMs: Date.now() - started, outputHash, runnerSignature } };
    } catch {
      return reply.code(422).send({ error: 'EXECUTION_FAILED' });
    }
  });
  return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config: Config = {
    runnerMode: process.env.FACET_RUNNER_MODE === 'subprocess' ? 'subprocess' : 'docker',
    runnerPrivateKey: process.env.FACET_RUNNER_PRIVATE_KEY as Hex,
    executorToken: process.env.FACET_EXECUTOR_TOKEN ?? '',
    facetEnv: process.env.FACET_ENV ?? 'production',
  };
  const app = createExecutorServer(config);
  app.listen({ host: '0.0.0.0', port: Number(process.env.FACET_EXECUTOR_PORT ?? 4030) }).catch(() => { process.exitCode = 1; });
}
