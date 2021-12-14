import {BigNumber as BN, constants} from 'ethers';
import {ONE_DAY, ONE_YEAR} from '../test/shared/Constants';
export const config = {
    FREE_SUPPLY: BN.from(900).mul(1_000_000).mul(constants.WeiPerEther), // 900M
    AIRDROP_SUPPLY: BN.from(100).mul(1_000_000).mul(constants.WeiPerEther), // 100M
    CLAIMABLE_PROPORTION: 2000, // 20%
    CLAIM_END_DATE: "2022-12-25", // TODO: edit value
    VEST_DURATION: 4 * ONE_YEAR, // 4 years
    MERKLE_ROOT: '0xf6a3174a6a23755234ca9741160ced7ad3bb030d9beebf34b81c7ccee5521325', // TODO: edit this
    TIMELOCK_DELAY: 2 * ONE_DAY, // 2 days (same as ENS)
    EXPORT_FILENAME: 'contractAddresses.json'
};
