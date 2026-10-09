import { CONTRACT_CONSTANTS } from '../config/constants.js';

export function formatUSDG(amount, decimals = CONTRACT_CONSTANTS.USDG_DECIMALS) {
  if (!amount) return '0';
  const divisor = BigInt(10 ** decimals);
  const whole = amount / divisor;
  const fraction = amount % divisor;
  if (fraction === 0n) return whole.toString();
  const fracStr = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${whole}.${fracStr}`;
}

export function parseUSDG(amountStr, decimals = CONTRACT_CONSTANTS.USDG_DECIMALS) {
  const [whole, fraction = ''] = amountStr.split('.');
  const fracPadded = fraction.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(whole) * BigInt(10 ** decimals) + BigInt(fracPadded || '0');
}

export function formatTime(timestamp) {
  if (!timestamp) return '-';
  const date = new Date(Number(timestamp) * 1000);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(timestamp) {
  if (!timestamp) return '-';
  const date = new Date(Number(timestamp) * 1000);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(timestamp) {
  if (!timestamp) return '-';
  const date = new Date(Number(timestamp) * 1000);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function shortAddress(address, chars = 4) {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function getStateLabel(state) {
  const labels = {
    0: 'Sale Open',
    1: 'Event Running',
    2: 'Ended',
  };
  return labels[state] || 'Unknown';
}

export function getStateColor(state) {
  const colors = {
    0: 'badge-warning',
    1: 'badge-success',
    2: 'badge-danger',
  };
  return colors[state] || 'badge-muted';
}

export function timeUntil(targetTimestamp) {
  const now = Date.now() / 1000;
  const diff = Number(targetTimestamp) - now;
  if (diff <= 0) return { expired: true, text: 'Ended' };

  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);

  if (days > 0) return { expired: false, text: `${days}d ${hours}h` };
  if (hours > 0) return { expired: false, text: `${hours}h ${minutes}m` };
  return { expired: false, text: `${minutes}m` };
}

export function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0s';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  return parts.join(' ');
}