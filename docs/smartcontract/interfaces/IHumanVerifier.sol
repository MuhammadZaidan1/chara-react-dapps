// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IHumanVerifier {
    /// @notice Returns whether an account has completed mock human verification.
    function isVerified(address account) external view returns (bool);

    /// @notice Verifies the caller for all events using this verifier.
    function verifyMe() external;
}