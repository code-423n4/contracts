import hre from 'hardhat';
import {BigNumber as BN} from 'ethers';

export async function getHeadBlockNumber(): Promise<number> {
  return BN.from(await hre.network.provider.send('eth_blockNumber', [])).toNumber();
}

export const setNextBlockTimeStamp = async (timestamp: number) => {
  return hre.network.provider.send('evm_setNextBlockTimestamp', [timestamp]);
};

export const increaseNextBlockTime = async (seconds: number) => {
  return hre.network.provider.send('evm_increaseTime', [seconds]);
};

export const setNextBlockNumber = async (blockNumber: number) => {
  let currentBlock = await getHeadBlockNumber();
  for (; currentBlock < blockNumber; currentBlock++) {
    // polygon has a block time of 2.2 seconds
    await hre.network.provider.send('evm_increaseTime', [2]);
    await hre.network.provider.send('evm_mine', []);
  }
};

export const mineBlockAt = async (timestamp: number) => {
  await hre.network.provider.send('evm_setNextBlockTimestamp', [timestamp]);
  return hre.network.provider.send('evm_mine', []);
};

export const resetNetwork = async () => {
  return hre.network.provider.request({
    method: 'hardhat_reset',
    params: [],
  });
};
