import { createPublicClient, http } from 'viem';
import { CHAIN, RPC_URL } from '../config/contracts.js';

const publicClient = createPublicClient({
  chain: CHAIN,
  transport: http(RPC_URL),
});

export async function simulateContract(walletClient, { address, abi, functionName, args, value = 0n }) {
  const { request } = await publicClient.simulateContract({
    address,
    abi,
    functionName,
    args,
    account: walletClient.account,
    value,
  });
  return request;
}

export async function writeContract(walletClient, { address, abi, functionName, args, value = 0n }) {
  const request = await simulateContract(walletClient, { address, abi, functionName, args, value });
  const hash = await walletClient.writeContract(request);
  return hash;
}

export async function waitForTransactionReceipt(hash) {
  return publicClient.waitForTransactionReceipt({ hash });
}

export async function readContract({ address, abi, functionName, args = [] }) {
  return publicClient.readContract({ address, abi, functionName, args });
}

export async function getBlockNumber() {
  return publicClient.getBlockNumber();
}

export async function getBlockTimestamp() {
  const block = await publicClient.getBlock({ blockTag: 'latest' });
  return block.timestamp;
}

export function formatUnits(value, decimals) {
  const divisor = BigInt(10 ** decimals);
  const whole = value / divisor;
  const fraction = value % divisor;
  if (fraction === 0n) return whole.toString();
  const fracStr = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${whole}.${fracStr}`;
}

export function parseUnits(value, decimals) {
  const [whole, fraction = ''] = value.toString().split('.');
  const fracPadded = fraction.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(whole) * BigInt(10 ** decimals) + BigInt(fracPadded || '0');
}