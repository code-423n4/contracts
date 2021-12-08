// modified from https://github.com/Uniswap/merkle-distributor/blob/master/src/balance-tree.ts
import MerkleTree from './merkle-tree'
import { BigNumber as BN, utils } from 'ethers'

export default class BalanceTree {
  private readonly tree: MerkleTree
  constructor(balances: { account: string; amount: BN }[]) {
    this.tree = new MerkleTree(
      balances.map(({ account, amount }) => {
        return BalanceTree.toNode(account, amount)
      })
    )
  }

  public static verifyProof(
    account: string,
    amount: BN,
    proof: Buffer[],
    root: Buffer
  ): boolean {
    let pair = BalanceTree.toNode(account, amount)
    for (const item of proof) {
      pair = MerkleTree.combinedHash(pair, item)
    }

    return pair.equals(root)
  }

  // keccak256(abi.encodePacked(index, account, amount))
  public static toNode(account: string, amount: BN): Buffer {
    return Buffer.from(
      utils.solidityKeccak256(['address', 'uint256'], [account, amount]).substr(2),
      'hex'
    )
  }

  public getHexRoot(): string {
    return this.tree.getHexRoot()
  }

  // returns the hex bytes32 values of the proof
  public getProof(account: string, amount: BN): string[] {
    return this.tree.getHexProof(BalanceTree.toNode(account, amount))
  }
}
