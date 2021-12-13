import hre from 'hardhat';


export async function getCurrentBlock() {
  return await hre.network.provider.request({
    method: 'eth_blockNumber',
  });
}

// Workaround for https://github.com/nomiclabs/hardhat/issues/1112
export async function mineBlocks(blocks: number) {
  while (blocks > 0) {
    blocks--;
    await hre.network.provider.request({
      method: 'evm_mine',
      params: [],
    });
  }
}
