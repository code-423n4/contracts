// modified from https://github.com/Uniswap/merkle-distributor/blob/master/src/parse-balance-map.ts
import BalanceTree from './balance-tree';
import {BigNumber as BN, utils} from 'ethers';
const {isAddress, getAddress} = utils;

export interface MerkleDistributorInfo {
  merkleRoot: string;
  tokenTotal: string;
  claims: {
    [account: string]: {
      index: number;
      amount: string;
      proof: string[];
    };
  };
}

type OldFormat = {[account: string]: string};
type Format = {address: string; amount: string};
export function parseBalanceMap(balances: OldFormat): MerkleDistributorInfo {
  const formatBalances: Format[] = Object.keys(balances).map((account) => ({
    address: account,
    amount: balances[account],
  }));

  const dataByAddress = formatBalances.reduce<{
    [address: string]: {amount: BN};
  }>((memo, {address: account, amount}) => {
    if (!isAddress(account)) {
      throw new Error(`Found invalid address: ${account}`);
    }
    const parsed = getAddress(account);
    if (memo[parsed]) throw new Error(`Duplicate address: ${parsed}`);
    // make sure all input amounts are strings, otherwise we already have precision errors when parsing the file and converting to Number
    if (typeof amount !== `string`) throw new Error(`Amount in input not a string: ${amount}`);
    const parsedNum = BN.from(amount);
    if (parsedNum.lte(0)) throw new Error(`Invalid amount for account: ${account}`);

    memo[parsed] = {amount: parsedNum};
    return memo;
  }, {});

  const sortedAddresses = Object.keys(dataByAddress).sort();

  // construct a tree
  const tree = new BalanceTree(
    sortedAddresses.map((address) => ({account: address, amount: dataByAddress[address].amount}))
  );

  // generate claims
  const claims = sortedAddresses.reduce<{
    [address: string]: {index: number; amount: string; proof: string[]};
  }>((memo, address) => {
    const {amount} = dataByAddress[address];
    memo[address] = {
      index: tree.getLeafIndex(address, amount),
      amount: amount.toString(),
      proof: tree.getProof(address, amount),
    };
    return memo;
  }, {});

  const tokenTotal: BN = sortedAddresses.reduce<BN>((memo, key) => memo.add(dataByAddress[key].amount), BN.from(0));

  return {
    merkleRoot: tree.getHexRoot(),
    tokenTotal: tokenTotal.toString(),
    claims,
  };
}
