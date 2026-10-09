import { PINATA_JWT, PINATA_GATEWAY } from '../config/contracts.js';

const PINATA_TIMEOUT_MS = 30000;
const PINATA_V3_URL = 'https://uploads.pinata.cloud/v3/files';

// Gateway fallback order: custom > public Pinata > public IPFS > Cloudflare
const GATEWAYS = [
  PINATA_GATEWAY || 'https://pink-definite-iguana-38.mypinata.cloud',
  'https://gateway.pinata.cloud',
  'https://ipfs.io',
  'https://cloudflare-ipfs.com',
];

async function fetchWithTimeout(url, options, timeoutMs = PINATA_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

function parsePinataResponse(data) {
  const cid = data?.data?.cid || data?.IpfsHash;
  if (!cid) {
    throw new Error('Invalid Pinata response: no CID found');
  }
  return `ipfs://${cid}`;
}

export async function uploadToPinata(file) {
  if (!PINATA_JWT) {
    throw new Error('Pinata JWT not configured');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('network', 'public');

  const response = await fetchWithTimeout(PINATA_V3_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PINATA_JWT}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error || errorData.details || `HTTP ${response.status}: ${response.statusText}`;
    console.error('Pinata upload error:', errorData);
    throw new Error(`Pinata upload failed: ${errorMessage}`);
  }

  const data = await response.json();
  return parsePinataResponse(data);
}

export async function uploadJSONToPinata(json) {
  if (!PINATA_JWT) {
    throw new Error('Pinata JWT not configured');
  }

  const blob = new Blob([JSON.stringify(json)], { type: 'application/json' });
  const file = new File([blob], 'metadata.json');
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('network', 'public');

  const response = await fetchWithTimeout(PINATA_V3_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PINATA_JWT}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error || errorData.details || `HTTP ${response.status}: ${response.statusText}`;
    console.error('Pinata JSON upload error:', errorData);
    throw new Error(`Pinata JSON upload failed: ${errorMessage}`);
  }

  const data = await response.json();
  return parsePinataResponse(data);
}

/**
 * Fetch JSON metadata with gateway fallback
 * Tries custom gateway first, then public gateways
 */
export async function fetchWithGatewayFallback(cid) {
  if (!cid) return null;
  const hash = cid.replace('ipfs://', '');
  
  for (const gateway of GATEWAYS) {
    try {
      const res = await fetch(`${gateway}/ipfs/${hash}`);
      if (res.ok) {
        console.log(`[Pinata] Fetched from ${gateway}`);
        return res.json();
      }
      console.warn(`[Pinata] Gateway ${gateway} failed: ${res.status}`);
    } catch (e) {
      console.warn(`[Pinata] Gateway ${gateway} error:`, e.message);
    }
  }
  throw new Error(`All gateways failed for CID: ${hash}`);
}

export function getPinataGatewayUrl(cid) {
  if (!cid) return '';
  const hash = cid.replace('ipfs://', '');
  return `${GATEWAYS[0]}/ipfs/${hash}`;
}