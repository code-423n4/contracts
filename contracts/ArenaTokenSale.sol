// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../interfaces/IRevokableTokenLock.sol";

/**
 * @dev Sells a token at a predetermined price to whitelisted buyers. The number of tokens each address can buy can be regulated.
 */
contract TokenSale is Ownable {
    /// token to take in (USDC)
    ERC20 public immutable tokenIn;
    /// token to give out (ARENA)
    ERC20 public immutable tokenOut;
    /// time when tokens can be first purchased
    uint64 public immutable saleStart;
    /// duration of the token sale, cannot purchase afterwards
    uint64 public immutable saleDuration;
    /// address receiving the proceeds of the sale
    address internal saleRecipient;
    /// vesting contract
    IRevokableTokenLock public tokenLock;
    /// vesting duration
    uint256 public vestDuration;

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
     * @param _saleRecipient The address receiving the proceeds of the sale
     * @param _tokenLock The contract in which _tokenOut will be vested in
     * @param _vestDuration Token vesting duration
     */
    constructor(
        ERC20 _tokenIn,
        ERC20 _tokenOut,
        uint64 _saleStart,
        uint64 _saleDuration,
        uint256 _tokenOutPrice,
        address _saleRecipient,
        address _tokenLock,
        uint256 _vestDuration
    ) {
        require(block.timestamp <= _saleStart, "TokenSale: start date may not be in the past");
        require(_saleDuration > 0, "TokenSale: the sale duration must not be zero");
        require(_tokenOutPrice > 0, "TokenSale: the price must not be zero");
        require(_vestDuration > 0, "TokenSale: the vest duration must not be zero");
        require(
            _saleRecipient != address(0) && _saleRecipient != address(this),
            "TokenSale: sale recipient should not be zero or this"
        );
        require(_tokenLock != address(0), "Address cannot be 0x");

        tokenIn = _tokenIn;
        tokenOut = _tokenOut;
        saleStart = _saleStart;
        saleDuration = _saleDuration;
        tokenOutPrice = _tokenOutPrice;
        saleRecipient = _saleRecipient;

        tokenLock = IRevokableTokenLock(_tokenLock);
        vestDuration = _vestDuration;
    }

    /**
     * @dev Whitelisted buyers can buy `tokenOutAmount` tokens at the `tokenOutPrice`.
     * @return tokenInAmount_ The amount of `tokenIn`s  bought.
     */
    function buy() external returns (uint256 tokenInAmount_) {
        require(saleStart <= block.timestamp, "TokenSale: not started");
        require(block.timestamp <= saleStart + saleDuration, "TokenSale: already ended");
        uint256 _tokenOutAmount = whitelistedBuyersAmount[msg.sender];
        require(_tokenOutAmount > 0, "TokenSale: non-whitelisted purchaser or have already bought");
        whitelistedBuyersAmount[msg.sender] = 0;
        tokenInAmount_ = (_tokenOutAmount * tokenOutPrice) / 1e18;
        require(
            tokenIn.transferFrom(msg.sender, saleRecipient, tokenInAmount_),
            "TokenSale: tokenIn transfer failed"
        );

        uint256 claimableAmount = (_tokenOutAmount * 2_000) / 10_000;
        uint256 remainingAmount;
        unchecked {
            // this subtraction does not underflow as claimableAmount is a percentage on _tokenOutAmount
            remainingAmount = _tokenOutAmount - claimableAmount;
        }

        require(
            tokenOut.transfer(msg.sender, claimableAmount),
            "TokenSale: tokenOut transfer failed"
        );

        // if we use same tokenLock instance as airdrop, we make sure that
        // the claimers and buyers are distinct to not reinitialize vesting
        tokenLock.setupVesting(
            msg.sender,
            block.timestamp,
            block.timestamp,
            block.timestamp + vestDuration
        );
        // approve TokenLock for token transfer
        require(tokenOut.approve(address(tokenLock), remainingAmount), "Approve failed");
        tokenLock.lock(msg.sender, remainingAmount);

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
        require(block.timestamp < saleStart, "TokenSale: sale already started");

        for (uint256 i = 0; i < _buyers.length; i++) {
            whitelistedBuyersAmount[_buyers[i]] = _newTokenOutAmounts[i];
        }
    }

    /**
     * @dev Transfers out any remaining `tokenOut` after the sale to owner
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
