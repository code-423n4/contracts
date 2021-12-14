import {BigNumber as BN, constants} from 'ethers';
import {ONE_DAY, ONE_YEAR} from '../test/shared/Constants';
export const allConfigs: any = {
  // rinkeby
  4: {
    FREE_SUPPLY: BN.from(900).mul(1_000_000).mul(constants.WeiPerEther), // 900M
    AIRDROP_SUPPLY: BN.from(100).mul(1_000_000).mul(constants.WeiPerEther), // 100M
    CLAIMABLE_PROPORTION: 2000, // 20%
    CLAIM_END_DATE: '2022-12-25',
    VEST_DURATION: 4 * ONE_DAY,
    MERKLE_ROOT: '0x07087dd5ec10dc92a26074d31dea66fb039c30cb8bcc5d7536c7f55f116cd77e',
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
