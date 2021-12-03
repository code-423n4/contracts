// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "./TokenLock.sol";

/// @dev Same as TokenLock, but allows for the DAO to claim locked tokens.
contract RevokableTokenLock is TokenLock {
    address immutable revoker;

    constructor(
        ERC20 _token,
        uint256 _unlockBegin,
        uint256 _unlockCliff,
        uint256 _unlockEnd,
        address _revoker
    ) TokenLock(_token, _unlockBegin, _unlockCliff, _unlockEnd) {
        revoker = _revoker;
    }

    // TODO: consider if revoker can be changed
    // TODO: overwrite claimableBalance() function so that it returns zero if revoker has revoked
    // probably requires a new mapping (address => bool) isRevoked;
    // TODO: add function for revoker to revoke vesting tokens
}
