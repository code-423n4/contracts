import hre from 'hardhat';

export const setNextBlockTimeStamp = async (timestamp: number) => {
  return hre.network.provider.send('evm_setNextBlockTimestamp', [timestamp]);
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
