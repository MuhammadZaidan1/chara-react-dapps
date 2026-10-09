import { useQuery, useQueries } from '@tanstack/react-query';
import { readContract } from '../utils/viemHelpers.js';
import { CONTRACT_ADDRESSES, ABIS } from '../config/index.js';
import { fetchWithGatewayFallback } from '../utils/pinata.js';

export function useContractRead(contract, functionName, args = [], options = {}) {
  const queryKey = [contract, functionName, ...args];
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      const address = CONTRACT_ADDRESSES[contract];
      const abi = ABIS[contract];
      if (!address || !abi) {
        throw new Error(`Contract ${contract} not configured`);
      }
      return readContract({ address, abi, functionName, args });
    },
    ...options,
  });
}

export function useEventMetadata(eventAddress) {
  return useQuery({
    queryKey: ['event', eventAddress, 'metadataParsed'],
    queryFn: async () => {
      if (!eventAddress) return null;
      const uri = await readContract({
        address: eventAddress,
        abi: ABIS.eventTicket,
        functionName: 'eventMetadataURI',
      });
      return fetchWithGatewayFallback(uri);
    },
    enabled: !!eventAddress,
    staleTime: 60000,
  });
}

export function useFactoryEvents() {
  return useContractRead('factory', 'getDeployedEvents', [], {
    staleTime: 30000,
  });
}

export function useFactoryEventCount() {
  return useContractRead('factory', 'deployedEventsLength', [], {
    staleTime: 30000,
  });
}

export function useEventData(eventAddress) {
  const tiersQuery = useQuery({
    queryKey: ['event', eventAddress, 'tiers'],
    queryFn: async () => {
      if (!eventAddress) return [];
      return readContract({
        address: eventAddress,
        abi: ABIS.eventTicket,
        functionName: 'getTiers',
      });
    },
    enabled: !!eventAddress,
    staleTime: 10000,
  });

  const stateQuery = useQuery({
    queryKey: ['event', eventAddress, 'state'],
    queryFn: async () => {
      if (!eventAddress) return 0;
      return readContract({
        address: eventAddress,
        abi: ABIS.eventTicket,
        functionName: 'getState',
      });
    },
    enabled: !!eventAddress,
    staleTime: 5000,
  });

  const poolsQuery = useQuery({
    queryKey: ['event', eventAddress, 'pools'],
    queryFn: async () => {
      if (!eventAddress) return {};
      const [primaryPool, secondaryPool, primaryRevenue, secondaryRevenue] = await Promise.all([
        readContract({ address: eventAddress, abi: ABIS.eventTicket, functionName: 'primaryPool' }),
        readContract({ address: eventAddress, abi: ABIS.eventTicket, functionName: 'secondaryPool' }),
        readContract({ address: eventAddress, abi: ABIS.eventTicket, functionName: 'primaryRevenue' }),
        readContract({ address: eventAddress, abi: ABIS.eventTicket, functionName: 'secondaryRevenue' }),
      ]);
      return { primaryPool, secondaryPool, primaryRevenue, secondaryRevenue };
    },
    enabled: !!eventAddress,
    staleTime: 10000,
  });

  const organizerQuery = useQuery({
    queryKey: ['event', eventAddress, 'organizer'],
    queryFn: async () => {
      if (!eventAddress) return null;
      return readContract({
        address: eventAddress,
        abi: ABIS.eventTicket,
        functionName: 'organizer',
      });
    },
    enabled: !!eventAddress,
    staleTime: 60000,
  });

  const eventMetadataQuery = useQuery({
    queryKey: ['event', eventAddress, 'metadata'],
    queryFn: async () => {
      if (!eventAddress) return null;
      return readContract({
        address: eventAddress,
        abi: ABIS.eventTicket,
        functionName: 'eventMetadataURI',
      });
    },
    enabled: !!eventAddress,
    staleTime: 60000,
  });

  const eventTimesQuery = useQuery({
    queryKey: ['event', eventAddress, 'times'],
    queryFn: async () => {
      if (!eventAddress) return null;
      const [start, end] = await Promise.all([
        readContract({ address: eventAddress, abi: ABIS.eventTicket, functionName: 'eventStartTime' }),
        readContract({ address: eventAddress, abi: ABIS.eventTicket, functionName: 'eventEndTime' }),
      ]);
      return { eventStartTime: start, eventEndTime: end };
    },
    enabled: !!eventAddress,
    staleTime: 60000,
  });

  const demoTimeOffsetQuery = useQuery({
    queryKey: ['event', eventAddress, 'demoTimeOffset'],
    queryFn: async () => {
      if (!eventAddress) return 0n;
      return readContract({
        address: eventAddress,
        abi: ABIS.eventTicket,
        functionName: 'demoTimeOffset',
      });
    },
    enabled: !!eventAddress,
    staleTime: 5000,
  });

  return {
    tiers: tiersQuery,
    state: stateQuery,
    pools: poolsQuery,
    organizer: organizerQuery,
    metadata: eventMetadataQuery,
    times: eventTimesQuery,
    demoTimeOffset: demoTimeOffsetQuery,
    isLoading: tiersQuery.isLoading || stateQuery.isLoading || poolsQuery.isLoading,
    isError: tiersQuery.isError || stateQuery.isError || poolsQuery.isError,
    error: tiersQuery.error || stateQuery.error || poolsQuery.error,
    refetch: () => {
      tiersQuery.refetch();
      stateQuery.refetch();
      poolsQuery.refetch();
      demoTimeOffsetQuery.refetch();
    },
  };
}

