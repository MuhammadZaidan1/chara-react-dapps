import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWalletClient } from '../hooks/index.js';
import { useEventData, useEventMetadata, useContractWrite, useListings, useTicketTier, useCategoryMetadata } from '../hooks/index.js';
import { Button, Card, Badge, Modal } from '../components/ui/index.js';
import { QRCodeModal } from '../components/ticket/QRCodeModal.jsx';
import { formatUSDG, shortAddress, parseUSDG } from '../utils/formatters.js';
import { useToast } from '../hooks/useToast.jsx';

export default function TicketDetail() {
  const { eventAddress, tokenId } = useParams();
  const navigate = useNavigate();
  
  const { walletClient, ready } = useWalletClient();
  const walletAddress = walletClient?.account?.address;
  const { execute } = useContractWrite();
  const { toast } = useToast();
  
  const { 
    tiers: tiersQuery, 
    state: stateQuery, 
    isLoading: eventLoading,
    refetch: refetchEvent
  } = useEventData(eventAddress);
  
  const { data: eventMetadata } = useEventMetadata(eventAddress);
  const { data: listings, refetch: refetchListings } = useListings(eventAddress);
  const { data: ticketTier } = useTicketTier(eventAddress, tokenId);
  const categoryMetadataUri = ticketTier?.metadataURI;
  
  // Destructure query result, lalu ambil .data-nya
  const [categoryMetadataQuery] = useCategoryMetadata(categoryMetadataUri ? [categoryMetadataUri] : []);
  const categoryMetadata = categoryMetadataQuery?.data;
  
  const [showQRModal, setShowQRModal] = useState(false);
  const [selling, setSelling] = useState(false);
  const [selectedListing, setSelectedListing] = useState(null);
  const [listingPrice, setListingPrice] = useState('');

  if (!walletClient || !ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (eventLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const state = stateQuery.data;
  const tiers = tiersQuery.data || [];
  const isSaleOpen = state === 0;

  // Mengecek apakah tiket ini sedang dilisting oleh user yang sedang login
  const currentListing = listings?.find(
    (l) => l.tokenId.toString() === tokenId.toString() && l.seller.toLowerCase() === walletAddress?.toLowerCase()
  );

  let eventName = 'Unknown Event';
  let location = '';
  let description = '';
  let imageUrl = '';
  let schedule = [];

  if (eventMetadata) {
    eventName = eventMetadata.name || eventName;
    location = eventMetadata.location || '';
    description = eventMetadata.description || '';
    imageUrl = eventMetadata.image ? eventMetadata.image.replace('ipfs://', '') : '';
    schedule = eventMetadata.schedule || [];
  }

  const tier = ticketTier || tiers[0];
  const isMarketplaceOpen = isSaleOpen;

  const handleGoBack = () => navigate(-1);

  // Kalkulasi untuk Preview Fee Marketplace
  const priceVal = parseFloat(listingPrice) || 0;
  const maxPriceVal = tier?.maxResalePrice ? parseFloat(formatUSDG(tier.maxResalePrice)) : 0;
  const isOverPriced = maxPriceVal > 0 && priceVal > maxPriceVal;

  const eoFee = priceVal * 0.06;
  const platformFee = priceVal * 0.04;
  const netReceived = priceVal * 0.90;

  // Fungsi untuk List Baru ATAU Update Harga Listing
  const handleList = async () => {
    if (!walletClient || !ready || isOverPriced) return;
    const price = parseUSDG(listingPrice);
    if (!price) return;
    
    try {
      setSelling(true);
      await execute(eventAddress, 'listTicket', [BigInt(tokenId), price]);
      setListingPrice('');
      setSelectedListing(null);
      await refetchEvent();
      await refetchListings();
      toast.success(currentListing ? 'Listing updated successfully!' : 'Ticket listed successfully!');
    } catch (e) {
      console.error('List failed:', e);
      toast.error('Transaction failed or cancelled.');
    } finally {
      setSelling(false);
    }
  };

  // Fungsi untuk Cancel Listing
  const handleCancelListing = async () => {
    if (!walletClient || !ready) return;
    try {
      setSelling(true);
      await execute(eventAddress, 'cancelListing', [BigInt(tokenId)]);
      setSelectedListing(null);
      setListingPrice('');
      await refetchEvent();
      await refetchListings();
      toast.success('Listing cancelled successfully!');
    } catch (e) {
      console.error('Cancel listing failed:', e);
      toast.error('Transaction failed or cancelled.');
    } finally {
      setSelling(false);
    }
  };

  const getStateLabel = (state) => {
    const labels = { 0: 'Sale Open', 1: 'Event Running', 2: 'Ended' };
    return labels[state] || 'Unknown';
  };
  
  const getStateColor = (state) => {
    const colors = { 0: 'warning', 1: 'success', 2: 'danger' };
    return colors[state] || 'muted';
  };

  const categoryImageUrl = categoryMetadata?.image ? categoryMetadata.image.replace('ipfs://', '') : '';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="top-0 z-40">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Button variant="ghost" size="sm" onClick={handleGoBack} className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span>Back</span>
            </Button>
            <h1 className="text-heading-lg font-semibold text-text-primary truncate mx-8">
              Ticket Detail
            </h1>
            <div className="w-20" />
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 space-y-4 xs:space-y-3 lg:space-y-6">
        {/* Event Detail - Side by side: Image (1/3) + Details (2/3) */}
        <Card className="space-y-0">
          <div className="grid gap-4 xs:gap-3 lg:gap-6 lg:grid-cols-3">
            {/* Event Image - 1/3 width, square */}
            <div className="lg:col-span-1">
              <div className="aspect-square w-full rounded-xl overflow-hidden bg-background">
                {imageUrl ? (
                  <img
                    src={`https://gateway.pinata.cloud/ipfs/${imageUrl}`}
                    alt={eventName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-primary-soft flex items-center justify-center">
                    <svg className="w-20 h-20 xs:w-16 xs:h-16 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                )}
                <Badge variant={getStateColor(state)} className="absolute top-3 left-3 xs:top-2 xs:left-2 badge-brutal xs:px-2 xs:py-0.5 xs:text-[11px]">
                  {getStateLabel(state)}
                </Badge>
              </div>
            </div>

            {/* Event Details - 2/3 width */}
            <div className="lg:col-span-2 space-y-3 xs:space-y-2 p-3 xs:p-4 lg:pl-6">
              <h2 className="text-heading-xl xs:text-heading-lg font-bold text-text-primary">{eventName}</h2>
              
              {location && (
                <div className="flex items-center gap-2 xs:gap-1.5 text-text-secondary">
<svg className="w-5 h-5 xs:w-4 xs:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {location}
                </div>
              )}

              {schedule.length > 0 && (
                <div className="flex items-start gap-2 xs:gap-1.5 text-text-secondary">
                  <svg className="w-5 h-5 xs:w-4 xs:h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <div className="flex flex-col gap-1">
                    {schedule.map((s, i) => (
                      <span key={i} className="text-sm xs:text-xs">
                        {s.date} {s.startTime || '00:00'} - {s.endTime || '23:59'}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {description && (
                <p className="text-text-secondary xs:text-sm">{description}</p>
              )}
            </div>
          </div>
        </Card>

        {/* Ticket Detail - Side by side: Category Image (1/3) + Details (2/3) */}
        <Card className="space-y-0 border-primary mt-6">
          <div className="grid gap-2 xs:gap-3 lg:gap-2 lg:grid-cols-3">
            {/* Category Image - 1/3 width, smaller */}
            <div className="lg:col-span-1 flex items-center justify-center">
              <div className="w-full max-w-55 aspect-square rounded-lg overflow-hidden bg-background mx-auto">
                {categoryImageUrl ? (
                  <img
                    src={`https://gateway.pinata.cloud/ipfs/${categoryImageUrl}`}
                    alt={tier?.category || 'Category'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-primary-soft flex items-center justify-center">
                    <svg className="w-12 h-12 xs:w-10 xs:h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 002-2H6a2 2 0 002-2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>
            </div>

            {/* Ticket Details - 2/3 width */}
            <div className="lg:col-span-2 space-y-2 xs:space-y-1.5 p-2 xs:p-3">
              <div className="flex items-center justify-between">
                <h3 className="text-heading-lg xs:text-heading-md font-semibold text-text-primary">Ticket Details</h3>
                <Badge variant="primary">{tier?.category || 'Unknown'} Pass</Badge>
              </div>
              
              <div className="grid gap-2 xs:gap-3 sm:grid-cols-2 text-sm xs:text-xs">
                <div>
                  <p className="text-text-muted">Token ID</p>
                  <p className="font-mono text-text-primary">#{tokenId}</p>
                </div>
                <div>
                  <p className="text-text-muted">Phase</p>
                  <p className="font-mono text-text-primary">{tier?.phase || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-text-muted">Category</p>
                  <p className="font-mono text-text-primary">{tier?.category || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-text-muted">Price</p>
                  <p className="font-mono text-text-primary">{tier?.price ? formatUSDG(tier.price) : 'N/A'} mUSDG</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-text-muted">Event Contract</p>
                  <p className="font-mono text-text-primary truncate">{shortAddress(eventAddress)}</p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Button 
            variant="primary" 
            size="lg"
            onClick={() => setShowQRModal(true)}
            className="flex-1 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Show QR Code
          </Button>
          
          {isMarketplaceOpen && (
            <Button 
              variant="secondary" 
              size="lg"
              onClick={() => {
                setSelectedListing({ tokenId: BigInt(tokenId) });
                setListingPrice(currentListing ? formatUSDG(currentListing.price) : '');
              }}
              className="flex-1"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6h12a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h6" />
              </svg>
              {currentListing ? 'Manage Listing' : 'Sell Ticket'}
            </Button>
          )}
          
          {!isMarketplaceOpen && (
            <Button 
              variant="secondary" 
              size="lg"
              disabled
              className="flex-1 opacity-50"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6h12a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h6" />
              </svg>
              Marketplace Closed
            </Button>
          )}
        </div>

        {/* Contract Info */}
        <Card className="bg-background border-border">
          <p className="text-caption text-text-muted">
            Contract: <span className="font-mono text-text-primary">{shortAddress(eventAddress)}</span> | 
            Chain: Robinhood Testnet (46630)
          </p>
        </Card>
      </div>

      {/* QR Code Modal */}
      <QRCodeModal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        tokenId={BigInt(tokenId)}
        contractAddress={eventAddress}
        size={256}
      />

      {/* Listing Modal */}
      {selectedListing && isMarketplaceOpen && (
        <Modal
          isOpen={true}
          onClose={() => { setSelectedListing(null); setListingPrice(''); }}
          title={currentListing ? "Manage Listing" : "Sell Ticket"}
          size="sm"
        >
          <div className="space-y-4">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  Price (mUSDG)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Enter price"
                  value={listingPrice}
                  onChange={(e) => setListingPrice(e.target.value)}
                  className={`input w-full ${isOverPriced ? 'border-danger focus:ring-danger' : ''}`}
                />
                <div className="flex justify-between items-center mt-1.5">
                  <p className={`text-caption ${isOverPriced ? 'text-danger font-medium' : 'text-text-muted'}`}>
                    Max resale price: {tier?.maxResalePrice ? formatUSDG(tier.maxResalePrice) : 'N/A'} mUSDG
                  </p>
                </div>
              </div>

              {/* Fee Breakdown & Revenue Preview */}
              {priceVal > 0 && (
                <div className="bg-background rounded-lg border border-border p-3 space-y-2 text-sm">
                  <div className="flex justify-between text-text-secondary">
                    <span>Listing Price</span>
                    <span className="font-mono">{priceVal.toFixed(2)} mUSDG</span>
                  </div>
                  <div className="flex justify-between text-text-muted text-xs">
                    <span>EO Royalty (6%)</span>
                    <span className="font-mono">- {eoFee.toFixed(2)} mUSDG</span>
                  </div>
                  <div className="flex justify-between text-text-muted text-xs">
                    <span>Platform Fee (4%)</span>
                    <span className="font-mono">- {platformFee.toFixed(2)} mUSDG</span>
                  </div>
                  <div className="border-t border-border/50 pt-2 flex justify-between font-medium text-text-primary mt-1">
                    <span>You will receive</span>
                    <span className="font-mono text-success">{netReceived.toFixed(2)} mUSDG</span>
                  </div>
                </div>
              )}
              
              <div className="flex justify-end gap-3 mt-4">
                {currentListing ? (
                  <>
                    <Button variant="secondary" onClick={handleCancelListing} disabled={selling}>
                      {selling ? 'Processing...' : 'Cancel Listing'}
                    </Button>
                    <Button onClick={handleList} disabled={selling || !listingPrice || isOverPriced || priceVal <= 0}>
                      {selling ? 'Processing...' : 'Update Listing'}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="secondary" onClick={() => { setSelectedListing(null); setListingPrice(''); }} disabled={selling}>
                      Cancel
                    </Button>
                    <Button onClick={handleList} disabled={selling || !listingPrice || isOverPriced || priceVal <= 0}>
                      {selling ? 'Listing...' : 'List Ticket'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Marketplace Closed Modal */}
      {selectedListing && !isMarketplaceOpen && (
        <Modal
          isOpen={true}
          onClose={() => { setSelectedListing(null); setListingPrice(''); }}
          title="Marketplace Closed"
          size="sm"
        >
          <div className="text-center space-y-4">
            <p className="text-text-secondary">
              The marketplace is currently closed. You can only sell tickets when the sale is open (before the event starts).
            </p>
            <Button onClick={() => { setSelectedListing(null); setListingPrice(''); }}>
              OK
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}