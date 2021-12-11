// modified from https://github.com/Uniswap/merkle-distributor/blob/master/src/balance-tree.ts
import MerkleTree from './merkle-tree';
import {BigNumber as BN, utils} from 'ethers';
import {keccak256} from 'ethereumjs-util';

export default class BalanceTree {
  private readonly tree: MerkleTree;
  constructor(balances: {account: string; amount: BN}[]) {
    this.tree = new MerkleTree(
      balances.map(({account, amount}) => {
        return BalanceTree.toNode(account, amount);
      })
    );
  }

  public static verifyProof(account: string, amount: BN, proof: Buffer[], root: Buffer): boolean {
    let pair = BalanceTree.toNode(account, amount);
    for (const item of proof) {
      pair = MerkleTree.combinedHash(pair, item);
    }

    return pair.equals(root);
  }

  // keccak256(abi.encodePacked(index, account, amount))
  public static toNode(account: string, amount: BN): Buffer {
    return Buffer.from(utils.solidityKeccak256(['address', 'uint256'], [account, amount]).substr(2), 'hex');
  }

  public getHexRoot(): string {
    return this.tree.getHexRoot();
  }

  // returns the hex bytes32 values of the proof
  public getProof(account: string, amount: BN): string[] {
    return this.tree.getHexProof(BalanceTree.toNode(account, amount));
  }

  // returns the same leaf index the contract is using
  public getLeafIndex(account: string, amount: BN): number {
    let computedHash = BalanceTree.toNode(account, amount); // leaf
    let proof = this.tree.getProof(computedHash);
    let index = 0;

    for (let i = 0; i < proof.length; i++) {
      index *= 2;
      let proofElement = proof[i];

      if (computedHash.compare(proofElement) != 1) {
        // computedHash <= proofElement
        computedHash = keccak256(Buffer.concat([computedHash, proofElement]));
      } else {
        computedHash = keccak256(Buffer.concat([proofElement, computedHash]));
        index += 1;
      }
    }

    if (this.tree.getRoot().compare(computedHash) !== 0) throw new Error('getLeafIndex did not recompute correct root');

    return index;
  }
}