export function useUserTickets(userAddress) {
  const factoryEvents = useFactoryEvents();
  
  return useQuery({
    queryKey: ['userTickets', userAddress],
    queryFn: async () => {
      console.log('[DEBUG useUserTickets] Query started. userAddress:', userAddress);
      if (!userAddress || !factoryEvents.data) {
        return [];
      }
      
      const events = factoryEvents.data;
      const tickets = [];
      
      // ABI Standar ERC721 untuk menambal fungsi balanceOf & ownerOf yang missing di config ABI utama
      const erc721PatchAbi = [
        {
          inputs: [{ name: 'owner', type: 'address', internalType: 'address' }],
          name: 'balanceOf',
          outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
          stateMutability: 'view',
          type: 'function',
        },
        {
          inputs: [{ name: 'tokenId', type: 'uint256', internalType: 'uint256' }],
          name: 'ownerOf',
          outputs: [{ name: '', type: 'address', internalType: 'address' }],
          stateMutability: 'view',
          type: 'function',
        }
      ];

      for (const eventAddress of events) {
        try {
          // Gabungkan ABI asli dengan patch ERC721 standar
          const combinedAbi = [...(ABIS.eventTicket || []), ...erc721PatchAbi];

          const balance = await readContract({
            address: eventAddress,
            abi: combinedAbi,
            functionName: 'balanceOf',
            args: [userAddress],
          });
          
          console.log('[DEBUG useUserTickets] Event:', eventAddress, 'Balance result:', balance.toString());
          
          if (balance > 0) {
            const eventMetadata = await readContract({
              address: eventAddress,
              abi: combinedAbi,
              functionName: 'eventMetadataURI',
            });
            
            const tiers = await readContract({
              address: eventAddress,
              abi: combinedAbi,
              functionName: 'getTiers',
            });
            
            let totalMinted = 0;
            for (const tier of tiers) {
              totalMinted += Number(tier.minted);
            }
            
            let foundCount = 0;
            for (let tokenId = 1; tokenId <= totalMinted; tokenId++) {
              if (foundCount >= Number(balance)) break;
              
              try {
                const owner = await readContract({
                  address: eventAddress,
                  abi: combinedAbi,
                  functionName: 'ownerOf',
                  args: [BigInt(tokenId)],
                });
                
                if (owner.toLowerCase() === userAddress.toLowerCase()) {
                  foundCount++;
                  const tierIndex = await readContract({
                    address: eventAddress,
                    abi: combinedAbi,
                    functionName: 'ticketToTier',
                    args: [BigInt(tokenId)],
                  });
                  
                  tickets.push({
                    eventAddress,
                    tokenId: BigInt(tokenId),
                    tierIndex: Number(tierIndex),
                    tier: tiers[Number(tierIndex)],
                    eventMetadata,
                  });
                }
              // eslint-disable-next-line no-unused-vars
              } catch (err) {
                // Ignore missing/burned token
              }
            }
          }
        } catch (e) {
          console.error(`[DEBUG useUserTickets] Error fetching tickets for event ${eventAddress}:`, e);
        }
      }
      
      console.log('[DEBUG useUserTickets] Final tickets found:', tickets.length, tickets);
      return tickets;
    },
    enabled: !!userAddress,
    staleTime: 10000,
    refetchOnWindowFocus: true,
  });
}

