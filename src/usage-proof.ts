import { encodePacked, keccak256, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { canonicalJson, sha256Hex } from './canonical-json.js';

export function usageHashes(input: Record<string, unknown>, dataset: Record<string, unknown>[]) {
  return {
    inputHash: `sha256:${sha256Hex(canonicalJson(input))}`,
    outputHash: `sha256:${sha256Hex(canonicalJson(dataset))}`,
  };
}

export async function signUsage(
  privateKey: Hex,
  runId: string,
  facetId: string,
  inputHash: string,
  outputHash: string,
  itemCount: number,
): Promise<Hex> {
  const bytes32 = (hash: string): Hex => {
    if (!/^sha256:[0-9a-f]{64}$/i.test(hash)) throw new Error('invalid SHA-256 hash');
    return `0x${hash.slice(7)}` as Hex;
  };
  const usageDigest = keccak256(encodePacked(
    ['bytes32', 'bytes32', 'bytes32', 'bytes32', 'uint256'],
    [keccak256(new TextEncoder().encode(runId)), keccak256(new TextEncoder().encode(facetId)), bytes32(inputHash), bytes32(outputHash), BigInt(itemCount)],
  ));
  return privateKeyToAccount(privateKey).signMessage({ message: { raw: usageDigest } });
}
