// Viem shim for Privy SDK - provides formatEther and formatUnits
// These are re-exported from viem so Privy SDK can find them

import { formatEther, formatUnits, parseEther, parseUnits } from 'viem';

export { formatEther, formatUnits, parseEther, parseUnits };

// Also export as default for compatibility
export default {
  formatEther,
  formatUnits,
  parseEther,
  parseUnits,
};