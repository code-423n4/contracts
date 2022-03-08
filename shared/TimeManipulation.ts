import hre from 'hardhat';
import {BigNumber as BN} from 'ethers';
import {POLYGON_AVERAGE_BLOCK_TIME} from './Constants';

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
  await hre.network.provider.send("hardhat_mine", ['0x' + (blockNumber - currentBlock).toString(16), POLYGON_AVERAGE_BLOCK_TIME]);
};

export const mineBlockAt = async (timestamp: number) => {
  await hre.network.provider.send('evm_setNextBlockTimestamp', [timestamp]);
  return hre.network.provider.send('evm_mine', []);
};

// default 2s per block
export const mineBlocks = async (numBlocks: string, interval: string = POLYGON_AVERAGE_BLOCK_TIME) => {
  await hre.network.provider.send("hardhat_mine", [numBlocks, interval]);
}

export const resetNetwork = async () => {
  return hre.network.provider.request({
    method: 'hardhat_reset',
    params: [],
  });
};
