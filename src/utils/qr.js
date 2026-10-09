import { CONTRACT_ADDRESSES, CHAIN_ID } from '../config/contracts.js';

export function createQRPayload(tokenId, contractAddress = CONTRACT_ADDRESSES.factory) {
  const timestamp = Math.floor(Date.now() / 1000);
  return `${contractAddress}|${tokenId}|${timestamp}|${CHAIN_ID}`;
}

export async function signQRPayload(payload, walletClient) {
  const signature = await walletClient.signMessage({ message: payload });
  return signature;
}

export function parseQRPayload(payload) {
  const parts = payload.split('|');
  if (parts.length !== 4) return null;
  return {
    contractAddress: parts[0],
    tokenId: BigInt(parts[1]),
    timestamp: BigInt(parts[2]),
    chainId: Number(parts[3]),
  };
}

export function isQRFresh(timestamp, toleranceMs = 3 * 60 * 1000) {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const diff = timestamp > now ? timestamp - now : now - timestamp;
  return diff <= BigInt(Math.floor(toleranceMs / 1000));
}

export function generateQRDataUrl() {
  return `data:image/svg+xml;base64,${btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <rect width="100" height="100" fill="white"/>
      <text x="50" y="50" font-size="8" text-anchor="middle" fill="black">QR</text>
    </svg>
  `)}`;
}