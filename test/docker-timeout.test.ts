import { expect, test } from 'vitest';
import { mkdtemp, readFile, rm, writeFile, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { executeActor } from '../src/execute-actor.js';

test('force-removes a Docker container after execution timeout', async () => {
  const root = await mkdtemp(join(tmpdir(), 'facet-docker-fake-'));
  const script = join(root, 'docker');
  const marker = join(root, 'calls');
  const originalPath = process.env.PATH;
  await writeFile(script, `#!/bin/sh\necho "$@" >> '${marker}'\nif [ "$1" = "run" ]; then sleep 5; fi\n`);
  await chmod(script, 0o755);
  process.env.PATH = `${root}:${originalPath}`;
  try {
    await expect(executeActor('export default async () => ({})', {}, 30, 'docker')).rejects.toThrow('Actor timeout');
    const calls = await readFile(marker, 'utf8');
    expect(calls).toContain('run --rm');
    expect(calls).toContain('rm -f facet-run-');
  } finally {
    process.env.PATH = originalPath;
    await rm(root, { recursive: true, force: true });
  }
});
