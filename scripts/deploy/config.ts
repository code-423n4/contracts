import {BigNumber as BN, constants} from 'ethers';
import {ONE_18, ONE_DAY, ONE_YEAR} from '../../shared/Constants';

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

type TokenSaleConfig = {
  TOKEN_SALE_START: number;
  TOKEN_SALE_DURATION: number;
  TOKEN_SALE_USDC: string;
  TOKEN_SALE_ARENA_PRICE: BN;
  TOKEN_SALE_RECIPIENT: string;
  TOKEN_SALE_WHITELIST: typeof TOKEN_SALE_WHITELIST;
  RECIPIENT_AMOUNT: BN;
  TOKEN_SALE_SUPPLY: BN;
};

const TOKEN_SALE_WHITELIST = [
  {buyer: '0x1aa1F9f80f4c5dCe34d0f4faB4F66AAF562330bd', arenaAmount: BN.from(33_333_333).mul(ONE_18)},
  {buyer: '0x3a5c572aE7a806c661970058450dC90D9eF0f353', arenaAmount: BN.from(13_333_333).mul(ONE_18)},
  {buyer: '0xcfc50541c3dEaf725ce738EF87Ace2Ad778Ba0C5', arenaAmount: BN.from(10_166_666).mul(ONE_18)},
  {buyer: '0xC02ad7b9a9121fc849196E844DC869D2250DF3A6', arenaAmount: BN.from(8_333_333).mul(ONE_18)},
  {buyer: '0xCfCA53C4b6d3f763969c9A9C36DBCAd61F11F36D', arenaAmount: BN.from(6_666_666).mul(ONE_18)},
  {buyer: '0x636EDa86F6EC324347Bd560c1045192586b9DEE8', arenaAmount: BN.from(6_666_666).mul(ONE_18)},
  {buyer: '0xDbBB1bD4cbDA95dd2f1477be139C3D6cb9d2B349', arenaAmount: BN.from(3_333_333).mul(ONE_18)},
  {buyer: '0x4dA94e682326BD14997D1E1c62350654D8e44c5d', arenaAmount: BN.from(2_500_000).mul(ONE_18)},
  {buyer: '0x20392b9607dc8cC49BEa5B7B90E65d6251617538', arenaAmount: BN.from(1_166_666).mul(ONE_18)},
  {buyer: '0x83b23E8e5da74fD3f3E5471865FC778d9c843df0', arenaAmount: BN.from(833_333).mul(ONE_18)},
  {buyer: '0x7fCAf93cc92d51c490FFF701fb2C6197497a80db', arenaAmount: BN.from(833_333).mul(ONE_18)},
];

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
    FREE_SUPPLY: BN.from(640_826_767).mul(constants.WeiPerEther), // 1B - mainnet markle tokenTotal
    AIRDROP_SUPPLY: BN.from(359_173_233).mul(constants.WeiPerEther), // mainnet merkle tokenTotal
    CLAIMABLE_PROPORTION: 2000, // 20%
    CLAIM_END_DATE: '2023-1-11',
    VEST_DURATION: 4 * ONE_YEAR,
    MERKLE_ROOT: '0xb86e0dced055310e26ce11e69d47b6e6064be988564fb002d6ba5a29e7eee713',
    TIMELOCK_DELAY: 2 * ONE_DAY, // 2 days (same as ENS)
    EXPORT_FILENAME: 'polygonAddresses.json',
  },
};

export const tokenSaleConfigs: {[key: number]: TokenSaleConfig} = {
  // polygon mainnet
  137: {
    TOKEN_SALE_START: 1644451200, // Thursday, February 10, 2022 12:00:00 AM UTC
    TOKEN_SALE_DURATION: 10 * ONE_DAY,
    TOKEN_SALE_USDC: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
    TOKEN_SALE_ARENA_PRICE: BN.from(30_000).mul(ONE_18).div(ONE_18), // 0.03 USDC * 1e18 / 1.0 ARENA
    TOKEN_SALE_RECIPIENT: '0x7f0049597056E37B4B1f887196E44CAc050D4863 ', // C4 Polygon multisig
    TOKEN_SALE_WHITELIST,
    RECIPIENT_AMOUNT: BN.from(1_750_000).mul(BN.from(10).pow(6)), // 1.75M USDC, rest to treasury
    TOKEN_SALE_SUPPLY: BN.from(100_000_000).mul(ONE_18), // 100M ARENA tokens
  },
};
