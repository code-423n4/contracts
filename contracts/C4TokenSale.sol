// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @dev Sells a token at a predetermined price to whitelisted buyers. The number of tokens each address can buy can be regulated.
 */
contract TokenSale is Ownable {
    /// token to take in (USDC)
    ERC20 public immutable tokenIn;
    /// token to give out (C4)
    ERC20 public immutable tokenOut;
    /// time when tokens can be first purchased
    uint64 public immutable saleStart;
    /// duration of the token sale, cannot purchase afterwards
    uint64 public immutable saleDuration;
    /// address receiving the proceeds of the sale
    address saleRecipient;

    /// how many `tokenOut`s each address may buy
    mapping(address => uint256) public whitelistedBuyersAmount;
    /// tokenIn per tokenOut price. precision is in tokenInDecimals - tokenOutDecimals + 18
    /// i.e., it should be provided as tokenInAmount * 1e18 / tokenOutAmount
    uint256 public immutable tokenOutPrice;

    event Sale(address indexed buyer, uint256 amountIn, uint256 amountOut);

    /**
     * @dev Constructor.
     * @param _tokenIn The token this contract will receive in a trade
     * @param _tokenOut The token this contract will return in a trade
     * @param _saleStart The time when tokens can be first purchased
     * @param _saleDuration The duration of the token sale
     * @param _tokenOutPrice The tokenIn per tokenOut price. precision should be in tokenInDecimals - tokenOutDecimals + 18
     * @param _tokenOutPrice The address receiving the proceeds of the sale
     */
    constructor(
        ERC20 _tokenIn,
        ERC20 _tokenOut,
        uint64 _saleStart,
        uint64 _saleDuration,
        uint256 _tokenOutPrice,
        address _saleRecipient
    ) Ownable() {
        require(block.timestamp <= _saleStart, "TokenSale: start date may not be in the past");
        require(_saleDuration > 0, "TokenSale: the duration must not be zero");
        require(_tokenOutPrice > 0, "TokenSale: the price must not be zero");
        require(_saleRecipient != address(0), "TokenSale: sale recipient should not be zero");

        tokenIn = _tokenIn;
        tokenOut = _tokenOut;
        saleStart = _saleStart;
        saleDuration = _saleDuration;
        tokenOutPrice = _tokenOutPrice;
        saleRecipient = _saleRecipient;
    }

    /**
     * @dev Whitelisted buyers can buy `tokenOutAmount` tokens at the `tokenOutPrice`.
     * @param _tokenOutAmount The amount of `tokenOut` to buy
     * @return tokenInAmount_ The amount of `tokenIn`s  bought.
     */
    function buy(uint256 _tokenOutAmount) external returns (uint256 tokenInAmount_) {
        require(saleStart <= block.timestamp, "TokenSale: not started");
        require(block.timestamp <= saleStart + saleDuration, "TokenSale: already ended");
        require(
            _tokenOutAmount <= whitelistedBuyersAmount[msg.sender],
            "TokenSale: cannot buy more than allowed"
        );

        unchecked {
            // this subtraction does not underflow due to the check above
            whitelistedBuyersAmount[msg.sender] -= _tokenOutAmount;
        }

        tokenInAmount_ = (_tokenOutAmount * tokenOutPrice) / 1e18;
        require(
            tokenIn.transferFrom(msg.sender, saleRecipient, tokenInAmount_),
            "TokenSale: tokenIn transfer failed"
        );
        // TODO: deploy vesting contract for msg.sender and send funds there instead
        require(
            tokenOut.transfer(msg.sender, _tokenOutAmount),
            "TokenSale: tokenOut transfer failed"
        );

        emit Sale(msg.sender, tokenInAmount_, _tokenOutAmount);
    }

    /**
     * @dev Changes the allowed token allocation for a list of buyers
     * @param _buyers The buyers to change the allocation for
     * @param _newTokenOutAmounts The new token amounts
     */
    function changeWhiteList(address[] memory _buyers, uint256[] memory _newTokenOutAmounts)
        external
    {
        require(msg.sender == owner() || msg.sender == saleRecipient, "TokenSale: not authorized");
        require(
            _buyers.length == _newTokenOutAmounts.length,
            "TokenSale: parameter length mismatch"
        );

        for (uint256 i = 0; i < _buyers.length; i++) {
            whitelistedBuyersAmount[_buyers[i]] = _newTokenOutAmounts[i];
        }
    }

    /**
     * @dev Transfers out any remaining `tokenOut` after the sale
     */
    function sweepTokenOut() external {
        require(saleStart + saleDuration < block.timestamp, "TokenSale: sale did not end yet");

        uint256 tokenOutBalance = tokenOut.balanceOf(address(this));
        require(tokenOut.transfer(owner(), tokenOutBalance), "TokenSale: transfer failed");
    }

    /**
     * @dev Transfers out any tokens (except `tokenOut`) accidentally sent to the contract.
     * @param _token The token to sweep
     */
    function sweep(ERC20 _token) external {
        require(msg.sender == owner() || msg.sender == saleRecipient, "TokenSale: not authorized");
        require(_token != tokenOut, "TokenSale: cannot sweep tokenOut as it belongs to owner");
        require(
            _token.transfer(msg.sender, _token.balanceOf(address(this))),
            "TokenSale: transfer failed"
        );
    }
}
