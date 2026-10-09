import { robinhoodTestnet } from './chains.js';

export const CONTRACT_ADDRESSES = {
  factory: import.meta.env.VITE_TICKET_FACTORY_ADDRESS || '0x0dB0a481Ef2d53228eD1dD269dFbc0b9fA2559f8',
  mockUSDG: import.meta.env.VITE_MOCK_USDG_ADDRESS || '0x29e688092F42e533A69dB2dA0Df576579a5cd7f9',
  mockHumanVerifier: import.meta.env.VITE_MOCK_HUMAN_VERIFIER_ADDRESS || '0xaC3B0754697BfEB5A094B4578ba46848715C220F',
};

export const CHAIN = robinhoodTestnet;
export const RPC_URL = import.meta.env.VITE_RPC_URL || 'https://robinhood-testnet.g.alchemy.com/v2/kuKmwsoR515lVdX5RgLKf';
export const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID) || 46630;

export const PINATA_API_KEY = import.meta.env.VITE_PINATA_API_KEY || '';
export const PINATA_JWT = import.meta.env.VITE_PINATA_JWT || '';
export const PINATA_GATEWAY = import.meta.env.VITE_PINATA_GATEWAY || 'https://gateway.pinata.cloud';