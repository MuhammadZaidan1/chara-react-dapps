import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useWalletClient } from '../hooks/index.js';
import { useEventData, useListings, useContractWrite, useVerificationStatus, useEventMetadata } from '../hooks/index.js';
import { Tabs, Button, Card, Badge, Input, Modal } from '../components/ui/index.js';
import { formatUSDG, formatTime, shortAddress, parseUSDG } from '../utils/formatters.js';
import { CONTRACT_CONSTANTS } from '../config/constants.js';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../hooks/useToast.jsx';

export default function EventDetail() {
  const { address } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'buy';
  
  const { walletClient, ready } = useWalletClient();
  const walletAddress = walletClient?.account?.address;
  const { data: isVerified, refetch: refetchVerification } = useVerificationStatus(walletAddress);
  const { executeTwoStep, execute } = useContractWrite();
  const { 
    tiers: tiersQuery, 
    state: stateQuery, 
    times: timesQuery,
    demoTimeOffset: demoTimeOffsetQuery,
    isLoading,
    refetch 
  } = useEventData(address);
  
  const { data: eventMetadata } = useEventMetadata(address);
  
  const { data: listings, refetch: refetchListings } = useListings(address);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [cart, setCart] = useState({}); // { [tierIndex]: { qty: number, recipients: string[] } }
  const [listingPrice, setListingPrice] = useState('');
  const [selectedListing, setSelectedListing] = useState(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [buyingListing, setBuyingListing] = useState(null);
  const [realNow, setRealNow] = useState(() => Date.now() / 1000);
  const [minting, setMinting] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setRealNow(Date.now() / 1000), 1000);
    return () => clearInterval(interval);
  }, []);

  const state = stateQuery.data;
  const tiers = tiersQuery.data || [];
  const times = timesQuery.data;
  const demoTimeOffsetValue = demoTimeOffsetQuery?.data || 0n;
  const demoNow = realNow + Number(demoTimeOffsetValue);
  const isSaleOpen = state === 0;
  const isEventRunning = state === 1;
  const isEnded = state === 2;

  // Wait for wallet client to be fully initialized before rendering interactive UI
  if (!walletClient) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
        <p className="ml-4 text-text-secondary">Connecting wallet...</p>
      </div>
    );
  }

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

  const handleList = async (tokenId) => {
    if (!walletClient || !ready) return;
    const price = parseUSDG(listingPrice);
    if (!price) return;
    
    try {
      await execute(address, 'listTicket', [BigInt(tokenId), price]);
      await refetchListings();
      setListingPrice('');
      setSelectedListing(null);
      toast.success('Ticket listed successfully!');
    } catch (e) {
      console.error('List failed:', e);
    }
  };

  const handleBuyListing = async (listing) => {
    if (!walletClient || !ready) return;
    if (!isVerified) {
      setShowVerifyModal(true);
      setBuyingListing(listing);
      return;
    }
    
    try {
      await executeTwoStep('mockUSDG', 'buyTicket', [BigInt(listing.tokenId)], listing.price, { writeAddress: address });
      
      await refetch();
      await refetchListings();
      
      queryClient.invalidateQueries({ queryKey: ['userTickets'] });
      queryClient.invalidateQueries({ queryKey: ['factory'] });
      
      await new Promise(resolve => setTimeout(resolve, 500));
      queryClient.refetchQueries({ queryKey: ['userTickets'] });
      
      toast.success('Ticket purchased successfully!');
      setBuyingListing(null);
    } catch (e) {
      console.error('[DEBUG handleBuyListing] Buy failed:', e);
    }
  };

  const handleCancel = async (tokenId) => {
    if (!walletClient || !ready) return;
    try {
      await execute(address, 'cancelListing', [BigInt(tokenId)]);
      await refetchListings();
      setSelectedListing(null);
      toast.success('Listing cancelled successfully!');
    } catch (e) {
      console.error('Cancel failed:', e);
    }
  };

  // Cart helpers
  const getTotalQty = () => Object.values(cart).reduce((sum, item) => sum + item.qty, 0);

  const canAddMore = () => getTotalQty() < CONTRACT_CONSTANTS.MAX_BATCH_MINT;

  const updateCartQty = (tierIndex, delta) => {
    setCart(prev => {
      const current = prev[tierIndex] || { qty: 0, recipients: [] };
      const newQty = Math.max(0, Math.min(CONTRACT_CONSTANTS.MAX_BATCH_MINT - (getTotalQty() - current.qty), current.qty + delta));
      if (newQty === 0) {
        // eslint-disable-next-line no-unused-vars
        const { [tierIndex]: _removed, ...rest } = prev;
        return rest;
      }
      const recipients = [...current.recipients];
      if (recipients.length < newQty) {
        if (walletAddress) {
          recipients.push(walletAddress);
        } else {
          recipients.push('');
        }
      } else if (recipients.length > newQty) {
        recipients.splice(newQty);
      }
      return { ...prev, [tierIndex]: { qty: newQty, recipients } };
    });
  };

  const updateCartRecipient = (tierIndex, recipientIndex, address) => {
    setCart(prev => {
      const current = prev[tierIndex];
      if (!current) return prev;
      const recipients = [...current.recipients];
      recipients[recipientIndex] = address;
      return { ...prev, [tierIndex]: { ...current, recipients } };
    });
  };

  const clearCart = () => setCart({});

  const handleBuyCart = async () => {
    if (!walletClient || !ready || minting) return;
    if (!isVerified) {
      setShowVerifyModal(true);
      return;
    }

    const cartEntries = Object.entries(cart);
    if (cartEntries.length === 0) return;

    for (const [, item] of cartEntries) {
      if (item.recipients.some(r => !r.trim())) {
        alert('Please fill in all recipient addresses');
        return;
      }
    }

    setMinting(true);
    try {
      let allRecipients = [];
      for (const [tierIndexStr, item] of cartEntries) {
        const tierIndex = parseInt(tierIndexStr);
        const tier = tiers[tierIndex];
        const validRecipients = item.recipients.filter(r => r.trim());
        
        if (validRecipients.length === 0) continue;

        allRecipients.push(...validRecipients);
        const totalPrice = tier.price * BigInt(validRecipients.length);
        await executeTwoStep('mockUSDG', 'mint', [BigInt(tierIndex), validRecipients], totalPrice, { writeAddress: address });
      }
      
      await refetch();
      await refetchListings();
      
      queryClient.invalidateQueries({ queryKey: ['userTickets'] });
      queryClient.invalidateQueries({ queryKey: ['factory'] });
      
      await new Promise(resolve => setTimeout(resolve, 500));
      queryClient.refetchQueries({ queryKey: ['userTickets'] });
      
      const uniqueRecipients = [...new Set(allRecipients)];
      if (uniqueRecipients.length > 1 || (uniqueRecipients.length === 1 && uniqueRecipients[0].toLowerCase() !== walletAddress?.toLowerCase())) {
        toast.info(`Tickets minted to: ${uniqueRecipients.map(r => shortAddress(r)).join(', ')}`);
      } else {
        toast.success('Tickets minted successfully!');
      }
      
      clearCart();
    } catch (e) {
      console.error('[DEBUG handleBuyCart] Mint failed:', e);
    } finally {
      setMinting(false);
    }
  };

  const groupedTiers = tiers.reduce((acc, tier, index) => {
    if (!acc[tier.category]) {
      acc[tier.category] = [];
    }
    acc[tier.category].push({ ...tier, index });
    return acc;
  }, {});

  const categories = Object.keys(groupedTiers);

  return (
    <div>
      <div className="mb-8">
        {/* Back Navigation */}
        <Link to="/explore" className="mb-4 inline-flex items-center gap-2 text-text-primary hover:text-primary/80">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="font-medium">Back to Explore</span>
        </Link>

        {/* Event Header - Side by Side: Image (1/3) + Details (2/3) */}
        <div className="grid gap-4 xs:gap-3 lg:gap-6 lg:grid-cols-3">
          {/* Event Image - 1/3 width, square */}
          <div className="lg:col-span-1">
            <div className="aspect-square w-full rounded-xl overflow-hidden bg-background relative">
              {imageUrl ? (
                <img
                  src={`https://gateway.pinata.cloud/ipfs/${imageUrl}`}
                  alt={eventName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-primary-soft flex items-center justify-center">
                  <svg className="w-20 h-20 xs:w-16 xs:h-16 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
              )}
              <Badge variant={isSaleOpen ? 'warning' : isEventRunning ? 'success' : 'danger'} className="absolute top-3 left-3 xs:top-2 xs:left-2 badge-brutal xs:px-2 xs:py-0.5 xs:text-[11px]">
                {isSaleOpen ? 'Sale Open' : isEventRunning ? 'Live Now' : 'Ended'}
              </Badge>
            </div>
          </div>

          {/* Event Details - 2/3 width */}
          <div className="lg:col-span-2 space-y-3 xs:space-y-2 pt-1 lg:pt-2 lg:pl-6">
            <h1 className="text-display-lg xs:text-display-md font-display font-bold text-text-primary">{eventName}</h1>
            {location && (
              <p className="text-text-secondary flex items-center gap-2 xs:gap-1.5">
<svg className="w-5 h-5 xs:w-4 xs:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {location}
              </p>
            )}
            {schedule.length > 0 && (
              <div className="flex items-start gap-2 xs:gap-1.5 text-text-secondary">
                <svg className="w-5 h-5 xs:w-4 xs:h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <div className="flex flex-col gap-1">
                  {schedule.map((s, idx) => (
                    <span key={idx} className="text-sm xs:text-xs">
                      {s.date} {s.startTime || '00:00'} - {s.endTime || '23:59'}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {description && (
              <p className="text-text-secondary xs:text-sm">{description}</p>
            )}
              <div className="text-right">
                <p className="text-caption xs:text-[11px] text-text-muted">Contract</p>
                <p className="font-mono text-sm xs:text-xs text-text-primary">{shortAddress(address)}</p>
              </div>
          </div>
        </div>
      </div>

      <Tabs
        tabs={[
          { 
            id: 'buy', 
            label: 'Buy Tickets', 
            disabled: !isSaleOpen,
            content: (
              <BuyTab
                tiers={tiers}
                groupedTiers={groupedTiers}
                categories={categories}
                cart={cart}
                updateCartQty={updateCartQty}
                updateCartRecipient={updateCartRecipient}
                handleBuyCart={handleBuyCart}
                canAddMore={canAddMore}
                getTotalQty={getTotalQty}
                isSaleOpen={isSaleOpen}
                isEventRunning={isEventRunning}
                isEnded={isEnded}
                isLoading={isLoading}
                times={times}
                demoNow={demoNow}
                formatTime={formatTime}
                formatUSDG={formatUSDG}
                minting={minting}
                walletAddress={walletAddress}
              />
            )
          },
          { 
            id: 'marketplace', 
            label: 'Marketplace',
            content: (
              <MarketplaceTab
                listings={listings || []}
                isEventRunning={isEventRunning}
                isEnded={isEnded}
                selectedListing={selectedListing}
                setSelectedListing={setSelectedListing}
                listingPrice={listingPrice}
                setListingPrice={setListingPrice}
                handleList={handleList}
                handleBuyListing={handleBuyListing}
                handleCancel={handleCancel}
                formatUSDG={formatUSDG}
                walletAddress={walletAddress}
              />
            )
          },
        ]}
        defaultTab={activeTab}
        onChange={(tab) => setSearchParams({ tab })}
      />

      <Modal
        isOpen={showVerifyModal}
        onClose={() => { setShowVerifyModal(false); setBuyingListing(null); }}
        title="Verification Required"
        size="sm"
      >
        <div className="space-y-4 text-center">
          <p className="text-text-secondary">
            You need to verify your identity before buying tickets.
          </p>
          <Button 
            onClick={async () => {
              try {
                await execute('mockHumanVerifier', 'verifyMe', []);
                await refetchVerification();
                setShowVerifyModal(false);
                if (buyingListing) {
                  await handleBuyListing(buyingListing);
                } else if (getTotalQty() > 0) {
                  await handleBuyCart();
                }
              } catch (e) {
                console.error('Verify failed:', e);
              }
            }}
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

function BuyTab({ 
  tiers, 
  groupedTiers, 
  categories, 
  cart,
  updateCartQty,
  updateCartRecipient,
  handleBuyCart,
  canAddMore,
  getTotalQty,
  isSaleOpen, 
  isEventRunning,
  isEnded,
  isLoading,
  times,
  demoNow,
  formatTime,
  formatUSDG,
  minting,
  walletAddress
}) {
  if (!isSaleOpen) {
    let message = 'Ticket sales are not currently open for this event.';
    let badgeVariant = 'warning';
    if (isEventRunning) {
      message = 'Event is currently running. Primary ticket sales have ended.';
      badgeVariant = 'success';
    } else if (isEnded) {
      message = 'Event has ended. Tickets are no longer available for purchase.';
      badgeVariant = 'danger';
    }
    return (
      <div className="card text-center py-12">
        <Badge variant={badgeVariant} className="mb-4">{isEventRunning ? 'Event Running' : isEnded ? 'Event Ended' : 'Sales Not Open'}</Badge>
        <p className="text-text-secondary mb-4">{message}</p>
        {times?.eventStartTime && (
          <p className="text-text-muted">
            Event started: {formatTime(times.eventStartTime)}
          </p>
        )}
      </div>
    );
  }

  if (isLoading || !tiers.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-heading-lg font-semibold text-text-primary">Available Tiers</h2>
        <span className="text-caption text-text-muted">
          Max {CONTRACT_CONSTANTS.MAX_BATCH_MINT} tickets per transaction • Cart: {getTotalQty()}/{CONTRACT_CONSTANTS.MAX_BATCH_MINT}
        </span>
      </div>

      {categories.map((category) => (
        <Card key={category} className="space-y-4">
          <h3 className="text-heading-md font-semibold text-text-primary">{category}</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-sm text-text-muted">
                  <th className="pb-2 px-3 font-medium">Phase</th>
                  <th className="pb-2 px-3 font-medium">Price</th>
                  <th className="pb-2 px-3 font-medium">Available</th>
                  <th className="pb-2 px-3 font-medium">Sale Window</th>
                  <th className="pb-2 px-3 font-medium">Qty</th>
                </tr>
              </thead>
              <tbody>
                {groupedTiers[category].map((tier) => {
                  const now = demoNow;
                  const inWindow = Number(tier.startTime) <= now && Number(tier.endTime) >= now;
                  const available = Number(tier.maxQuota) - Number(tier.minted);
                  const cartItem = cart[tier.index] || { qty: 0, recipients: [] };
                  const qty = cartItem.qty;
                  
                  const isUpcoming = Number(tier.startTime) > now;
                  const isActive = inWindow && available > 0;
                  const phaseBadge = isActive ? (
                    <Badge variant="success" className="ml-2">Now Open</Badge>
                  ) : isUpcoming ? (
                    <Badge variant="warning" className="ml-2">Upcoming</Badge>
                  ) : (
                    <Badge variant="default">Ended</Badge>
                  );
                  
                  return (
                    <tr key={tier.index} className={`border-b border-border/50 ${qty > 0 ? 'bg-primary-soft' : ''}`}>
                      <td className="py-3 px-3 flex items-center gap-2">
                        {tier.phase}
                        {phaseBadge}
                      </td>
                      <td className="py-3 px-3 font-mono">{formatUSDG(tier.price)} mUSDG</td>
                      <td className="py-3 px-3">
                        <span className={available === 0 ? 'text-danger' : 'text-text-primary'}>
                          {available} / {tier.maxQuota}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-sm text-text-muted">
                        {formatTime(tier.startTime)} - {formatTime(tier.endTime)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateCartQty(tier.index, -1)}
                            disabled={qty === 0 || !inWindow || available === 0}
                          >
                            -
                          </Button>
                          <span className="w-10 text-center font-mono">{qty}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateCartQty(tier.index, 1)}
                            disabled={qty >= available || !canAddMore() || !inWindow}
                          >
                            +
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ))}

      {getTotalQty() > 0 && (
        <Card className="border-primary bg-primary-soft">
          <h3 className="text-heading-md font-semibold text-text-primary mb-4">Cart Summary ({getTotalQty()}/{CONTRACT_CONSTANTS.MAX_BATCH_MINT})</h3>
          <div className="space-y-3">
            {Object.entries(cart).map(([tierIndexStr, item]) => {
              const tierIndex = parseInt(tierIndexStr);
              const tier = tiers[tierIndex];
              return (
                <div key={tierIndex} className="border-b border-border/50 pb-3 last:border-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{tier.category} - {tier.phase}</span>
                    <span className="font-mono">{formatUSDG(tier.price)} mUSDG × {item.qty}</span>
                  </div>
                  <div className="space-y-2 ml-4">
                    {item.recipients.map((recipient, idx) => (
                      <div key={idx} className="relative">
                        <Input
                          type="text"
                          placeholder="Recipient address (your wallet by default)"
                          value={recipient}
                          onChange={(e) => updateCartRecipient(tierIndex, idx, e.target.value)}
                          className="w-full max-w-xs pr-24"
                        />
                        {recipient && recipient.toLowerCase() === walletAddress?.toLowerCase() && (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-success font-medium">
                            ✓ Your wallet
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex justify-end">
            <Button 
              onClick={handleBuyCart}
              disabled={minting}
              size="lg"
              loading={minting}
            >
              {minting ? 'Minting...' : `Buy ${getTotalQty()} Ticket${getTotalQty() > 1 ? 's' : ''}`}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function MarketplaceTab({ 
  listings, 
  isEventRunning, 
  isEnded, 
  selectedListing, 
  setSelectedListing, 
  listingPrice, 
  setListingPrice, 
  handleList, 
  handleBuyListing, 
  handleCancel, 
  formatUSDG,
  walletAddress
}) {
  const marketplaceClosed = isEventRunning || isEnded;

  if (marketplaceClosed) {
    return (
      <div className="card text-center py-12">
        <Badge variant="danger" className="mb-4">Marketplace Closed</Badge>
        <p className="text-text-secondary">
          The marketplace is closed during the event. Listings cannot be created or purchased.
        </p>
      </div>
    );
  }

  // Kalkulasi untuk Preview Fee Marketplace (Edit Listing)
  const priceVal = parseFloat(listingPrice) || 0;
  const maxPriceVal = selectedListing?.tier?.maxResalePrice ? parseFloat(formatUSDG(selectedListing.tier.maxResalePrice)) : 0;
  const isOverPriced = maxPriceVal > 0 && priceVal > maxPriceVal;

  const eoFee = priceVal * 0.06;
  const platformFee = priceVal * 0.04;
  const netReceived = priceVal * 0.90;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-heading-lg font-semibold text-text-primary">Marketplace Listings</h2>
        </div>
        
        {!listings.length ? (
          <Card className="text-center py-12">
            <p className="text-text-secondary">No listings available</p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing) => {
              const isCurrentSeller = walletAddress && listing.seller.toLowerCase() === walletAddress.toLowerCase();
              return (
                <Card key={listing.tokenId.toString()} className="hover:shadow-[var(--shadow-modal)] transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <Badge variant="default">{listing.tier?.category}</Badge>
                    <Badge variant="default">{listing.tier?.phase}</Badge>
                  </div>
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Price</span>
                      <span className="font-mono text-text-primary font-semibold">{formatUSDG(listing.price)} mUSDG</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Max Resale</span>
                      <span className="font-mono text-text-muted">{listing.tier?.maxResalePrice ? formatUSDG(listing.tier.maxResalePrice) : 'N/A'} mUSDG</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Seller</span>
                      <span className="font-mono text-text-primary">{shortAddress(listing.seller)}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant={isCurrentSeller ? 'secondary' : 'primary'}
                      className="flex-1"
                      onClick={() => setSelectedListing(listing)}
                    >
                      {isCurrentSeller ? 'Manage' : 'Buy'}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Popup untuk Edit Listing / Buy Ticket */}
      {selectedListing && (
        <Modal
          isOpen={true}
          onClose={() => { setSelectedListing(null); setListingPrice(''); }}
          title={walletAddress && selectedListing.seller.toLowerCase() === walletAddress.toLowerCase() ? 'Edit Listing' : 'Buy Ticket'}
          size="sm"
        >
          {walletAddress && selectedListing.seller.toLowerCase() === walletAddress.toLowerCase() ? (
            <div className="space-y-4">
              <div>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  label="Price (mUSDG)"
                  placeholder="Enter price"
                  value={listingPrice}
                  onChange={(e) => setListingPrice(e.target.value)}
                  className={isOverPriced ? 'border-danger focus:ring-danger' : ''}
                />
                <div className="flex justify-between items-center mt-1.5">
                  <p className={`text-caption ${isOverPriced ? 'text-danger font-medium' : 'text-text-muted'}`}>
                    Max price: {maxPriceVal > 0 ? `${maxPriceVal} mUSDG` : 'N/A'}
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
                <Button variant="secondary" onClick={() => handleCancel(selectedListing.tokenId)}>
                  Cancel Listing
                </Button>
                <Button onClick={() => handleList(selectedListing.tokenId)} disabled={!listingPrice || isOverPriced || priceVal <= 0}>
                  Update Listing
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-center">
              <div>
                <p className="text-text-secondary">Price: <span className="font-mono text-text-primary">{formatUSDG(selectedListing.price)} mUSDG</span></p>
                <p className="text-caption text-text-muted mt-1">Category: {selectedListing.tier?.category} • Phase: {selectedListing.tier?.phase}</p>
              </div>
              <div className="flex justify-center gap-3 pt-2">
                <Button variant="secondary" onClick={() => setSelectedListing(null)}>Cancel</Button>
                <Button onClick={() => handleBuyListing(selectedListing)} size="lg">
                  Buy Ticket
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}