// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IHumanVerifier} from "./interfaces/IHumanVerifier.sol";

contract EventTicket is ERC721, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant PRIMARY_FEE_BPS = 200;
    uint256 public constant SECONDARY_PLATFORM_BPS = 400;
    uint256 public constant SECONDARY_EO_ROYALTY_BPS = 600;
    uint256 public constant HOLDBACK_BPS = 2_000;
    uint256 public constant MAX_BATCH_MINT = 5;
    uint256 public constant MAX_TIERS = 20;
    uint256 public constant RESALE_CAP_MULTIPLIER = 2;

    struct TicketTier {
        string category;
        string phase;
        uint256 price;
        uint256 maxResalePrice;
        uint256 maxQuota;
        uint256 minted;
        uint256 startTime;
        uint256 endTime;
        string metadataURI;
    }

    struct TicketTierInput {
        string category;
        string phase;
        uint256 price;
        uint256 maxQuota;
        uint256 startTime;
        uint256 endTime;
        string metadataURI;
    }

    struct Listing {
        address seller;
        uint256 price;
    }

    enum State {
        SaleOpen,
        EventRunning,
        Ended
    }

    TicketTier[] public tiers;
    mapping(uint256 tokenId => uint256 tierIndex) public ticketToTier;
    mapping(uint256 tokenId => Listing listing) public listings;

    address public immutable organizer;
    uint256 public immutable eventStartTime;
    uint256 public immutable eventEndTime;
    string public eventMetadataURI;
    address public immutable platformTreasury;
    IERC20 public immutable usdg;
    IHumanVerifier public immutable humanVerifier;

    uint256 public primaryPool;
    uint256 public secondaryPool;
    uint256 public primaryRevenue;
    uint256 public secondaryRevenue;

    // [DEMO ONLY]
    uint256 public demoTimeOffset;

    uint256 private _nextTokenId = 1;

    error InvalidTierCount();
    error InvalidEventTime();
    error InvalidTier(uint256 tierIndex);
    error PastTimestamp(uint256 timestamp);
    error InvalidAddress();
    error InvalidTierIndex(uint256 tierIndex);
    error InvalidRecipient(address recipient);
    error UnverifiedAccount(address account);
    error InvalidBatchLength();
    error TierQuotaExceeded();
    error SaleWindowClosed();
    error TicketAlreadyOwned(address account);
    error NotTicketOwner();
    error InvalidListingPrice();
    error ListingNotFound();
    error NotListingSeller();
    error MarketplaceClosed();
    error NoWithdrawableFunds();
    error OnlyOrganizer();

    event TicketMinted(
        uint256 indexed tokenId,
        uint256 indexed tierIndex,
        address indexed recipient,
        address buyer
    );
    event Listed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event ListingCancelled(uint256 indexed tokenId, address indexed seller);
    event Sold(
        uint256 indexed tokenId,
        address indexed seller,
        address indexed buyer,
        uint256 price
    );
    event Withdrawn(uint256 primaryAmount, uint256 secondaryAmount);
    event TimeAdvanced(uint256 secondsAdded, uint256 newOffset, uint256 newTime);

    modifier onlyOrganizer() {
        if (msg.sender != organizer) revert OnlyOrganizer();
        _;
    }

    /// @notice Deploys an event ticket contract and validates the configured tiers.
    /// @param eventMetadataURI_ Event metadata URI stored on-chain.
    /// @param eventStartTime_ Event start timestamp.
    /// @param eventEndTime_ Event end timestamp.
    /// @param organizer_ Organizer wallet address.
    /// @param platformTreasury_ Treasury receiving protocol fees.
    /// @param usdg_ Shared USDG ERC-20 contract.
    /// @param humanVerifier_ Shared verification contract.
    /// @param tierInputs Tier inputs without computed fields.
    constructor(
        string memory eventMetadataURI_,
        uint256 eventStartTime_,
        uint256 eventEndTime_,
        address organizer_,
        address platformTreasury_,
        IERC20 usdg_,
        IHumanVerifier humanVerifier_,
        TicketTierInput[] memory tierInputs
    ) ERC721("Event Ticket", "TICKET") {
        if (
            organizer_ == address(0) || platformTreasury_ == address(0) || address(usdg_) == address(0)
                || address(humanVerifier_) == address(0)
        ) revert InvalidAddress();
        if (eventStartTime_ >= eventEndTime_) revert InvalidEventTime();
        if (eventStartTime_ <= block.timestamp) revert PastTimestamp(eventStartTime_);
        if (tierInputs.length == 0 || tierInputs.length > MAX_TIERS) revert InvalidTierCount();

        organizer = organizer_;
        eventStartTime = eventStartTime_;
        eventEndTime = eventEndTime_;
        eventMetadataURI = eventMetadataURI_;
        platformTreasury = platformTreasury_;
        usdg = usdg_;
        humanVerifier = humanVerifier_;

        for (uint256 i; i < tierInputs.length; ++i) {
            TicketTierInput memory input = tierInputs[i];
            if (
                bytes(input.category).length == 0 || bytes(input.phase).length == 0
                    || bytes(input.metadataURI).length == 0 || input.price == 0
                    || input.maxQuota == 0 || input.startTime >= input.endTime
                    || input.endTime > eventStartTime_
                    || input.startTime <= block.timestamp
            ) revert InvalidTier(i);

            tiers.push(
                TicketTier({
                    category: input.category,
                    phase: input.phase,
                    price: input.price,
                    maxResalePrice: 0,
                    maxQuota: input.maxQuota,
                    minted: 0,
                    startTime: input.startTime,
                    endTime: input.endTime,
                    metadataURI: input.metadataURI
                })
            );
        }

        for (uint256 i; i < tiers.length; ++i) {
            uint256 highestPrice = tiers[i].price;
            for (uint256 j; j < tiers.length; ++j) {
                if (keccak256(bytes(tiers[j].category)) == keccak256(bytes(tiers[i].category))
                    && tiers[j].price > highestPrice) {
                    highestPrice = tiers[j].price;
                }
            }
            tiers[i].maxResalePrice = highestPrice * RESALE_CAP_MULTIPLIER;
        }
    }

    /// @notice Returns every configured tier for the event.
    /// @return list The full tier array.
    function getTiers() external view returns (TicketTier[] memory list) {
        return tiers;
    }

    /// @notice Returns the number of configured tiers for the event.
    /// @return count Number of tiers.
    function tierCount() external view returns (uint256 count) {
        return tiers.length;
    }

    /// @notice Returns the lifecycle state based on the demo-adjusted timestamp.
    /// @return state The current state.
    function getState() external view returns (State state) {
        uint256 currentTime = _now();
        if (currentTime < eventStartTime) return State.SaleOpen;
        if (currentTime <= eventEndTime) return State.EventRunning;
        return State.Ended;
    }

    /// @notice Mints a batch of verified tickets to verified recipients.
    /// @param tierIndex Tier to mint from.
    /// @param recipients Recipients in order.
    function mint(uint256 tierIndex, address[] calldata recipients) external nonReentrant {
        if (tierIndex >= tiers.length) revert InvalidTierIndex(tierIndex);
        if (recipients.length == 0 || recipients.length > MAX_BATCH_MINT) revert InvalidBatchLength();
        if (!humanVerifier.isVerified(msg.sender)) revert UnverifiedAccount(msg.sender);

        TicketTier storage tier = tiers[tierIndex];
        uint256 currentTime = _now();
        if (currentTime < tier.startTime || currentTime > tier.endTime) revert SaleWindowClosed();
        if (tier.minted + recipients.length > tier.maxQuota) revert TierQuotaExceeded();

        uint256 grossAmount = tier.price * recipients.length;
        uint256 platformFee = (grossAmount * PRIMARY_FEE_BPS) / 10_000;
        uint256 netAmount = grossAmount - platformFee;

        for (uint256 i; i < recipients.length; ++i) {
            address recipient = recipients[i];
            if (recipient == address(0)) revert InvalidRecipient(recipient);
            if (balanceOf(recipient) != 0) revert TicketAlreadyOwned(recipient);
            if (!humanVerifier.isVerified(recipient)) revert UnverifiedAccount(recipient);

            uint256 tokenId = _nextTokenId;
            _nextTokenId += 1;
            tier.minted += 1;
            ticketToTier[tokenId] = tierIndex;
            _mint(recipient, tokenId);
            emit TicketMinted(tokenId, tierIndex, recipient, msg.sender);
        }

        primaryPool += netAmount;
        primaryRevenue += netAmount;
        usdg.safeTransferFrom(msg.sender, address(this), grossAmount);
        if (platformFee != 0) usdg.safeTransfer(platformTreasury, platformFee);
    }

    /// @notice Lists a caller-owned ticket for resale before the event starts.
    /// @param tokenId The ticket to list.
    /// @param price Asking price in USDG base units.
    function listTicket(uint256 tokenId, uint256 price) external {
        if (_now() >= eventStartTime) revert MarketplaceClosed();
        if (ownerOf(tokenId) != msg.sender) revert NotTicketOwner();
        if (price == 0 || price > tiers[ticketToTier[tokenId]].maxResalePrice) revert InvalidListingPrice();

        listings[tokenId] = Listing({seller: msg.sender, price: price});
        emit Listed(tokenId, msg.sender, price);
    }

    /// @notice Cancels an active listing owned by the caller.
    /// @param tokenId Ticket to unlist.
    function cancelListing(uint256 tokenId) external {
        Listing memory existing = listings[tokenId];
        if (existing.seller == address(0)) revert ListingNotFound();
        if (existing.seller != msg.sender) revert NotListingSeller();

        delete listings[tokenId];
        emit ListingCancelled(tokenId, msg.sender);
    }

    /// @notice Buys a listed ticket from the current owner.
    /// @param tokenId The ticket to purchase.
    function buyTicket(uint256 tokenId) external nonReentrant {
        if (_now() >= eventStartTime) revert MarketplaceClosed();

        Listing memory listing = listings[tokenId];
        if (listing.seller == address(0) || ownerOf(tokenId) != listing.seller) revert ListingNotFound();
        if (balanceOf(msg.sender) != 0) revert TicketAlreadyOwned(msg.sender);
        if (!humanVerifier.isVerified(msg.sender)) revert UnverifiedAccount(msg.sender);

        delete listings[tokenId];

        uint256 platformFee = (listing.price * SECONDARY_PLATFORM_BPS) / 10_000;
        uint256 organizerRoyalty = (listing.price * SECONDARY_EO_ROYALTY_BPS) / 10_000;
        uint256 sellerAmount = listing.price - platformFee - organizerRoyalty;

        secondaryPool += organizerRoyalty;
        secondaryRevenue += organizerRoyalty;

        usdg.safeTransferFrom(msg.sender, platformTreasury, platformFee);
        usdg.safeTransferFrom(msg.sender, address(this), organizerRoyalty);
        usdg.safeTransferFrom(msg.sender, listing.seller, sellerAmount);
        _transfer(listing.seller, msg.sender, tokenId);

        emit Sold(tokenId, listing.seller, msg.sender, listing.price);
    }

    /// @notice Withdraws the currently available funds from the primary and secondary pools.
    function withdrawFunds() external onlyOrganizer nonReentrant {
        uint256 primaryAmount = _allowable(primaryPool, primaryRevenue);
        uint256 secondaryAmount = _allowable(secondaryPool, secondaryRevenue);
        if (primaryAmount == 0 && secondaryAmount == 0) revert NoWithdrawableFunds();

        primaryPool -= primaryAmount;
        secondaryPool -= secondaryAmount;
        if (primaryAmount != 0) usdg.safeTransfer(msg.sender, primaryAmount);
        if (secondaryAmount != 0) usdg.safeTransfer(msg.sender, secondaryAmount);

        emit Withdrawn(primaryAmount, secondaryAmount);
    }

    /// @notice Advances the demo clock for this event only.
    /// @param secondsToAdd Number of seconds to add to the offset.
    function advanceTime(uint256 secondsToAdd) external onlyOrganizer {
        demoTimeOffset += secondsToAdd;
        emit TimeAdvanced(secondsToAdd, demoTimeOffset, _now());
    }

    /// @notice Returns the metadata URI associated with a token.
    /// @param tokenId Ticket whose metadata is requested.
    /// @return uri The tier metadata URI.
    function tokenURI(uint256 tokenId) public view override returns (string memory uri) {
        ownerOf(tokenId);
        return tiers[ticketToTier[tokenId]].metadataURI;
    }

    /// @notice Reverts all transfer attempts because the ticket is soulbound until the event closes.
    /// @param from Source owner.
    /// @param to Destination.
    /// @param tokenId Token being moved.
    function transferFrom(address from, address to, uint256 tokenId) public pure override {
        from;
        to;
        tokenId;
        revert("Transfers disabled: use marketplace");
    }

    /// @notice Reverts all approval attempts.
    /// @param to Approved spender.
    /// @param tokenId Token id.
    function approve(address to, uint256 tokenId) public pure override {
        to;
        tokenId;
        revert("Approvals disabled");
    }

    /// @notice Reverts all operator approval attempts.
    /// @param operator Approved operator.
    /// @param approved Approval flag.
    function setApprovalForAll(address operator, bool approved) public pure override {
        operator;
        approved;
        revert("Approvals disabled");
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && _now() >= eventStartTime) revert MarketplaceClosed();
        return super._update(to, tokenId, auth);
    }

    function _now() internal view returns (uint256) {
        return block.timestamp + demoTimeOffset;
    }

    function _allowable(uint256 pool, uint256 revenue) private view returns (uint256) {
        if (_now() > eventEndTime) return pool;

        uint256 locked = (revenue * HOLDBACK_BPS) / 10_000;
        if (pool <= locked) return 0;
        return pool - locked;
    }
}