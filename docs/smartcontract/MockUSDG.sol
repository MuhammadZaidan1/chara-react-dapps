// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDG is ERC20 {
    uint256 public constant FAUCET_AMOUNT = 1_000 * 1e6;

    constructor() ERC20("Mock USDG", "mUSDG") {}

    /// @notice Returns the token's six-decimal precision.
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Mints the fixed demo allocation to the caller with no cooldown.
    function faucet() external {
        _mint(msg.sender, FAUCET_AMOUNT);
    }
}
