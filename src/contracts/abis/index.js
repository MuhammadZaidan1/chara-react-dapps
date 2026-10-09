import factoryAbi from './TicketFactory.json';
import eventTicketAbi from './EventTicket.json';
import mockUSDGAbi from './MockUSDG.json';
import mockHumanVerifierAbi from './MockHumanVerifier.json';

export const ABIS = {
  factory: factoryAbi.abi,
  eventTicket: eventTicketAbi.abi,
  mockUSDG: mockUSDGAbi.abi,
  mockHumanVerifier: mockHumanVerifierAbi.abi,
};