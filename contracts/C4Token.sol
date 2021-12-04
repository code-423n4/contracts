// SPDX-License-Identifier: MIT
// Modified from https://github.com/ensdomains/governance/blob/master/contracts/ENSToken.sol
pragma solidity 0.8.10;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/utils/structs/BitMaps.sol";

import "./MerkleProof.sol";

contract Code4rena is ERC20, ERC20Burnable, Ownable, ERC20Permit, ERC20Votes {
    using BitMaps for BitMaps.BitMap;

    bytes32 public merkleRoot;
    // Proportion of airdropped tokens that are immediately claimable
    // 10000 = 100%
    uint256 public immutable claimableProportion;
    uint256 public immutable claimPeriodEnds; // Timestamp at which tokens are no longer claimable
    BitMaps.BitMap private claimed;

    event MerkleRootChanged(bytes32 merkleRoot);
    event Claim(address indexed claimant, uint256 amount);

    constructor(
        uint256 _freeSupply, // number of tokens to mint for contract deployer (to transfer to DAO)
        uint256 _airdropSupply, // number of tokens to reserve for the airdrop
        uint256 _claimableProportion,
        uint256 _claimPeriodEnds
    ) ERC20("Code4rena", "C4") ERC20Permit("Code4rena") {
        // TODO: Change Symbol TBD
        require(_claimableProportion <= 10000, "claimable exceeds limit");
        claimableProportion = _claimableProportion;
        claimPeriodEnds = _claimPeriodEnds;
    }

    /**
     * @dev Claims airdropped tokens.
     * @param amount The amount of the claim being made.
     * @param merkleProof A merkle proof proving the claim is valid.
     */
    function claimTokens(uint256 amount, bytes32[] calldata merkleProof)
        external
    {
        require(
            block.timestamp < claimPeriodEnds,
            "C4Token: Claim period ended"
        );
        // we don't need to check that `merkleProof` has the correct length as
        // submitting a valid partial merkle proof would require `leaf` to map
        // to an intermediate hash in the merkle tree but `leaf` uses msg.sender
        // which is 20 bytes instead of 32 bytes and can't be chosen arbitrarily
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount));
        (bool valid, uint256 index) = MerkleProof.verify(
            merkleProof,
            merkleRoot,
            leaf
        );
        require(valid, "C4Token: Valid proof required.");
        require(!isClaimed(index), "C4Token: Tokens already claimed.");

        claimed.set(index);
        uint256 claimableAmount = (amount * claimableProportion) / 10000;
        emit Claim(msg.sender, claimableAmount);

        // mint claimable proportion to caller
        _transfer(address(this), msg.sender, claimableAmount);
    }

    /**
     * @dev Allows the owner to sweep unclaimed tokens after the claim period ends.
     * @param dest The address to sweep the tokens to.
     */
    function sweep(address dest) external onlyOwner {
        require(
            block.timestamp >= claimPeriodEnds,
            "C4Token: Claim period not yet ended"
        );
        _transfer(address(this), dest, balanceOf(address(this)));
    }

    /**
     * @dev Returns true if the claim at the given index in the merkle tree has already been made.
     * @param index The index into the merkle tree.
     */
    function isClaimed(uint256 index) public view returns (bool) {
        return claimed.get(index);
    }

    /**
     * @dev Sets the merkle root. Only callable if the root is not yet set.
     * @param _merkleRoot The merkle root to set.
     */
    function setMerkleRoot(bytes32 _merkleRoot) external onlyOwner {
        require(merkleRoot == bytes32(0), "C4Token: Merkle root already set");
        merkleRoot = _merkleRoot;
        emit MerkleRootChanged(_merkleRoot);
    }

    /**
     * @dev Mints new tokens.
     * @param dest The address to mint the new tokens to.
     * @param amount The quantity of tokens to mint.
     */
    function mint(address dest, uint256 amount) external onlyOwner {
        _mint(dest, amount);
    }

    // The following functions are overrides required by Solidity.

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20, ERC20Votes) {
        super._afterTokenTransfer(from, to, amount);
    }

    function _mint(address to, uint256 amount)
        internal
        override(ERC20, ERC20Votes)
    {
        super._mint(to, amount);
    }

    function _burn(address account, uint256 amount)
        internal
        override(ERC20, ERC20Votes)
    {
        super._burn(account, amount);
    }
}
