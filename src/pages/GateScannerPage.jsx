import { useParams, Link } from 'react-router-dom';
import { useEventData } from '../hooks/index.js';
import { GateScanner } from '../components/ticket/GateScanner.jsx';
import { Card, Button, Badge } from '../components/ui/index.js';
import { getStateLabel, getStateColor } from '../utils/formatters.js';

export default function GateScannerPage() {
  const { eventAddress } = useParams();
  
  const { state: stateQuery, isLoading, error, refetch } = useEventData(eventAddress);
  
  const state = stateQuery.data;
  const isEventRunning = state === 1;
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="text-center max-w-md mx-4">
          <p className="text-danger mb-4">Failed to load event data</p>
          <Button onClick={() => refetch()} variant="primary">
            Coba Lagi
          </Button>
        </Card>
      </div>
    );
  }
  
  const stateLabel = getStateLabel(state);
  const stateColor = getStateColor(state);
  
  return (
    <div className="min-h-screen bg-background">
      <div className="top-0 z-40">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-8">
            <Link to={`/organizer/event/${eventAddress}`} className="flex items-center gap-2 text-heading-lg font-display font-bold text-text-primary">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </Link>
            <div className="flex items-center gap-3">
              <Badge variant={stateColor}>{stateLabel}</Badge>
            </div>
          </div>
        </div>
      </div>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!window.isSecureContext && window.location.protocol !== 'http:' && (
          <Card className="mb-6 border-warning bg-warning/5" role="alert">
            <div className="flex items-start gap-3 p-4">
              <svg className="w-5 h-5 text-warning shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="text-sm text-text-secondary">
                <strong>Insecure Context:</strong> Camera API requires HTTPS. 
                This page is loaded via HTTP. Camera will not work until deployed with HTTPS.
              </div>
            </div>
          </Card>
        )}

        {/* Kita langsung lempar isEventRunning ke komponen, biar komponen yg ngatur tampilannya */}
        <GateScanner 
          eventAddress={eventAddress} 
          isEventRunning={isEventRunning}
        />
      </main>
    </div>
  );
}