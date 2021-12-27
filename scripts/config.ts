import {BigNumber as BN, constants} from 'ethers';
import {ONE_DAY, ONE_YEAR} from '../test/shared/Constants';

type Config = {
  FREE_SUPPLY: BN;
  AIRDROP_SUPPLY: BN;
  CLAIMABLE_PROPORTION: number;
  CLAIM_END_DATE: string;
  VEST_DURATION: number;
  MERKLE_ROOT: string;
  TIMELOCK_DELAY: number;
  EXPORT_FILENAME: string;
};

export const allConfigs: {[key: number]: Config} = {
  // rinkeby
  4: {
    FREE_SUPPLY: BN.from(900).mul(1_000_000).mul(constants.WeiPerEther), // 900M
    AIRDROP_SUPPLY: BN.from(100).mul(1_000_000).mul(constants.WeiPerEther), // 100M
    CLAIMABLE_PROPORTION: 2000, // 20%
    CLAIM_END_DATE: '2022-12-25',
    VEST_DURATION: 4 * ONE_DAY,
    MERKLE_ROOT: '0xd97c9a423833d78e0562b8ed2d14752b54e7ef9b52314cafb197e3a339299901',
    TIMELOCK_DELAY: 1800, // 30 mins
    EXPORT_FILENAME: 'rinkebyAddresses.json',
  },
  // polygon mainnet
  137: {
    FREE_SUPPLY: BN.from(900).mul(1_000_000).mul(constants.WeiPerEther), // 900M
    AIRDROP_SUPPLY: BN.from(100).mul(1_000_000).mul(constants.WeiPerEther), // 100M
    CLAIMABLE_PROPORTION: 2000, // 20%
    CLAIM_END_DATE: '2022-12-25', // TODO: edit value
    VEST_DURATION: 4 * ONE_YEAR,
    MERKLE_ROOT: '0x0', // TODO: edit value
    TIMELOCK_DELAY: 2 * ONE_DAY, // 2 days (same as ENS)
    EXPORT_FILENAME: 'polygonAddresses.json',
  },
};
