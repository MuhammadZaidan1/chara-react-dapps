import { useState, useEffect } from 'react';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import { useWalletClient } from '../../hooks/index.js';
import { createQRPayload, signQRPayload } from '../../utils/qr.js';
import { shortAddress } from '../../utils/formatters.js';
import { Modal, Button } from '../../components/ui/index.js';

export function QRCodeModal({ isOpen, onClose, tokenId, contractAddress, size = 256 }) {
  const responsiveSize = typeof window !== 'undefined' 
    ? Math.min(size, window.innerWidth * 0.9, window.innerHeight * 0.6)
    : size;
  const { walletClient } = useWalletClient();
  const [qrData, setQrData] = useState(null);
  const [signature, setSignature] = useState(null);
  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState(null);

  // Generate payload when modal opens (without signing)
  useEffect(() => {
    if (!isOpen) return;
    const payload = createQRPayload(tokenId, contractAddress);
    setQrData(payload);
    setSignature(null);
    setError(null);
  }, [isOpen, tokenId, contractAddress]);

  const handleSign = async () => {
    if (!walletClient || !qrData) return;
    
    setIsSigning(true);
    setError(null);
    
    try {
      const sig = await signQRPayload(qrData, walletClient);
      setSignature(sig);
    } catch (e) {
      console.error('QR signing failed:', e);
      setError('Failed to sign QR code. Please try again.');
    } finally {
      setIsSigning(false);
    }
  };

  // Auto-sign when modal opens
  useEffect(() => {
    if (isOpen && qrData && !signature && !isSigning) {
      handleSign();
    }
  }, [isOpen, qrData, signature, isSigning]);

  if (!isOpen) return null;

  return (
    <Modal isOpen={true} onClose={onClose} title="Ticket QR Code" size="sm">
      <div className="space-y-3 xs:space-y-2 lg:space-y-4">
        {qrData && (
          <div className="flex flex-col items-center gap-3 xs:gap-2 lg:gap-4">
            <div className="border-2 border-text-primary rounded-lg p-3 xs:p-4 bg-surface badge-brutal">
              <QRCode 
                value={qrData}
                size={responsiveSize}
                level="M"
                includeMargin={true}
                bgColor="#FFFFFF"
                fgColor="#292524"
              />
            </div>
            
            <div className="w-full text-center space-y-2 xs:space-y-1.5 text-xs xs:text-[11px]">
              <div className="font-mono text-text-secondary break-all bg-background px-3 py-2 rounded">
                {qrData}
              </div>
              
              {signature && (
                <div className="font-mono text-success text-center flex items-center justify-center gap-2 xs:gap-1.5">
                  <svg className="w-4 h-4 xs:w-3.5 xs:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Signed: {shortAddress(signature)}</span>
                </div>
              )}
              
              {isSigning && (
                <div className="flex items-center justify-center gap-2 xs:gap-1.5 text-warning">
                  <svg className="animate-spin w-4 h-4 xs:w-3.5 xs:h-3.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Signing...</span>
                </div>
              )}
              
              {error && (
                <div className="text-danger text-center">
                  {error}
                  <Button variant="ghost" size="xs" onClick={handleSign} className="mt-1 xs:mt-0.5">
                    Retry
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
        
        {!qrData && (
          <div className="flex items-center justify-center h-48 xs:h-40 lg:h-64">
            <div className="animate-spin rounded-full h-10 w-10 xs:h-8 xs:w-8 lg:h-12 lg:w-12 border-3 xs:border-2 lg:border-4 border-primary border-t-transparent" />
          </div>
        )}
      </div>
    </Modal>
  );
}