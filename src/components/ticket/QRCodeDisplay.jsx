import { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import { useWalletClient } from '../../hooks/index.js';
import { createQRPayload, signQRPayload } from '../../utils/qr.js';
import { shortAddress } from '../../utils/formatters.js';
import { Button } from '../../components/ui/index.js';

export function QRCodeDisplay({ 
  tokenId, 
  contractAddress, 
  size = 120, 
  variant = 'compact', // 'compact' | 'full'
  onSign 
}) {
  const { walletClient } = useWalletClient();
  const [qrData, setQrData] = useState(null);
  const [signature, setSignature] = useState(null);
  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState(null);

  // Responsive size calculation
  const responsiveSize = typeof window !== 'undefined' 
    ? Math.min(size, window.innerWidth * 0.4, window.innerHeight * 0.3)
    : size;

  const sign = useCallback(async () => {
    if (!walletClient || !qrData) return null;
    
    setIsSigning(true);
    setError(null);
    
    try {
      const sig = await signQRPayload(qrData, walletClient);
      setSignature(sig);
      onSign?.(sig);
      return sig;
    } catch (e) {
      console.error('QR signing failed:', e);
      setError('Failed to sign QR code');
      return null;
    } finally {
      setIsSigning(false);
    }
  }, [walletClient, qrData, onSign]);

  useEffect(() => {
    if (!walletClient) return;
    const payload = createQRPayload(tokenId, contractAddress);
    setQrData(payload);
    setSignature(null);
    setError(null);
  }, [tokenId, contractAddress, walletClient]);

  // Auto-sign on mount only if variant is 'full' (for backward compatibility)
  // For 'compact' variant, signing is manual via sign() function
  useEffect(() => {
    if (variant === 'full' && qrData && !signature && !isSigning) {
      sign();
    }
  }, [qrData, signature, isSigning, variant, sign]);

  if (!qrData) {
    return (
      <div className="w-[120px] h-[120px] xs:w-[100px] xs:h-[100px] bg-background rounded-lg flex items-center justify-center border border-border">
        <div className="animate-spin rounded-full h-8 w-8 xs:h-6 xs:w-6 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="relative">
        <div className="border-2 border-text-primary rounded-lg p-2 bg-surface badge-brutal">
          <QRCode 
            value={qrData}
            size={responsiveSize}
            level="M"
            includeMargin={true}
            bgColor="#FFFFFF"
            fgColor="#292524"
          />
        </div>
        {isSigning && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-40 xs:w-36 bg-surface rounded-lg shadow-[var(--shadow-modal)] border border-border p-1 text-xs xs:text-[11px] text-text-muted text-center whitespace-nowrap">
            <div className="flex items-center justify-center gap-1">
              <svg className="animate-spin w-3 h-3 xs:w-2.5 xs:h-2.5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Signing...</span>
            </div>
          </div>
        )}
        {signature && !isSigning && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-40 xs:w-36 bg-surface rounded-lg shadow-[var(--shadow-modal)] border border-border p-1 text-xs xs:text-[11px] text-success text-center whitespace-nowrap">
            <span>Signed: {shortAddress(signature)}</span>
          </div>
        )}
      </div>
    );
  }

  // Full variant - shows QR with sign button
  return (
    <div className="border-2 border-text-primary rounded-lg p-3 xs:p-4 bg-surface badge-brutal flex flex-col items-center gap-3 xs:gap-2">
      <QRCode 
        value={qrData}
        size={responsiveSize}
        level="M"
        includeMargin={true}
        bgColor="#FFFFFF"
        fgColor="#292524"
      />
      
      <div className="w-full space-y-2 xs:space-y-1.5 text-center text-xs xs:text-[11px]">
        <div className="font-mono text-text-secondary break-all bg-background px-3 py-2 rounded">
          {qrData}
        </div>
        
        {isSigning && (
          <div className="flex items-center justify-center gap-2 xs:gap-1.5 text-warning">
            <svg className="animate-spin w-4 h-4 xs:w-3.5 xs:h-3.5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Signing...</span>
          </div>
        )}
        
        {signature && !isSigning && (
          <div className="font-mono text-success text-center flex items-center justify-center gap-2 xs:gap-1.5">
            <svg className="w-4 h-4 xs:w-3.5 xs:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Signed: {shortAddress(signature)}</span>
          </div>
        )}
        
        {!signature && !isSigning && (
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={sign}
            disabled={isSigning}
            className="w-full"
          >
            Sign QR Code
          </Button>
        )}
        
        {error && (
          <div className="text-danger text-center">
            {error}
            <button onClick={sign} className="text-primary underline text-xs xs:text-[11px] ml-2 xs:ml-1">
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}