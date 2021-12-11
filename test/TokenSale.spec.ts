import {expect} from 'chai';
import chai from 'chai';
import hre, {ethers, waffle} from 'hardhat';
import {IERC20, TokenLock, TokenSale} from '../typechain';
import {ZERO_ADDRESS, BN, ONE} from './shared/Constants';

const {solidity, loadFixture} = waffle;
chai.use(solidity);

let tokenIn: IERC20;
let tokenOut: IERC20;
let tokenLock: TokenLock;
let tokenSale: TokenSale;
const SALE_START = Math.floor(new Date(`2021-12-24T12:00:00.000Z`).getTime() / 1000);
const ONE_DAY = 24 * 60 * 60;
const ONE_ARENA = ethers.utils.parseUnits(`1`, 18);
const ONE_USDC = ethers.utils.parseUnits(`1`, 6);
// 20 ARENA per 1 USDC (20*1e18 * 1e18 / 1*1e6)
const TOKEN_OUT_PRICE = BN.from(`20`).mul(ONE_ARENA).mul(ONE).div(ONE_USDC);
const SALE_DURATION = 7 * ONE_DAY;
const WHITELISTED_ACCOUNTS: string[] = [];
const WHITELISTED_AMOUNTS = [BN.from(`1000`).mul(ONE_ARENA), BN.from(`500`).mul(ONE_ARENA)];

describe('TokenSale', async () => {
  const [user, admin, saleRecipient, buyer1, buyer2, other] = waffle.provider.getWallets();
  WHITELISTED_ACCOUNTS.push(buyer1.address, buyer2.address);

  // TODO: maybe create shared fixtures that can be imported by the test files
  async function fixture() {
    let TokenFactory = await ethers.getContractFactory('TestERC20');
    // Polygon USDC only has 6 decimals
    let tokenIn = (await TokenFactory.connect(admin).deploy('USDC', 'USDC')) as IERC20;
    let tokenOut = (await TokenFactory.connect(admin).deploy('ARENA', 'ARENA')) as IERC20;
    let TokenLockFactory = await ethers.getContractFactory('TokenLock');
    let tokenLock = (await TokenLockFactory.connect(admin).deploy(tokenOut.address)) as TokenLock;
    let TokenSaleFactory = await ethers.getContractFactory('TokenSale');

    let tokenSale = (await TokenSaleFactory.connect(admin).deploy(
      tokenIn.address,
      tokenOut.address,
      SALE_START,
      SALE_DURATION,
      TOKEN_OUT_PRICE,
      saleRecipient.address,
      tokenLock.address,
      ONE_DAY
    )) as TokenSale;
    await tokenSale.changeWhiteList(WHITELISTED_ACCOUNTS, WHITELISTED_AMOUNTS);
    // send tokenOuts to contract
    await tokenOut.connect(admin).transfer(
      tokenSale.address,
      WHITELISTED_AMOUNTS.reduce((acc, amount) => acc.add(amount), BN.from(`0`))
    );

    return {tokenIn, tokenOut, tokenSale};
  }

  beforeEach('deploy fixture', async () => {
    ({tokenIn, tokenOut, tokenSale} = await loadFixture(fixture));
  });

  describe('#changeWhiteList', async () => {
    beforeEach('reset time', async () => {
      // don't start sale yet
      await hre.network.provider.send('evm_setNextBlockTimestamp', [SALE_START - ONE_DAY]);
    });

    it('should revert if caller is not owner or seller', async () => {
      await expect(
        tokenSale.connect(user).changeWhiteList(WHITELISTED_ACCOUNTS, WHITELISTED_AMOUNTS)
      ).to.be.revertedWith('TokenSale: not authorized');
      await expect(
        tokenSale.connect(other).changeWhiteList(WHITELISTED_ACCOUNTS, WHITELISTED_AMOUNTS)
      ).to.be.revertedWith('TokenSale: not authorized');
    });

    it('should allow owner and seller to set', async () => {
      let buyers = [...WHITELISTED_ACCOUNTS, other.address];
      let amounts = [...WHITELISTED_AMOUNTS, 69];
      await tokenSale.connect(admin).changeWhiteList(buyers, amounts);

      // seller modifies first entry
      let diff = buyers.slice(0, 1);
      let diffAmounts = [420];
      await tokenSale.connect(saleRecipient).changeWhiteList(diff, diffAmounts);

      for (let i = 0; i < buyers.length; i++) {
        let mergedAmount = i === 0 ? diffAmounts[i] : amounts[i];
        expect(await tokenSale.whitelistedBuyersAmount(buyers[i])).to.eq(mergedAmount);
      }
    });

    it('should revert if sale already started', async () => {
      await hre.network.provider.send('evm_setNextBlockTimestamp', [SALE_START]);
      await expect(
        tokenSale.connect(admin).changeWhiteList(WHITELISTED_ACCOUNTS, WHITELISTED_AMOUNTS)
      ).to.be.revertedWith('TokenSale: sale already started');
    });
  });

  describe('#sweepTokenOut', async () => {
    it('should revert if called before token end', async () => {
      await hre.network.provider.send('evm_setNextBlockTimestamp', [SALE_START + SALE_DURATION - 1]);
      await expect(tokenSale.connect(user).sweepTokenOut()).to.be.revertedWith('TokenSale: sale did not end yet');
    });

    it('should send back any remaining tokenOut', async () => {
      await hre.network.provider.send('evm_setNextBlockTimestamp', [SALE_START + SALE_DURATION + 1]);

      let preTokenOut = await tokenOut.balanceOf(admin.address);
      await tokenSale.connect(other).sweepTokenOut();
      let postTokenOut = await tokenOut.balanceOf(admin.address);
      await expect(postTokenOut.sub(preTokenOut)).to.eq(
        WHITELISTED_AMOUNTS.reduce((acc, amount) => acc.add(amount), BN.from(`0`))
      );
    });
  });
});
