# `executor` instructions (Docker Actor Sandbox Runner & A2A Dispatcher)

**Owner in Wave 1:** Codex  
**Port:** `4030` (`FACET_EXECUTOR_PORT`, default `4030`)  
**Active architectural authority:** `../docs/architecture/decisions/ADR-0015-actorbazaar-docker-and-a2a-mvp.md`

## Role

`executor` is the isolated workload execution service called by `gateway` (`POST http://127.0.0.1:4030/v1/execute`) to run:
1. **`HOSTED_ACTOR`** (Minimalist Apify/ActorBazaar-style JavaScript Actors inside a Docker container);
2. **`AUTONOMOUS_AGENT`** (ERC-8004 bound A2A Agent tasks).

## Required Implementation

### 1. Docker Base Image (`docker/Dockerfile.node-runner`)
- Image tag: `facet/node-actor-runner:1.0` (built on `node:22-alpine` with `cheerio` installed).
- Entrypoint `/runner/bootstrap.mjs`:
  - Reads `/work/input.json` and dynamically imports `/work/actor.mjs`.
  - Invokes `const raw = await mod.default(input)` (or `mod.run(input)`).
  - Normalizes output:
    - If `Array.isArray(raw)`: `dataset = raw`, `result = { items: raw, count: raw.length }`.
    - Otherwise: `dataset = [raw]`, `result = raw`.
  - Writes `/output/result.json` containing `{ result, dataset, logs }`.

### 2. Execution Endpoint (`POST /v1/execute` on `:4030`)
- Accepts `ExecutorRunRequest` (`api-contracts v0.13.0`):
  ```json
  {
    "runId": "uuid",
    "facetId": "uuid",
    "facetVersionId": "uuid",
    "facetType": "HOSTED_ACTOR",
    "input": {},
    "timeoutMs": 15000,
    "actorBundle": {
      "code": "export default async function run(input) { ... }",
      "imageDigest": "sha256:..."
    },
    "agentConfig": {
      "erc8004ChainId": 43113,
      "erc8004Registry": "0x8004A818BFB912233c491871b3d84c89A494BD9e",
      "erc8004TokenId": "1",
      "taskKind": "vn-market-analysis",
      "code": "optional"
    }
  }
  ```
- **For `HOSTED_ACTOR`:**
  1. Verify `imageDigest === "sha256:" + sha256Hex("facet/node-actor-runner:1.0\n" + code.trim())` (if `imageDigest` is provided).
  2. Write `input.json` and `actor.mjs` into an isolated run directory `${FACET_RUN_WORKDIR:-/tmp/facet-runs}/${runId}`.
  3. If `FACET_RUNNER_MODE !== "subprocess"` and Docker is available, run:
     `docker run --rm --cpus=0.5 --memory=128m --pids-limit=32 --read-only --cap-drop=ALL --security-opt=no-new-privileges -v <runDir>/work:/work:ro -v <runDir>/output:/output:rw facet/node-actor-runner:1.0`
     (Also provide a clean `subprocess` fallback mode when `FACET_RUNNER_MODE=subprocess` so unit tests and environments without a live Docker daemon can still verify the exact same contract).
  4. Compute `inputHash = "sha256:" + sha256Hex(canonicalJson(input))` and `outputHash = "sha256:" + sha256Hex(canonicalJson(dataset))`. Sign the exact EIP-191 usage commitment `keccak256(abi.encodePacked(keccak256(bytes(runId)), keccak256(bytes(facetId)), bytes32(inputHashHex), bytes32(outputHashHex), BigInt(itemCount)))` using `FACET_RUNNER_PRIVATE_KEY` (`viem` `signMessage({ message: { raw: usageDigest } })`).
  5. Return `ExecutorRunResponse`:
     `{ status: "SUCCEEDED", result, dataset, logs, usage: { itemCount, durationMs, outputHash, runnerSignature } }`.

- **For `AUTONOMOUS_AGENT`:**
  - Execute the A2A agent workflow (including the built-in `vn-market-analyst-agent` which synthesizes data from the Vietnamese gold/FX and news Actors) and return a structured report in `result`, supporting records in `dataset`, and signed `usage`.

### 3. Built-in Vietnamese Templates (`src/templates/`)
Export and expose (`GET /v1/templates`) the 3 canonical sample workloads so `control-api`, `web`, and the seed script can reference them:
1. `vn-gold-fx-actor` (`HOSTED_ACTOR`): Vietnamese SJC/DOJI/PNJ gold & bank FX rate scraper/normalizer returning a multi-item Dataset.
2. `vn-tech-news-actor` (`HOSTED_ACTOR`): Vietnamese news & text entity/keyword/sentiment extractor returning a multi-item Dataset.
3. `vn-market-analyst-agent` (`AUTONOMOUS_AGENT`): ERC-8004 bound A2A Vietnamese Market Analyst Agent.
