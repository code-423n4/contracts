import hre, {ethers} from 'hardhat';
import {ONE_18} from './Constants';

export const impersonateAccountWithFunds = async (address: string) => {
  await hre.network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [address],
  });
  // these accounts don't start with a balance, give them one
  await hre.network.provider.send('hardhat_setBalance', [
    address,
    // need to strip leading zeroes here https://github.com/nomiclabs/hardhat/issues/1585
    ONE_18.toHexString().replace(/0x0+/, '0x'),
  ]);

  return ethers.provider.getSigner(address);
};

export const stopImpersonateAccount = async (address: string) => {
  await hre.network.provider.request({
    method: 'hardhat_stopImpersonatingAccount',
    params: [address],
  });
};
