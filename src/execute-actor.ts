import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type RunnerMode = 'docker' | 'subprocess';
const IMAGE = 'facet/node-actor-runner:1.0';
const MAX_OUTPUT = 1024 * 1024;

function runCommand(command: string, args: string[], timeoutMs: number, env?: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { env: env ?? { PATH: process.env.PATH }, stdio: ['ignore', 'pipe', 'pipe'] });
    let bytes = 0;
    let stderr = '';
    let done = false;
    const fail = (error: Error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      child.kill('SIGKILL');
      rejectRun(error);
    };
    const timer = setTimeout(() => fail(new Error('Actor timeout')), timeoutMs);
    child.stdout.on('data', (chunk: Buffer) => { bytes += chunk.length; if (bytes > MAX_OUTPUT) fail(new Error('Actor stdout exceeds 1 MiB')); });
    child.stderr.on('data', (chunk: Buffer) => { bytes += chunk.length; stderr = (stderr + chunk.toString()).slice(-2048); if (bytes > MAX_OUTPUT) fail(new Error('Actor logs exceed 1 MiB')); });
    child.on('error', fail);
    child.on('close', (code) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (code === 0) resolveRun();
      else rejectRun(new Error(`Actor failed: ${stderr.slice(0, 256)}`));
    });
  });
}

export async function executeActor(code: string, input: Record<string, unknown>, timeoutMs: number, mode: RunnerMode) {
  const base = process.env.FACET_RUN_WORKDIR ?? tmpdir();
  const root = await mkdtemp(join(base, 'facet-run-'));
  const work = join(root, 'work');
  const output = join(root, 'output');
  try {
    await mkdir(work, { mode: 0o755 });
    await mkdir(output, { mode: 0o755 });
    await writeFile(join(work, 'input.json'), JSON.stringify(input), { mode: 0o644 });
    await writeFile(join(work, 'actor.mjs'), code, { mode: 0o644 });
    if (mode === 'docker') {
      const containerName = basename(root);
      await symlink('/runner/node_modules', join(work, 'node_modules'));
      const uid = process.getuid?.() ?? 1000;
      const gid = process.getgid?.() ?? 1000;
      try {
        await runCommand('docker', [
          'run', '--rm', '--name', containerName, '--cpus=0.5', '--memory=128m', '--pids-limit=32', '--read-only',
          '--cap-drop=ALL', '--security-opt=no-new-privileges', `--user=${uid}:${gid}`,
          '-v', `${resolve(work)}:/work:ro`, '-v', `${resolve(output)}:/output:rw`, IMAGE,
        ], timeoutMs + 1000);
      } catch (error) {
        try { await runCommand('docker', ['rm', '-f', containerName], 3000); } catch { /* already removed */ }
        throw error;
      }
    } else {
      const bootstrap = fileURLToPath(new URL('../docker/bootstrap.mjs', import.meta.url));
      await runCommand(process.execPath, [bootstrap], timeoutMs, {
        PATH: process.env.PATH,
        FACET_RUNNER_WORK_DIR: work,
        FACET_RUNNER_OUTPUT_DIR: output,
      });
    }
    const buffer = await readFile(join(output, 'result.json'));
    if (buffer.length > MAX_OUTPUT) throw new Error('Actor output exceeds 1 MiB');
    const parsed: unknown = JSON.parse(buffer.toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || !('dataset' in parsed) || !Array.isArray(parsed.dataset) || !parsed.dataset.every((item) => item && typeof item === 'object' && !Array.isArray(item))) throw new Error('Invalid runner output');
    const result = 'result' in parsed ? parsed.result : undefined;
    const logs = 'logs' in parsed && Array.isArray(parsed.logs) ? parsed.logs.filter((item): item is string => typeof item === 'string').slice(0, 100) : [];
    return { result, dataset: parsed.dataset as Record<string, unknown>[], logs };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
