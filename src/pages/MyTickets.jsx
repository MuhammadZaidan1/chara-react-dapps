import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWalletClient } from '../hooks/index.js';
import { useUserTickets, useContractWrite, useVerificationStatus } from '../hooks/index.js';
import { Button, Card, Badge, Modal } from '../components/ui/index.js';
import { shortAddress } from '../utils/formatters.js';
import { useQueryClient } from '@tanstack/react-query';

export default function MyTickets() {
  const navigate = useNavigate();
  const { walletClient, ready } = useWalletClient();
  const walletAddress = walletClient?.account?.address;
  const { data: tickets, isLoading } = useUserTickets(walletAddress);
  const { execute } = useContractWrite();
  const { data: isVerified, refetch: refetchVerification } = useVerificationStatus(walletAddress);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  
  const queryClient = useQueryClient();
  
  console.log('[DEBUG MyTickets] Component rendered:', { walletAddress, ticketsCount: tickets?.length, isLoading, ready, hasWalletClient: !!walletClient });
  console.log('[DEBUG MyTickets] Tickets data:', tickets);
  
  const handleRefresh = () => {
    console.log('[DEBUG MyTickets] Manual refresh clicked');
    queryClient.invalidateQueries({ queryKey: ['userTickets'] });
    queryClient.invalidateQueries({ queryKey: ['factory'] });
  };
  
  const handleDebugRefetch = () => {
    console.log('[DEBUG MyTickets] Debug refetch - invalidating all');
    queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'userTickets' });
    queryClient.invalidateQueries({ queryKey: ['factory'] });
    queryClient.refetchQueries({ queryKey: ['userTickets'] });
  };

  // FUNGSI EKSEKUSI VERIFIKASI (Menghindari crash undefined function)
  const handleVerify = async () => {
    try {
      await execute('mockHumanVerifier', 'verifyMe', []);
      await refetchVerification();
      setShowVerifyModal(false);
    } catch (e) {
      console.error('Verify failed:', e);
    }
  };

  // Wait for wallet client to be fully initialized
  if (!walletClient) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
        <p className="ml-4 text-text-secondary">Connecting wallet...</p>
      </div>
    );
  }
  
  if (!ready) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 xs:mb-4">
        <div>
          <h1 className="text-display-lg xs:text-display-md font-display font-bold text-text-primary">
            My Tickets
          </h1>
          <p className="text-text-secondary xs:text-sm mt-1">
            Manage your event tickets and QR codes
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 xs:gap-1.5">
          <Button variant="secondary" size="sm" onClick={handleRefresh}>
            Refresh
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDebugRefetch} className="text-xs text-muted">
            🐛 Debug Refetch
          </Button>
          {!isVerified && (
            <Button variant="secondary" onClick={() => setShowVerifyModal(true)}>
              Verify Me
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
        </div>
      ) : !tickets?.length ? (
        <Card className="text-center py-12 xs:py-8">
          <svg className="mx-auto h-12 w-12 xs:h-10 xs:w-10 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
          </svg>
          <h3 className="mt-4 text-heading-md xs:text-heading-sm text-text-primary">No tickets yet</h3>
          <p className="mt-2 text-text-secondary xs:text-sm">Buy tickets from the Explore page to see them here</p>
        </Card>
      ) : (
        <div className="space-y-3 xs:space-y-2">
          {tickets.map((ticket) => (
            <Card 
              key={ticket.tokenId.toString()} 
              className="cursor-pointer hover:shadow-[var(--shadow-modal)] transition-shadow"
              onClick={() => navigate(`/ticket/${ticket.eventAddress}/${ticket.tokenId}`)}
            >
              <div className="flex flex-col sm:flex-row gap-4 xs:gap-3 items-start sm:items-center">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-heading-md xs:text-heading-sm font-semibold text-text-primary truncate">
                      {ticket.tier?.category || 'Unknown'} Pass
                    </h3>
                    <Badge variant="default">{ticket.tier?.phase || 'Unknown'}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-3 xs:gap-2 text-sm xs:text-xs text-text-secondary">
                    <span className="font-mono">Token #{ticket.tokenId.toString()}</span>
                    <span>Event: {shortAddress(ticket.eventAddress)}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={showVerifyModal}
        onClose={() => setShowVerifyModal(false)}
        title="Verify Identity"
        size="sm"
      >
        <div className="space-y-4 text-center">
          <p className="text-text-secondary">
            Click the button below to verify your identity on-chain.
            This is required for buying and selling tickets.
          </p>
          <Button 
            onClick={handleVerify} 
            disabled={isVerified}
            className="w-full"
            size="lg"
          >
            {isVerified ? 'Already Verified' : 'Verify Me'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}