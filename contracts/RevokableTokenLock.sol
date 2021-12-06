// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "@openzeppelin/contracts/access/Ownable.sol";

import "./TokenLock.sol";

/// @dev Same as TokenLock, but enables a revoker to end vesting prematurely and send locked tokens to governance.
contract RevokableTokenLock is TokenLock {
    address public governance;
    address public revoker;

    mapping(address => bool) public isRevoked;

    event Revoked(address indexed revokedOwner, uint256 amount);

    constructor(
        ERC20 _token,
        address _governance,
        address _revoker
    ) TokenLock(_token) {
        require(_revoker != address(0), "revoker address cannot be set to 0");
        require(_governance != address(0), "governance address cannot be set to 0");
        governance = _governance;
        revoker = _revoker;
    }

    /**
     * @dev set revoker address
     * @param _revoker The account to check the claimable balance of.
     */
    function setRevoker(address _revoker) external onlyOwner {
        require(_revoker != address(0), "address != 0x");
        revoker = _revoker;
    }

    /**
     * @dev override claimableBalance to return 0 if owner is revoked
     * @param owner The account to check the claimable balance of.
     * @return The number of tokens currently claimable.
     */
    function claimableBalance(address owner) public view override returns (uint256) {
        if (isRevoked[owner]) {
            return 0;
        }
        return super.claimableBalance(owner);
    }

    /**
     * @dev revoke access of a owner and transfer pending
     * @param recipient The account whose access will be revoked.
     */
    function revoke(address recipient) external {
        require(msg.sender == revoker || msg.sender == owner(), "onlyAuthorizedActors");
        require(!isRevoked[recipient], "Access already revoked for owner");
        isRevoked[recipient] = true;

        uint256 amount = vesting[recipient].lockedAmounts;
        if (amount > 0) {
            require(token.transfer(governance, amount), "TokenLock: Transfer failed");
            vesting[recipient].lockedAmounts = 0;
        }

        emit Revoked(recipient, amount);
    }
}
