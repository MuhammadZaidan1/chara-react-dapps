import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useWalletClient } from '../hooks/index.js';
import { useEventData, useContractWrite, useVerificationStatus, useEventMetadata, useCategoryMetadata } from '../hooks/index.js';
import { Button, Badge, Modal } from '../components/ui/index.js';
import { formatUSDG, formatTime, formatDuration } from '../utils/formatters.js';
import { useQueryClient } from '@tanstack/react-query';

export default function OrganizerEventDetail() {
  const { address } = useParams();
  
  const { walletClient } = useWalletClient();
  const { data: isVerified, refetch: refetchVerification } = useVerificationStatus(walletClient?.account?.address);
  const { execute } = useContractWrite();
  const { 
    tiers: tiersQuery, 
    state: stateQuery, 
    pools: poolsQuery,
    times: timesQuery,
    demoTimeOffset: demoTimeOffsetQuery,
  } = useEventData(address);
  
  const { data: eventMetadata } = useEventMetadata(address);
  
  const queryClient = useQueryClient();
  const [customDays, setCustomDays] = useState('');
  const [realNow, setRealNow] = useState(() => Date.now() / 1000);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showTimeControlModal, setShowTimeControlModal] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setRealNow(Date.now() / 1000), 1000);
    return () => clearInterval(interval);
  }, []);

  const state = stateQuery.data;
  const tiers = tiersQuery.data || [];
  const pools = poolsQuery.data;
  const times = timesQuery.data;
  const isSaleOpen = state === 0;
  const isEventRunning = state === 1;

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

  const handleWithdraw = async () => {
    if (!walletClient) return;
    try {
      await execute(address, 'withdrawFunds', []);
      alert('Funds withdrawn successfully!');
      queryClient.invalidateQueries({ queryKey: ['event', address] });
    } catch (e) {
      console.error('Withdraw failed:', e);
    }
  };

  const handleAdvanceTime = async (targetTime) => {
    if (!walletClient) return;
    const demoTimeOffsetValue = demoTimeOffsetQuery?.data || 0n;
    const demoNow = realNow + Number(demoTimeOffsetValue);
    const seconds = Math.max(0, Math.floor(targetTime - demoNow));
    try {
      await execute(address, 'advanceTime', [BigInt(seconds)]);
      queryClient.invalidateQueries({ queryKey: ['event', address] });
    } catch (e) {
      console.error('Advance time failed:', e);
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

  // Phase details
  const demoTimeOffsetValue = demoTimeOffsetQuery?.data || 0n;
  const demoNow = realNow + Number(demoTimeOffsetValue);

  const phaseMap = new Map();
  tiers.forEach(t => {
    if (!phaseMap.has(t.phase)) {
      phaseMap.set(t.phase, { startTime: Number(t.startTime), endTime: Number(t.endTime) });
    }
  });
  const phaseEntries = [...phaseMap.entries()];

  // Category details with max resale
  const categoryDetails = categories.map(cat => {
    const catTiers = groupedTiers[cat];
    let maxPrice = 0;
    catTiers.forEach(t => { if (Number(t.price) > maxPrice) maxPrice = Number(t.price); });
    return { name: cat, maxResalePrice: maxPrice * 2 };
  });

  // Build unique category metadata URIs for fetching category metadata (image, description)
  const categoryMetadataURIs = categories.map(cat => {
    const firstTier = groupedTiers[cat]?.[0];
    return firstTier?.metadataURI || '';
  }).filter(Boolean);

  // Fetch category metadata from IPFS
  const categoryMetadataQueries = useCategoryMetadata(categoryMetadataURIs);

  // Tier matrix data
  const matrixCategories = categories.map(cat => {
    const row = { category: cat };
    phaseEntries.forEach(([phaseName]) => {
      const tier = groupedTiers[cat].find(t => t.phase === phaseName);
      row[phaseName] = tier ? { price: tier.price, maxQuota: tier.maxQuota, minted: tier.minted } : null;
    });
    return row;
  });

  return (
    <div>
      <div className="mb-8">
        {/* Back Navigation */}
        <Link to="/dashboard" className="mb-4 inline-flex items-center gap-2 text-text-primary hover:text-primary/80">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="font-medium">Back to Dashboard</span>
        </Link>

        {/* Event Header - Side by Side: Image (1/3) + Details (2/3) */}
        <div className="grid gap-6 lg:grid-cols-3">
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
                  <svg className="w-16 h-16 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
              )}
              <Badge variant={isSaleOpen ? 'warning' : isEventRunning ? 'success' : 'danger'} className="absolute top-4 left-4 badge-brutal">
                {isSaleOpen ? 'Sale Open' : isEventRunning ? 'Live Now' : 'Ended'}
              </Badge>
              <Badge variant="default" className="absolute top-4 right-4 badge-brutal">
                Organizer View
              </Badge>
            </div>
          </div>

          {/* Event Details - 2/3 width */}
          <div className="lg:col-span-2 space-y-4 pt-2 lg:pl-6">
            <h1 className="text-display-lg font-display font-bold text-text-primary">{eventName}</h1>
            {location && (
              <p className="text-text-secondary flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {location}
              </p>
            )}
              {schedule.length > 0 && (
                <div className="flex items-start gap-2 text-text-secondary">
                  <svg className="w-5 h-5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <div className="flex flex-col gap-1">
                    {schedule.map((s, idx) => (
                      <span key={idx}>
                        {s.date} {s.startTime || '00:00'} - {s.endTime || '23:59'}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            {description && (
              <p className="text-text-secondary">{description}</p>
            )}
          </div>
        </div>

        {pools && (
          <div className="grid gap-4 sm:grid-cols-4 mb-6">
            <div className="bg-background rounded-lg p-4">
              <p className="text-caption text-text-muted">Primary Pool</p>
              <p className="font-mono text-text-primary">{formatUSDG(pools.primaryPool)} mUSDG</p>
            </div>
            <div className="bg-background rounded-lg p-4">
              <p className="text-caption text-text-muted">Secondary Pool</p>
              <p className="font-mono text-text-primary">{formatUSDG(pools.secondaryPool)} mUSDG</p>
            </div>
            <div className="bg-background rounded-lg p-4">
              <p className="text-caption text-text-muted">Primary Revenue</p>
              <p className="font-mono text-text-primary">{formatUSDG(pools.primaryRevenue)} mUSDG</p>
            </div>
            <div className="bg-background rounded-lg p-4">
              <p className="text-caption text-text-muted">Secondary Revenue</p>
              <p className="font-mono text-text-primary">{formatUSDG(pools.secondaryRevenue)} mUSDG</p>
            </div>
          </div>
        )}

        {/* Phase Details Table */}
        <div className="mb-6">
          <h3 className="text-heading-md font-semibold text-text-primary mb-3">Phase Details</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-sm text-text-muted">
                  <th className="pb-2 px-3 font-medium">Phase</th>
                  <th className="pb-2 px-3 font-medium">Start Date/Time</th>
                  <th className="pb-2 px-3 font-medium">End Date/Time</th>
                  <th className="pb-2 px-3 font-medium">Duration</th>
                  <th className="pb-2 px-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {phaseEntries.map(([phaseName, { startTime, endTime }]) => {
                  const now = demoNow;
                  const isUpcoming = now < startTime;
                  const isActive = now >= startTime && now <= endTime;
                  const durationSec = endTime - startTime;
                  const days = Math.floor(durationSec / 86400);
                  const hours = Math.floor((durationSec % 86400) / 3600);
                  return (
                    <tr key={phaseName} className="border-b border-border/50">
                      <td className="py-2 px-3 font-medium">{phaseName}</td>
                      <td className="py-2 px-3">{formatTime(startTime)}</td>
                      <td className="py-2 px-3">{formatTime(endTime)}</td>
                      <td className="py-2 px-3">{days > 0 ? `${days}d ${hours}h` : `${hours}h`}</td>
                      <td className="py-2 px-3">
                        <Badge variant={isActive ? 'success' : isUpcoming ? 'warning' : 'default'}>
                          {isActive ? 'Active' : isUpcoming ? 'Upcoming' : 'Ended'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Category Details Table - with fetched metadata (image, description) */}
        <div className="mb-6">
          <h3 className="text-heading-md font-semibold text-text-primary mb-3">Category Details</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-sm text-text-muted">
                  <th className="pb-2 px-3 font-medium">Category</th>
                  <th className="pb-2 px-3 font-medium">Description</th>
                  <th className="pb-2 px-3 font-medium">Image</th>
                  <th className="pb-2 px-3 font-medium">Max Resale Price</th>
                </tr>
              </thead>
              <tbody>
                {categoryDetails.map((cat, idx) => {
                  const metaQuery = categoryMetadataQueries[idx];
                  const metaData = metaQuery?.data;
                  const isLoadingMeta = metaQuery?.isLoading;
                  const metaError = metaQuery?.isError;
                  
                  return (
                    <tr key={cat.name} className="border-b border-border/50">
                      <td className="py-2 px-3 font-medium">{cat.name}</td>
                      <td className="py-2 px-3 text-text-secondary">
                        {isLoadingMeta ? 'Loading...' : metaError ? 'Error loading' : (metaData?.description || '-')}
                      </td>
                      <td className="py-2 px-3">
                        {isLoadingMeta ? (
                          <div className="w-12 h-12 bg-background animate-pulse rounded" />
                        ) : metaData?.image ? (
                          <img 
                            src={`https://gateway.pinata.cloud/ipfs/${metaData.image.replace('ipfs://', '')}`} 
                            alt={cat.name} 
                            className="w-12 h-12 object-cover rounded" 
                          />
                        ) : (
                          <span className="text-text-muted">-</span>
                        )}
                      </td>
                      <td className="py-2 px-3 font-mono text-text-primary">{formatUSDG(BigInt(cat.maxResalePrice))} mUSDG</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tier Matrix Table */}
        <div className="mb-6">
          <h3 className="text-heading-md font-semibold text-text-primary mb-3">Tier Matrix (Read-Only)</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-sm text-text-muted">
                  <th className="pb-2 px-3 font-medium">Category</th>
                  {phaseEntries.map(([phaseName, { startTime, endTime }]) => (
                    <th key={phaseName} className="pb-2 px-3 font-medium text-center whitespace-nowrap">
                      {phaseName}<br/>
                      <span className="text-xs text-text-muted">{formatTime(startTime)} - {formatTime(endTime)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrixCategories.map((row) => (
                  <tr key={row.category} className="border-b border-border/50">
                    <td className="py-2 px-3 font-medium text-text-primary">{row.category}</td>
                    {phaseEntries.map(([phaseName]) => {
                      const cell = row[phaseName];
                      return (
                        <td key={phaseName} className="py-2 px-3 text-center text-sm">
                          {cell ? (
                            <div className="space-y-1">
                              <div className="font-mono text-text-primary">{formatUSDG(cell.price)} mUSDG</div>
                              <div className="text-text-secondary">Quota: {cell.maxQuota}</div>
                              <div className="text-text-muted">Minted: {cell.minted}</div>
                            </div>
                          ) : (
                            <span className="text-text-muted">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Management Actions */}
      <div className="mt-4 border-t border-border pt-4 flex flex-wrap gap-3">
        <Button variant="secondary" onClick={handleWithdraw}>
          Withdraw Funds
        </Button>
        <Button variant="ghost" onClick={() => window.open(`https://explorer.testnet.chain.robinhood.com/address/${address}`, '_blank')}>
          View on Explorer
        </Button>
        <Link to={`/event/${address}#marketplace`}>
          <Button variant="primary">
            View Marketplace
          </Button>
        </Link>
        <Link to={`/scanner/${address}`}>
          <Button variant="secondary">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Gate Scanner
          </Button>
        </Link>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['event'] });
            queryClient.invalidateQueries({ queryKey: ['factory'] });
          }}
          title="Refresh all event data from blockchain"
        >
          Refresh Data
        </Button>
      </div>

      {/* Time Controls (Demo Only) */}
      <div className="mt-4 border-t border-border pt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-caption text-text-muted">Demo Time: {formatTime(demoNow)}</span>
          {demoTimeOffsetValue > 0n && <span className="text-warning text-caption">(+{formatDuration(Number(demoTimeOffsetValue))} offset)</span>}
        </div>
        <Button variant="secondary" size="sm" onClick={() => setShowTimeControlModal(true)}>
          Time Controls
        </Button>
      </div>

      {/* Time Control Modal */}
      <Modal
        isOpen={showTimeControlModal}
        onClose={() => setShowTimeControlModal(false)}
        title="Time Controls (Demo Only)"
        size="md"
      >
        <div className="space-y-6">
          <div className="bg-warning-soft border border-warning rounded-lg p-4">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <span className="font-medium text-warning">⏱ Demo Time Control</span>
            </div>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-mono text-text-primary">
                Current: {formatTime(demoNow)} (Real: {formatTime(realNow)})
                {demoTimeOffsetValue > 0n && <span className="ml-2 text-warning">+{formatDuration(Number(demoTimeOffsetValue))} offset</span>}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-heading-md font-semibold text-text-primary">Quick Jumps</h4>
            <div className="flex flex-wrap gap-3">
              <Button 
                variant="secondary" 
                size="sm"
                onClick={() => { handleAdvanceTime(Number(times?.eventStartTime || 0)); setShowTimeControlModal(false); }}
                disabled={!times?.eventStartTime || Number(times.eventStartTime) <= demoNow}
              >
                Jump to Running (Event Start)
              </Button>
              <Button 
                variant="secondary" 
                size="sm"
                onClick={() => { handleAdvanceTime(Number(times?.eventEndTime || 0)); setShowTimeControlModal(false); }}
                disabled={!times?.eventEndTime || Number(times.eventEndTime) <= demoNow}
              >
                Jump to End (Event End)
              </Button>
            </div>

            <h4 className="text-heading-md font-semibold text-text-primary mt-4">Jump to Phase Start</h4>
            <div className="flex flex-wrap gap-3">
              {phaseEntries.map(([phaseName, { startTime }]) => (
                <Button 
                  key={phaseName}
                  variant="secondary" 
                  size="sm"
                  onClick={() => { handleAdvanceTime(startTime); setShowTimeControlModal(false); }}
                  disabled={startTime <= demoNow}
                  title={`Jump to ${phaseName} sale start at ${formatTime(startTime)}`}
                >
                  Jump to {phaseName}
                </Button>
              ))}
            </div>

            <h4 className="text-heading-md font-semibold text-text-primary mt-4">Custom Jump</h4>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={365}
                  placeholder="Days"
                  className="input w-24"
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value)}
                />
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={() => {
                    const d = parseInt(customDays);
                    if (d >= 1 && d <= 365) { handleAdvanceTime(demoNow + d * 86400); setShowTimeControlModal(false); }
                  }}
                  disabled={!customDays || parseInt(customDays) < 1 || parseInt(customDays) > 365}
                >
                  Add +{customDays || 'N'}d
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Verification Modal */}
      <Modal
        isOpen={showVerifyModal}
        onClose={() => setShowVerifyModal(false)}
        title="Verification Required"
        size="sm"
      >
        <div className="space-y-4 text-center">
          <p className="text-text-secondary">
            You need to verify your identity before performing actions.
          </p>
          <Button 
            onClick={async () => {
              try {
                await execute('mockHumanVerifier', 'verifyMe', []);
                await refetchVerification();
                setShowVerifyModal(false);
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