import { useState, useCallback, useRef } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { readContract } from '../../utils/viemHelpers.js';
import { ABIS } from '../../config/index.js';
import { parseQRPayload } from '../../utils/qr.js';
import { Button, Card, Badge } from '../../components/ui/index.js';
import { formatTime, shortAddress } from '../../utils/formatters.js';

function getBrowserName() {
  if (typeof navigator === 'undefined') return 'Unknown';
  const ua = navigator.userAgent;
  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('Chrome/') && !ua.includes('Edg/')) return 'Chrome';
  if (ua.includes('Firefox/')) return 'Firefox';
  if (ua.includes('Safari/') && !ua.includes('Chrome/')) return 'Safari';
  return 'Unknown';
}

export function GateScanner({ eventAddress, isEventRunning }) {
  const [scannerMode, setScannerMode] = useState(false);
  const [lastScan, setLastScan] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [debugInfo, setDebugInfo] = useState({});
  
  // Storage states
  const [scanLogs, setScanLogs] = useState(() => {
    try {
      const stored = sessionStorage.getItem(`scanner_logs_${eventAddress}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  
  const [scannedTokens, setScannedTokens] = useState(() => {
    try {
      const stored = sessionStorage.getItem(`scanned_tokens_${eventAddress}`);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const lastScannedTextRef = useRef(null);
  const lastScannedTimeRef = useRef(0);
  const isProcessingRef = useRef(false);

  const saveLogs = useCallback((logs) => {
    try {
      sessionStorage.setItem(`scanner_logs_${eventAddress}`, JSON.stringify(logs.slice(0, 99)));
    } catch { /* empty */ }
  }, [eventAddress]);

  const handleScan = useCallback(async (result) => {
    const decodedText = Array.isArray(result) ? result[0]?.rawValue : result?.text || result;
    
    if (typeof decodedText !== 'string' || !decodedText || isProcessingRef.current) return;

    const now = Date.now();
    if (lastScannedTextRef.current === decodedText && now - lastScannedTimeRef.current < 3000) return; 

    lastScannedTextRef.current = decodedText;
    lastScannedTimeRef.current = now;
    isProcessingRef.current = true;

    try {
      const parsed = parseQRPayload(decodedText);
      if (!parsed) throw new Error('QR format not recognized (Not a Chara ticket)');
      if (parsed.contractAddress.toLowerCase() !== eventAddress.toLowerCase()) {
        throw new Error(`Ticket REJECTED: Ticket for another event! (${shortAddress(parsed.contractAddress)})`);
      }

      const tokenIdStr = parsed.tokenId.toString();
      if (scannedTokens.has(tokenIdStr)) throw new Error(`Ticket #${tokenIdStr} ALREADY USED!`);

      const owner = await readContract({
        address: eventAddress,
        abi: ABIS.eventTicket,
        functionName: 'ownerOf',
        args: [parsed.tokenId],
      });

      const successResult = {
        valid: true,
        tokenId: tokenIdStr,
        holder: owner,
        reason: `Ticket #${tokenIdStr} VALID!`,
        timestamp: Date.now(),
        raw: decodedText
      };

      setLastScan(successResult);
      setScanLogs(prev => { const n = [successResult, ...prev.slice(0, 99)]; saveLogs(n); return n; });
      setScannedTokens(prev => {
        const newSet = new Set(prev);
        newSet.add(tokenIdStr);
        try { sessionStorage.setItem(`scanned_tokens_${eventAddress}`, JSON.stringify(Array.from(newSet))); } catch { /* empty */ }
        return newSet;
      });

    } catch (e) {
      const errorResult = { 
        valid: false, tokenId: '-', holder: '-', reason: e.message || 'Validation failed', timestamp: Date.now(), raw: decodedText
      };
      setLastScan(errorResult);
      setScanLogs(prev => { const n = [errorResult, ...prev.slice(0, 99)]; saveLogs(n); return n; });
    } finally {
      isProcessingRef.current = false;
    }
  }, [eventAddress, scannedTokens, saveLogs]);

  const handleError = useCallback((error) => {
    const errMsg = error?.message || String(error);
    setCameraError(errMsg);
    setScannerMode(false); // Matikan state scanner saat error
    setDebugInfo(prev => ({ ...prev, lastError: errMsg, errorTime: new Date().toISOString() }));
  }, []);

  const toggleScanner = () => {
    setScannerMode(!scannerMode);
    setCameraError(null);
  };

  const exportLogs = () => {
    const csv = [
      ['Timestamp', 'Token ID', 'Holder', 'Status', 'Message', 'Raw Payload'],
      ...scanLogs.map(log => [
        new Date(log.timestamp).toISOString(), log.tokenId, log.holder, log.valid ? 'Valid' : 'Invalid', log.reason, log.raw || '-'
      ]),
    ].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gate-scanner-${eventAddress.slice(0,6)}-${Date.now()}.csv`;
    a.click();
  };

  const clearLogs = () => {
    if (window.confirm('Clear history on this device?')) {
      setScanLogs([]); setScannedTokens(new Set()); setLastScan(null);
      sessionStorage.removeItem(`scanner_logs_${eventAddress}`);
      sessionStorage.removeItem(`scanned_tokens_${eventAddress}`);
    }
  };

  const isSecure = typeof window !== 'undefined' ? window.isSecureContext : true;
  const isCameraActive = scannerMode && !cameraError && isEventRunning;

  return (
    <div className="space-y-4 xs:space-y-3 lg:space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between flex-wrap gap-3 xs:gap-2">
        <div className="flex items-center gap-3 xs:gap-2">
          <h2 className="text-heading-lg xs:text-heading-md font-semibold text-text-primary">Gate Scanner</h2>
          <Badge variant={!isEventRunning ? 'warning' : isCameraActive ? 'success' : cameraError ? 'danger' : 'default'} className="ml-2 xs:ml-1.5">
            {!isEventRunning ? 'Disabled' : isCameraActive ? 'Active' : cameraError ? 'Error' : 'Idle'}
          </Badge>
        </div>
        <div className="flex items-center gap-2 xs:gap-1.5 flex-wrap w-full xs:w-auto">
          <Button 
            variant={scannerMode ? 'danger' : 'primary'} 
            onClick={toggleScanner}
            disabled={!isEventRunning}
            className="w-full xs:w-auto"
          >
            {scannerMode ? 'Stop Scanner' : 'Start Scanner'}
          </Button>
          <Button variant="secondary" size="sm" onClick={exportLogs} disabled={!scanLogs.length} className="w-full xs:w-auto">
            Export CSV
          </Button>
          {/* Clear Button disabled kalau event nggak jalan, biar data aman */}
          <Button variant="ghost" size="sm" onClick={clearLogs} disabled={!scanLogs.length || !isEventRunning} className="w-full xs:w-auto">
            Clear Logs
          </Button>
        </div>
      </div>

      {/* FIXED CAMERA PANEL */}
      <Card className="space-y-3 xs:space-y-2 lg:space-y-4 p-4 xs:p-6 bg-surface border-border">
        <div 
          className={`w-full max-w-full mx-auto rounded-xl overflow-hidden border-2 relative flex flex-col items-center justify-center transition-all duration-300 ${isCameraActive ? 'bg-black border-primary' : 'bg-background border-border border-dashed'}`} 
          style={{ aspectRatio: '4/3', maxWidth: '40%' }}
        >
          {!isEventRunning ? (
            // EVENT NOT RUNNING STATE
            <div className="text-center p-6 flex flex-col items-center justify-center h-full">
              <div className="w-16 h-16 bg-warning/10 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <p className="text-text-primary font-semibold mb-1">Camera Access Closed</p>
              <p className="text-sm text-text-secondary">Scanner only available while event is running.</p>
            </div>
          ) : cameraError ? (
            // CAMERA ERROR STATE
            <div className="text-center p-6 flex flex-col items-center justify-center h-full bg-danger/5 w-full">
              <div className="w-16 h-16 bg-danger/10 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-danger font-semibold mb-2">Failed to Access Camera</p>
              <p className="text-xs text-text-muted mb-4">{cameraError}</p>
              <Button size="sm" onClick={() => { setCameraError(null); setScannerMode(true); }}>Try Again</Button>
            </div>
          ) : !scannerMode ? (
            // IDLE STATE (Ready to Start)
            <div className="text-center p-6 flex flex-col items-center justify-center h-full w-full">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-text-secondary mb-4 text-sm">Camera is inactive.</p>
              <Button onClick={toggleScanner}>Open Camera</Button>
            </div>
          ) : (
            // ACTIVE SCANNER STATE
            <>
              <Scanner
                onScan={handleScan}
                onError={handleError}
                formats={['qr_code']}
                constraints={{ width: { ideal: 640, max: 1920 }, height: { ideal: 480, max: 1080 } }}
                components={{ audio: false, onOff: false, torch: false, zoom: false, finder: true }}
                styles={{ container: { width: '100%', height: '100%' }, video: { objectFit: 'cover' } }}
              />
              <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none">
                <span className="bg-black/60 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs">
                  Point at ticket QR Code
                </span>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* SCAN RESULT CARD */}
      {lastScan && (
        <Card className={`border-${lastScan.valid ? 'success' : 'danger'} shadow-sm`}>
          <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-2 mb-2 xs:mb-2 lg:mb-2 border-b border-border/50 pb-2">
            <h3 className="font-semibold text-text-primary flex items-center gap-2 xs:text-sm">
              Scan Status: 
              <span className={`font-bold px-2 py-0.5 rounded text-white xs:px-1.5 xs:py-px ${lastScan.valid ? 'bg-success' : 'bg-danger'}`}>
                {lastScan.valid ? 'VALID (ENTRY ALLOWED)' : 'INVALID (REJECTED)'}
              </span>
            </h3>
            <span className="text-xs xs:text-[11px] text-text-muted">{formatTime(Math.floor(lastScan.timestamp / 1000))}</span>
          </div>
          <div className="space-y-2 mt-3 xs:mt-2">
            <p className="text-sm xs:text-xs"><strong>Message:</strong> {lastScan.reason}</p>
            <div className="grid grid-cols-2 gap-3 xs:gap-2 text-sm xs:text-xs bg-background p-3 xs:p-2 rounded-md">
              <div>
                <p className="text-text-muted text-xs xs:text-[11px]">Token ID</p>
                <p className="font-mono">{lastScan.tokenId}</p>
              </div>
              <div>
                <p className="text-text-muted text-xs xs:text-[11px]">Ticket Holder</p>
                <p className="font-mono truncate">{lastScan.holder}</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* HISTORY TABLE */}
      <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-2 mt-4 xs:mt-3">
        <h3 className="text-heading-md xs:text-heading-sm font-semibold text-text-primary">Check-In History ({scanLogs.length})</h3>
      </div>
      
      <div className="overflow-x-auto bg-surface border border-border rounded-lg">
        <table className="w-full text-sm xs:text-xs">
          <thead>
            <tr className="border-b border-border text-left text-text-muted bg-background">
              <th className="py-2 xs:py-1.5 px-3 xs:px-2 font-medium">Time</th>
              <th className="py-2 xs:py-1.5 px-3 xs:px-2 font-medium">Token ID</th>
              <th className="py-2 xs:py-1.5 px-3 xs:px-2 font-medium">Ticket Holder</th>
              <th className="py-2 xs:py-1.5 px-3 xs:px-2 font-medium">Status / Message</th>
            </tr>
          </thead>
          <tbody>
            {!scanLogs.length ? (
              <tr>
                <td colSpan="4" className="text-center py-6 xs:py-4 text-text-muted">No tickets scanned yet</td>
              </tr>
            ) : (
              scanLogs.map((log, idx) => (
                <tr key={idx} className="border-b border-border/30 hover:bg-background/50 transition-colors">
                  <td className="py-2 xs:py-1.5 px-3 xs:px-2 text-text-muted whitespace-nowrap">
                    {formatTime(Math.floor(log.timestamp / 1000))}
                  </td>
                  <td className="py-2 xs:py-1.5 px-3 xs:px-2 font-mono font-medium">
                    #{log.tokenId}
                  </td>
                  <td className="py-2 xs:py-1.5 px-3 xs:px-2 font-mono truncate">
                    {shortAddress(log.holder)}
                  </td>
                  <td className="py-2 xs:py-1.5 px-3 xs:px-2">
                    <div className="flex items-center gap-2 xs:gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${log.valid ? 'bg-success' : 'bg-danger'}`} />
                      <span className={log.valid ? 'text-text-primary' : 'text-danger'}>{log.reason}</span>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <details className="mt-6 xs:mt-4 lg:mt-8 border border-border rounded-lg bg-background">
        <summary className="p-3 xs:p-4 cursor-pointer flex items-center justify-between text-sm xs:text-xs font-medium text-text-secondary">
          <span>Camera Debug Info</span>
          <svg className="w-4 h-4 xs:w-3.5 xs:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </summary>
        <div className="p-3 xs:p-4 border-t border-border text-xs xs:text-[11px] font-mono text-text-muted space-y-2 overflow-auto">
          <div><strong>Browser:</strong> {getBrowserName()}</div>
          <div><strong>Secure Context (HTTPS):</strong> {String(isSecure)}</div>
          <div><strong>Camera Active:</strong> {String(isCameraActive)}</div>
          {debugInfo.lastError && (
            <div className="text-danger mt-2">
              <strong>Last Error:</strong> {debugInfo.lastError} <br/>
              <span className="text-text-muted">Time: {debugInfo.errorTime}</span>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}