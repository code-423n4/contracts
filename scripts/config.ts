import {BigNumber as BN, constants} from 'ethers';
import {ONE_18, ONE_DAY, ONE_YEAR} from '../test/shared/Constants';

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
  EXPORT_FILENAME: string;
};

const TOKEN_SALE_WHITELIST = [
  {buyer: '0x0f4Aeb1847B7F1a735f4a5Af7E8C299b793c1a9A', arenaAmount: BN.from(`10000`).mul(ONE_18)},
  {buyer: '0x3Ab0029e1C4515134464b267557cB80A39902699', arenaAmount: BN.from(`10001`).mul(ONE_18)},
  {buyer: '0x4F3F7ca7E91D869180EBbA55e4322845a8Dc6862', arenaAmount: BN.from(`10002`).mul(ONE_18)},
  {buyer: '0x5dcEb6f4dc5b64Af6271A5Ab3297DbE3C01dd57B', arenaAmount: BN.from(`10003`).mul(ONE_18)},
  {buyer: '0x62641eAE546835813B56EC7b544756A532275Dd3', arenaAmount: BN.from(`10004`).mul(ONE_18)},
  {buyer: '0x670f9e8B37d5816c2eB93A1D94841C66652a8E26', arenaAmount: BN.from(`10005`).mul(ONE_18)},
  {buyer: '0x691Cbab55CC1806d29994784Ba9d9e679c03f164', arenaAmount: BN.from(`10006`).mul(ONE_18)},
  {buyer: '0x697ccd97C8419EBba7347CEF03a0CD02804EbF54', arenaAmount: BN.from(`10007`).mul(ONE_18)},
  {buyer: '0x6c422839E7EceDb6d2A86F3F2bFd03aDd154Fc27', arenaAmount: BN.from(`10008`).mul(ONE_18)},
  {buyer: '0x7C0fb88c87c30eBF70340E25fe47763e53b907cF', arenaAmount: BN.from(`10009`).mul(ONE_18)},
  {buyer: '0x8498EAb53e03E3143d77B2303eDBdAC6C9041D33', arenaAmount: BN.from(`10010`).mul(ONE_18)},
  {buyer: '0x8D31BAC0870e323354eAF6F98277860772FFB2d4', arenaAmount: BN.from(`10011`).mul(ONE_18)},
  {buyer: '0xA432F83d8054F5F859cAcb86574baC5e07DD6529', arenaAmount: BN.from(`10012`).mul(ONE_18)},
  {buyer: '0xD3488b8C87416946D82CC957178B0863A1F089b2', arenaAmount: BN.from(`10013`).mul(ONE_18)},
  {buyer: '0xD5388291EAbe96b56069440C97046791E2F72573', arenaAmount: BN.from(`10014`).mul(ONE_18)},
  {buyer: '0xF20eb7eAf52712EA0Aa80467741f34E6b0dB18F8', arenaAmount: BN.from(`10015`).mul(ONE_18)},
  {buyer: '0xa1fA3C686C9c4E5e8407b32B67191B079a65ffD2', arenaAmount: BN.from(`10016`).mul(ONE_18)},
  {buyer: '0xbB79597641483Ed96BCE9fc24b4D63F720898b8A', arenaAmount: BN.from(`10017`).mul(ONE_18)},
  {buyer: '0xe552C6A88E71B2A5069Dec480507F54321Dc65F3', arenaAmount: BN.from(`10018`).mul(ONE_18)},
  {buyer: '0xf4290941dBc8b31c277E30deFF3fC59979FC6757', arenaAmount: BN.from(`10019`).mul(ONE_18)},
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
    TOKEN_SALE_START: Math.floor(new Date(`2022-01-12T00:00:00.000Z`).getTime() / 1000),
    TOKEN_SALE_DURATION: 14 * ONE_DAY,
    TOKEN_SALE_USDC: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
    TOKEN_SALE_ARENA_PRICE: BN.from(30_000).mul(ONE_18).div(ONE_18), // 0.03 USDC * 1e18 / 1.0 ARENA
    TOKEN_SALE_RECIPIENT: '0x670f9e8B37d5816c2eB93A1D94841C66652a8E26', // TODO: change to intended recipient
    TOKEN_SALE_WHITELIST,
    EXPORT_FILENAME: 'polygonTokenSaleAddress.json',
  },
};
