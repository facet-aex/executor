# FACET Executor (`@facet/executor`)

Isolated Docker Actor Sandbox Runner and ERC-8004 A2A Agent dispatcher (`:4030`) under [ADR-0015](../docs/architecture/decisions/ADR-0015-actorbazaar-docker-and-a2a-mvp.md).

## Responsibilities

- Build and run `facet/node-actor-runner:1.0` (`node:22-alpine` + `cheerio`) containers with strict resource caps (`--cpus=0.5 --memory=128m --pids-limit=32 --read-only`).
- Execute provider-pushed `HOSTED_ACTOR` ESM modules (`export default async function run(input) { ... }`) and return structured `dataset` items, `logs`, `outputHash`, and `runnerSignature`.
- Execute `AUTONOMOUS_AGENT` (ERC-8004 bound A2A) tasks.
- Provide the 2 Vietnamese Sample Actors (`vn-gold-fx-actor`, `vn-tech-news-actor`) and 1 Sample A2A Agent (`vn-market-analyst-agent`).

## Endpoints

- `GET /health/live` — liveness probe
- `GET /v1/templates` — built-in Vietnamese Actor & A2A Agent templates
- `POST /v1/execute` — execute a `HOSTED_ACTOR` or `AUTONOMOUS_AGENT` run
