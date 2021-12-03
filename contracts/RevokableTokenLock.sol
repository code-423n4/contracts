// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "./TokenLock.sol";

/// @dev Same as TokenLock, but allows for the DAO to claim locked tokens.
contract RevokableTokenLock is TokenLock {
    address public revoker;
    mapping(address => bool) public isRevoked;

    event Revoked(address indexed revokedOwner);

    constructor(
        ERC20 _token,
        uint256 _unlockBegin,
        uint256 _unlockCliff,
        uint256 _unlockEnd,
        address _revoker
    ) TokenLock(_token, _unlockBegin, _unlockCliff, _unlockEnd) {
        require(_revoker != address(0), "revoker address cannot be set to 0");
        revoker = _revoker;
    }

    // TODO: should be changed to governance only access
    function setRevoker(address _revoker) external {
        require(_revoker != address(0), "revoker address cannot be set to 0");
        revoker = _revoker;
    }

    /**
     * @dev override claimableBalance to return 0 if owner is revoked
     * @param owner The account to check the claimable balance of.
     * @return The number of tokens currently claimable.
     */
    function claimableBalance(address owner)
        public
        view
        override
        returns (uint256)
    {
        if (isRevoked[owner]) {
            return 0;
        }
        return super.claimableBalance(owner);
    }

    /**
     * @dev revoke access of a owner
     * @param owner The account whose access will be revoked.
     */
    function revoke(address owner) external {
        require(msg.sender == revoker, "onlyRevoker");
        isRevoked[owner] = true;

        // TODO: if lockedAmounts[owner] > 0 make it 0 and transfer tokens to DAO

        emit Revoked(owner);
    }
}
