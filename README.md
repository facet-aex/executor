# FACET Executor (`@facet/executor`)

[![FACET](https://img.shields.io/badge/FACET-facet.briandev.space-050505?style=flat-square&labelColor=DFFF4F)](https://facet.briandev.space)
[![Layer](https://img.shields.io/badge/SANDBOX-ACTOR%20RUNNER-0D0D0D?style=flat-square&labelColor=343434)](https://github.com/facet-aex)

> Isolated Docker sandbox runner for hosted `ACTOR` workloads and execution dispatcher for `AGENT` tasks.

## Overview

`executor` runs untrusted provider code and agent workloads for **FACET**. It packages the hardened `facet/node-actor-runner` container image and exposes an internal execution API consumed by `gateway` and `control-api` previews.

## Role in FACET

- **Containerized Actor Sandbox:** Runs single-file ESM JavaScript `ACTOR` modules inside ephemeral, read-only Docker containers (`node:22-alpine` + `cheerio`) with strict CPU, memory, PID, and timeout limits.
- **A2A Agent Execution:** Dispatches `AGENT` workloads bound to canonical `ERC-8004` identities and normalizes structured responses.
- **Cryptographic Usage Proofs:** Computes canonical input/output hashes and dataset item counts, then signs an EIP-191 usage proof (`runnerSignature`) used for `TaskEscrow` settlement and `FacetReceiptLog` recording.
- **Built-In Templates:** Provides starter ESM Actor and Agent templates for publishing and testing.

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime & HTTP | Node.js 24 (ESM), TypeScript, Fastify 5 |
| Sandbox Image | Docker sibling containers, `node:22-alpine`, `cheerio` |
| Cryptography | `viem` (EIP-191 usage proof signing & keccak256 hashing) |
| Testing & Container | Vitest, Docker (`node:24-alpine`) |

---

Part of **[FACET](https://facet.briandev.space)** (`facet-aex`) — Federated Agent Capability Exchange & Trust on Avalanche.
