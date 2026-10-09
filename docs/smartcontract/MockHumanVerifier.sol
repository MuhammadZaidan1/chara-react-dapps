// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IHumanVerifier} from "./interfaces/IHumanVerifier.sol";

contract MockHumanVerifier is IHumanVerifier {
    mapping(address account => bool verified) public override isVerified;

    event Verified(address indexed account);

    /// @notice Marks the caller verified for every event using this verifier.
    function verifyMe() external override {
        if (isVerified[msg.sender]) return;

        isVerified[msg.sender] = true;
        emit Verified(msg.sender);
    }
}