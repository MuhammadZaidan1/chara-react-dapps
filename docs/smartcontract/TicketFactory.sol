// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IHumanVerifier} from "./interfaces/IHumanVerifier.sol";
import {EventTicket} from "./EventTicket.sol";

contract TicketFactory {
    address public immutable platformTreasury;
    IERC20 public immutable usdg;
    IHumanVerifier public immutable humanVerifier;

    address[] public deployedEvents;

    error InvalidAddress();

    event EventCreated(address indexed eventContract, address indexed organizer);

    /// @notice Creates a factory configured with the shared MVP payment and verification contracts.
    /// @param platformTreasury_ Treasury receiving protocol fees.
    /// @param usdg_ Shared USDG ERC-20.
    /// @param humanVerifier_ Shared human-verification contract.
    constructor(address platformTreasury_, IERC20 usdg_, IHumanVerifier humanVerifier_) {
        if (
            platformTreasury_ == address(0) || address(usdg_) == address(0)
                || address(humanVerifier_) == address(0)
        ) revert InvalidAddress();

        platformTreasury = platformTreasury_;
        usdg = usdg_;
        humanVerifier = humanVerifier_;
    }

    /// @notice Deploys a new event contract and stores its address in the factory.
    /// @param eventMetadataURI Event metadata URI.
    /// @param eventStartTime Event start timestamp.
    /// @param eventEndTime Event end timestamp.
    /// @param tierInputs Tier inputs for the event.
    /// @return eventContract Newly deployed event contract.
    function createEvent(
        string calldata eventMetadataURI,
        uint256 eventStartTime,
        uint256 eventEndTime,
        EventTicket.TicketTierInput[] calldata tierInputs
    ) external returns (address eventContract) {
        EventTicket eventTicket = new EventTicket(
            eventMetadataURI,
            eventStartTime,
            eventEndTime,
            msg.sender,
            platformTreasury,
            usdg,
            humanVerifier,
            tierInputs
        );
        eventContract = address(eventTicket);
        deployedEvents.push(eventContract);
        emit EventCreated(eventContract, msg.sender);
    }

    /// @notice Returns the number of deployed events.
    /// @return count Event count.
    function deployedEventsLength() external view returns (uint256 count) {
        return deployedEvents.length;
    }

    /// @notice Returns the full deployed-events array.
    /// @return addresses Event contract addresses.
    function getDeployedEvents() external view returns (address[] memory addresses) {
        return deployedEvents;
    }
}