import {ethers} from 'hardhat';

export const BN = ethers.BigNumber;
export const ZERO_ADDRESS = ethers.constants.AddressZero;
export const PRECISION = ethers.constants.WeiPerEther;
export const ZERO = ethers.constants.Zero;
export const ONE = ethers.constants.One;
export const TWO = ethers.constants.Two;
export const MAX_UINT = ethers.constants.MaxUint256;
export const HOUR = ethers.BigNumber.from(60).mul(60).mul(1000);
