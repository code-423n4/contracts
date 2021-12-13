import hre from 'hardhat';

export const setNextBlockTimeStamp = async (timestamp: number) => {
  return hre.network.provider.send('evm_setNextBlockTimestamp', [timestamp]);
};
