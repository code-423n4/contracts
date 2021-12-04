// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "./TokenLock.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Contract is assumed to have received C4 tokens for the sale
contract C4TokenSale {
    ERC20 public immutable usdc;
    ERC20 public immutable c4;
    uint256 public immutable usdcToc4Rate;
    mapping(address => bool) isWhitelisted;

    constructor(
        ERC20 _usdc,
        ERC20 _c4,
        uint256 _usdcToc4Rate,
        address[] _whitelistAddresses
    ) {
        usdc = _usdc;
        c4 = _c4;
        usdcToc4Rate = _usdcToc4Rate;
        // expected to be small enough to not run out of gas
        // TODO: likely will change to hardcoded addresses
        for (uint256 i = 0; i < _whitelistAddresses.length; i++) {
            isWhitelisted[_whitelistAddresses[i]] = true;
        }
    }

    // TODO: burn all unsold tokens or transfer to goverance
    // TODO: function for sale to happen
    // TODO: use same C4TokenLock
}
