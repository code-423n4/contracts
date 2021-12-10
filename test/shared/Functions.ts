import {network} from 'hardhat';

export async function getCurrentBlock() {
  return await network.provider.request({
    method: 'eth_blockNumber',
  });
}

// Number should be safe for timestamp
export async function setNextBlockTimestamp(ts: number) {
  return await network.provider.request({
    method: 'evm_setNextBlockTimestamp',
    params: [ts],
  });
}

// Workaround for https://github.com/nomiclabs/hardhat/issues/1112
export async function mineBlocks(blocks: number) {
  while (blocks > 0) {
    blocks--;
    await network.provider.request({
      method: 'evm_mine',
      params: [],
    });
  }
}
