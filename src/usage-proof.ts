import { encodePacked, keccak256, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { canonicalJson, sha256Hex } from './canonical-json.js';

const ESCROW_USAGE_TYPES = {
  EscrowUsageProof: [
    { name: 'runId', type: 'bytes32' },
    { name: 'facetId', type: 'bytes32' },
    { name: 'inputHash', type: 'bytes32' },
    { name: 'outputHash', type: 'bytes32' },
    { name: 'itemCount', type: 'uint256' },
  ],
} as const;

function shaBytes32(hash: string): Hex {
  if (!/^sha256:[0-9a-f]{64}$/i.test(hash)) throw new Error('invalid SHA-256 hash');
  return `0x${hash.slice(7)}` as Hex;
}

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
  const usageDigest = keccak256(encodePacked(
    ['bytes32', 'bytes32', 'bytes32', 'bytes32', 'uint256'],
    [keccak256(new TextEncoder().encode(runId)), keccak256(new TextEncoder().encode(facetId)), shaBytes32(inputHash), shaBytes32(outputHash), BigInt(itemCount)],
  ));
  return privateKeyToAccount(privateKey).signMessage({ message: { raw: usageDigest } });
}

export async function signEscrowUsage(
  privateKey: Hex,
  params: {
    chainId: number;
    verifyingContract: Address;
    runId: string;
    facetId: string;
    inputHash: string;
    outputHash: string;
    itemCount: number;
  },
): Promise<Hex> {
  return privateKeyToAccount(privateKey).signTypedData({
    domain: {
      name: 'FacetFeeSplitAndEscrow',
      version: '2',
      chainId: params.chainId,
      verifyingContract: params.verifyingContract,
    },
    types: ESCROW_USAGE_TYPES,
    primaryType: 'EscrowUsageProof',
    message: {
      runId: keccak256(new TextEncoder().encode(params.runId)),
      facetId: keccak256(new TextEncoder().encode(params.facetId)),
      inputHash: shaBytes32(params.inputHash),
      outputHash: shaBytes32(params.outputHash),
      itemCount: BigInt(params.itemCount),
    },
  });
}