export function useUSDGBalance(userAddress) {
  return useContractRead('mockUSDG', 'balanceOf', [userAddress], {
    enabled: !!userAddress,
    staleTime: 10000,
  });
}

export function useVerificationStatus(userAddress) {
  return useContractRead('mockHumanVerifier', 'isVerified', [userAddress], {
    enabled: !!userAddress,
    staleTime: 10000,
  });
}

export function useListings(eventAddress) {
  return useQuery({
    queryKey: ['listings', eventAddress],
    queryFn: async () => {
      if (!eventAddress) return [];
      const tiers = await readContract({
        address: eventAddress,
        abi: ABIS.eventTicket,
        functionName: 'getTiers',
      });
      
      const listings = [];
      let totalMinted = 0;
      for (const tier of tiers) {
        totalMinted += Number(tier.minted);
      }
      
      for (let tokenId = 1; tokenId <= totalMinted; tokenId++) {
        try {
          const listing = await readContract({
            address: eventAddress,
            abi: ABIS.eventTicket,
            functionName: 'listings',
            args: [BigInt(tokenId)],
          });
          
          // Dukung format Object maupun Array/Tuple yang dikembalikan viem
          const seller = listing?.seller ?? listing?.[0];
          const price = listing?.price ?? listing?.[1];
          
          if (seller && seller !== '0x0000000000000000000000000000000000000000') {
            const tierIndex = await readContract({
              address: eventAddress,
              abi: ABIS.eventTicket,
              functionName: 'ticketToTier',
              args: [BigInt(tokenId)],
            });
            const tier = tiers[Number(tierIndex)];
            listings.push({
              tokenId,
              seller,
              price,
              tier,
            });
          }
        } catch (e) {
          console.error(`Error fetching listing for tokenId ${tokenId}:`, e);
        }
      }
      
      return listings;
    },
    enabled: !!eventAddress,
    staleTime: 10000,
  });
}

export function useTicketTier(eventAddress, tokenId) {
  return useQuery({
    queryKey: ['event', eventAddress, 'ticketTier', tokenId],
    queryFn: async () => {
      if (!eventAddress || !tokenId) return null;
      const tierIndex = await readContract({
        address: eventAddress,
        abi: ABIS.eventTicket,
        functionName: 'ticketToTier',
        args: [BigInt(tokenId)],
      });
      const tiers = await readContract({
        address: eventAddress,
        abi: ABIS.eventTicket,
        functionName: 'getTiers',
      });
      return tiers[Number(tierIndex)];
    },
    enabled: !!eventAddress && !!tokenId,
    staleTime: 10000,
  });
}

export function useCategoryMetadata(categoryMetadataURIs) {
  return useQueries({
    queries: categoryMetadataURIs?.map((uri) => ({
      queryKey: ['categoryMetadata', uri],
      queryFn: async () => {
        if (!uri) return null;
        return fetchWithGatewayFallback(uri);
      },
      enabled: !!uri,
      staleTime: 60000,
    })) || [],
  });
}