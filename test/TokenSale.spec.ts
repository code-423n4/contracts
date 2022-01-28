import {expect} from 'chai';
import chai from 'chai';
import {ethers, waffle} from 'hardhat';
import {BigNumber as BN} from 'ethers';
import {IERC20, RevokableTokenLock, TokenSale} from '../typechain';
import {ONE_DAY, ONE_18, MAX_UINT, ONE_YEAR} from '../shared/Constants';
import {setNextBlockTimeStamp, resetNetwork} from '../shared/TimeManipulation';

const {solidity, loadFixture} = waffle;
chai.use(solidity);

let tokenIn: TestERC20;
let tokenOut: TestERC20;
let tokenLock: RevokableTokenLock;
let tokenSale: TokenSale;
// hardhat implicitly uses now as block time, so need to make tests relative to now
const SALE_START = Math.floor(Date.now() / 1000) + ONE_YEAR;
const ARENA_DECIMALS = 18;
const ONE_ARENA = ethers.utils.parseUnits(`1`, ARENA_DECIMALS);
// Polygon USDC only has 6 decimals
const TOKEN_IN_DECIMALS = 6;
const ONE_USDC = ethers.utils.parseUnits(`1`, TOKEN_IN_DECIMALS);
// 0.05 USDC per 1.0 ARENA (0.05e6 * 1e18 / 1*1e18)
const TOKEN_OUT_PRICE = ethers.utils.parseUnits(`0.05`, TOKEN_IN_DECIMALS).mul(ONE_18).div(ONE_ARENA);
const SALE_DURATION = 7 * ONE_DAY;
// 75 USDC
const SALE_RECIPIENT_AMOUNT = ONE_USDC.mul(75);
const WHITELISTED_ACCOUNTS: string[] = [];
// each buyer allowed 50 USDC worth of ARENA tokens (1000)
const BUYER_USDC_AMOUNT = ONE_USDC.mul(50);
const BUYER_ARENA_AMOUNT = BN.from(`1000`).mul(ONE_ARENA);
const WHITELISTED_AMOUNTS = Array(3).fill(BUYER_ARENA_AMOUNT);

describe('TokenSale', async () => {
  const [user, admin, saleRecipient, buyer1, buyer2, buyer3, timelock, other] = waffle.provider.getWallets();
  WHITELISTED_ACCOUNTS.push(buyer1.address, buyer2.address, buyer3.address);

  async function fixture() {
    let TokenFactory = await ethers.getContractFactory('TestERC20');
    let tokenIn = await TokenFactory.connect(admin).deploy('USDC', 'USDC');
    let tokenOut = await TokenFactory.connect(admin).deploy('ARENA', 'ARENA');
    let TokenLockFactory = await ethers.getContractFactory('RevokableTokenLock');
    let tokenLock = (await TokenLockFactory.connect(admin).deploy(
      tokenOut.address,
      admin.address
    )) as RevokableTokenLock;

    let TokenSaleFactory = await ethers.getContractFactory('TokenSale');
    let tokenSale = (await TokenSaleFactory.connect(admin).deploy(
      tokenIn.address,
      tokenOut.address,
      SALE_START,
      SALE_DURATION,
      TOKEN_OUT_PRICE,
      saleRecipient.address,
      tokenLock.address,
      timelock.address,
      ONE_DAY,
      SALE_RECIPIENT_AMOUNT
    )) as TokenSale;
    await tokenLock.setTokenSale(tokenSale.address);
    await tokenSale.changeWhiteList(WHITELISTED_ACCOUNTS, WHITELISTED_AMOUNTS);

    // distribute tokens and set approvals
    await tokenOut.connect(admin).transfer(
      tokenSale.address,
      WHITELISTED_AMOUNTS.reduce((acc, amount) => acc.add(amount), BN.from(`0`))
    );
    for (const buyer of [buyer1, buyer2, buyer3]) {
      await tokenIn.connect(admin).transfer(buyer.address, BN.from(1_000_000).mul(ONE_USDC));
      await tokenIn.connect(buyer).approve(tokenSale.address, MAX_UINT);
    }

    return {tokenIn, tokenOut, tokenSale, tokenLock};
  }

  beforeEach('deploy fixture', async () => {
    ({tokenIn, tokenOut, tokenSale, tokenLock} = await loadFixture(fixture));
  });

  describe('#changeWhiteList', async () => {
    beforeEach('reset time', async () => {
      // don't start sale yet
      await setNextBlockTimeStamp(SALE_START - ONE_DAY);
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

    it('should revert if sale is ongoing', async () => {
      await setNextBlockTimeStamp(SALE_START);
      await expect(
        tokenSale.connect(admin).changeWhiteList(WHITELISTED_ACCOUNTS, WHITELISTED_AMOUNTS)
      ).to.be.revertedWith('TokenSale: ongoing sale');
    });

    it('should revert if a buyer has an existing vesting schedule', async () => {
      await tokenLock.connect(admin).setupVesting(buyer1.address, 1, 2, 3);
      await expect(
        tokenSale.connect(admin).changeWhiteList(WHITELISTED_ACCOUNTS, WHITELISTED_AMOUNTS)
      ).to.be.revertedWith('TokenSale: buyer has existing vest schedule');
    });
  });

  describe('#setNewSaleStart', async () => {
    it('should revert if caller is not owner or seller', async () => {
      await expect(tokenSale.connect(user).setNewSaleStart(SALE_START + SALE_DURATION - 1)).to.be.revertedWith(
        'TokenSale: not authorized'
      );
      await expect(tokenSale.connect(other).setNewSaleStart(SALE_START + SALE_DURATION - 1)).to.be.revertedWith(
        'TokenSale: not authorized'
      );
    });

    it('should revert if sale is ongoing', async () => {
      await setNextBlockTimeStamp(SALE_START);
      await expect(tokenSale.connect(admin).setNewSaleStart(SALE_START + 2 * SALE_DURATION)).to.be.revertedWith(
        'TokenSale: ongoing sale'
      );
      await setNextBlockTimeStamp(SALE_START + SALE_DURATION);
      await expect(tokenSale.connect(saleRecipient).setNewSaleStart(SALE_START + 2 * SALE_DURATION)).to.be.revertedWith(
        'TokenSale: ongoing sale'
      );
    });

    it('will revert if sale start time is set before block.timestamp', async () => {
      await setNextBlockTimeStamp(SALE_START - 2 * SALE_DURATION);
      await expect(tokenSale.connect(admin).setNewSaleStart(SALE_START - 2 * SALE_DURATION - 1)).to.be.revertedWith(
        'TokenSale: new sale too early'
      );

      await setNextBlockTimeStamp(SALE_START - SALE_DURATION);
      await expect(tokenSale.connect(admin).setNewSaleStart(SALE_START - SALE_DURATION)).to.be.revertedWith(
        'TokenSale: new sale too early'
      );
    });

    it('should bring forward sale start time before sale starts', async () => {
      await setNextBlockTimeStamp(SALE_START - 1.5 * SALE_DURATION);
      expect(await tokenSale.saleStart()).to.eq(SALE_START);
      await tokenSale.connect(admin).setNewSaleStart(SALE_START - SALE_DURATION);
      expect(await tokenSale.saleStart()).to.eq(SALE_START - SALE_DURATION);
    });

    it('should set new sale start after current one ends', async () => {
      await setNextBlockTimeStamp(SALE_START + SALE_DURATION + 1);
      await tokenSale.connect(admin).setNewSaleStart(SALE_START + 2 * SALE_DURATION);
      expect(await tokenSale.saleStart()).to.eq(SALE_START + 2 * SALE_DURATION);
    });
  });

  describe('#sweepTokenOut', async () => {
    it('should revert if called before token sale end', async () => {
      await setNextBlockTimeStamp(SALE_START + SALE_DURATION - 1);
      await expect(tokenSale.connect(user).sweepTokenOut()).to.be.revertedWith('TokenSale: ongoing sale');
    });

    it('should send back any remaining tokenOut', async () => {
      await setNextBlockTimeStamp(SALE_START + SALE_DURATION + 1);

      let preTokenOut = await tokenOut.balanceOf(admin.address);
      await tokenSale.connect(other).sweepTokenOut();
      let postTokenOut = await tokenOut.balanceOf(admin.address);
      expect(postTokenOut.sub(preTokenOut)).to.eq(
        WHITELISTED_AMOUNTS.reduce((acc, amount) => acc.add(amount), BN.from(`0`))
      );
    });
  });

  describe('#sweep', async () => {
    let otherToken: TestERC20;
    beforeEach('distribute other token', async () => {
      let TokenFactory = await ethers.getContractFactory('TestERC20');
      otherToken = await TokenFactory.connect(admin).deploy('OTHER', 'OTHER');
      await otherToken.transfer(tokenSale.address, ONE_18);
    });

    it('should revert if caller is not owner or seller', async () => {
      await expect(tokenSale.connect(user).sweep(otherToken.address)).to.be.revertedWith('TokenSale: not authorized');
      await expect(tokenSale.connect(other).sweep(otherToken.address)).to.be.revertedWith('TokenSale: not authorized');
    });

    it('should not allow sending back the tokenOut', async () => {
      await expect(tokenSale.connect(admin).sweep(tokenOut.address)).to.be.revertedWith(
        'TokenSale: cannot sweep tokenOut as it belongs to owner'
      );
    });

    it('should allow sweeping other tokens', async () => {
      await tokenSale.connect(saleRecipient).sweep(otherToken.address);
      let saleBalance = await otherToken.balanceOf(tokenSale.address);
      expect(saleBalance).to.eq(`0`);
      let sellerBalance = await otherToken.balanceOf(saleRecipient.address);
      expect(sellerBalance).to.eq(ONE_18);
    });
  });

  describe('#buy', async () => {
    beforeEach('reset time', async () => {
      // start sale
      await setNextBlockTimeStamp(SALE_START);
    });

    it('should revert if trying to buy before sale', async () => {
      await setNextBlockTimeStamp(SALE_START - 1);
      await expect(tokenSale.connect(buyer1).buy()).to.be.revertedWith('TokenSale: not started');
    });

    it('should revert if trying to buy after sale duration', async () => {
      await setNextBlockTimeStamp(SALE_START + SALE_DURATION + 1);
      await expect(tokenSale.connect(buyer1).buy()).to.be.revertedWith('TokenSale: already ended');
    });

    it('should revert if non-whitelisted tries to buy', async () => {
      await expect(tokenSale.connect(user).buy()).to.be.revertedWith(
        'TokenSale: non-whitelisted purchaser or have already bought'
      );
      await expect(tokenSale.connect(other).buy()).to.be.revertedWith(
        'TokenSale: non-whitelisted purchaser or have already bought'
      );
    });

    it('should let whitelisted buy only full amount', async () => {
      let preBuyerTokenInBalance = await tokenIn.balanceOf(buyer1.address);
      let preSellerTokenInBalance = await tokenIn.balanceOf(saleRecipient.address);
      await tokenSale.connect(buyer1).buy();
      let postBuyerTokenInBalance = await tokenIn.balanceOf(buyer1.address);
      let tokenInPaid = preBuyerTokenInBalance.sub(postBuyerTokenInBalance);

      // 0.05 USDC per ARENA => buying 1000 ARENA should cost 0.05 USDC / ARENA * 1000 ARENA = 50 USDC
      let expectedTokenIn = ethers.utils.parseUnits(`50`, TOKEN_IN_DECIMALS);
      expect(tokenInPaid).eq(expectedTokenIn);

      // saleRecipient received entire amount
      expect(await tokenIn.balanceOf(saleRecipient.address)).to.eq(preSellerTokenInBalance.add(tokenInPaid));

      // buyer received 20% immediately, 80% locked
      expect(await tokenOut.balanceOf(buyer1.address)).to.eq(WHITELISTED_AMOUNTS[0].div(5));
      const vesting = await tokenLock.vesting(buyer1.address);
      expect(vesting.unlockBegin).to.eq(SALE_START);
      expect(vesting.unlockCliff).to.eq(SALE_START);
      expect(vesting.unlockEnd).to.eq(SALE_START + ONE_DAY);
      expect(vesting.lockedAmounts).to.eq(WHITELISTED_AMOUNTS[0].mul(4).div(5));

      // whitelisted cannot buy again
      await expect(tokenSale.connect(buyer1).buy()).to.be.revertedWith(
        'TokenSale: non-whitelisted purchaser or have already bought'
      );
    });

    it('should revert if buyer has insufficient funds', async () => {
      await tokenIn.connect(buyer1).transfer(buyer2.address, await tokenIn.balanceOf(buyer1.address));
      await expect(tokenSale.connect(buyer1).buy()).to.be.revertedWith('ERC20: transfer amount exceeds balance');
    });

    it('should transfer correct amounts to saleRecipient and timelock depending on remaining sale recipient', async () => {
      // not exceeded, transfer fully to saleRecipient
      await expect(() => tokenSale.connect(buyer1).buy()).to.changeTokenBalances(
        tokenIn,
        [buyer1, saleRecipient],
        [BUYER_USDC_AMOUNT.mul(-1), BUYER_USDC_AMOUNT]
      );

      // will be exceeded, half to saleRecipient, remaining to timelock
      await expect(() => tokenSale.connect(buyer2).buy()).to.changeTokenBalances(
        tokenIn,
        [buyer2, saleRecipient, timelock],
        [BUYER_USDC_AMOUNT.mul(-1), BUYER_USDC_AMOUNT.div(2), BUYER_USDC_AMOUNT.div(2)]
      );

      // have been exceeded, all to timelock
      await expect(() => tokenSale.connect(buyer3).buy()).to.changeTokenBalances(
        tokenIn,
        [buyer3, timelock],
        [BUYER_USDC_AMOUNT.mul(-1), BUYER_USDC_AMOUNT]
      );
    });

    it('should allow new buyers (distinct from the current one) to participate in a subsequent token sale', async () => {
      // set current sale to only buyer1
      await setNextBlockTimeStamp(SALE_START - 10);
      await tokenSale.connect(admin).changeWhiteList([buyer1.address], [BUYER_ARENA_AMOUNT]);
      await setNextBlockTimeStamp(SALE_START);
      await tokenSale.connect(buyer1).buy();
      await setNextBlockTimeStamp(SALE_START + SALE_DURATION + 1);

      // start new sale for buyer2, buyer3 and other
      await tokenSale.connect(admin).setNewSaleStart(SALE_START + 2 * SALE_DURATION);
      // should fail if buyer partipicated in previous sale
      await expect(
        tokenSale.connect(admin).changeWhiteList(WHITELISTED_ACCOUNTS, WHITELISTED_ACCOUNTS)
      ).to.be.revertedWith('TokenSale: buyer has existing vest schedule');

      // set new sale for buyer2, buyer3 and other
      await tokenSale
        .connect(admin)
        .changeWhiteList([buyer2.address, buyer3.address, other.address], WHITELISTED_AMOUNTS);
      await tokenOut.transfer(tokenSale.address, BUYER_ARENA_AMOUNT);

      // buyer1 should fail because sale hasnt started
      await expect(tokenSale.connect(buyer1).buy()).to.be.revertedWith('TokenSale: not started');

      await setNextBlockTimeStamp(SALE_START + 2 * SALE_DURATION);
      // buyer1 should fail because not whitelisted anymore
      await expect(tokenSale.connect(buyer1).buy()).to.be.revertedWith(
        'TokenSale: non-whitelisted purchaser or have already bought'
      );

      // make purchases, expect correct USDC amounts to be transferred to saleRecipient / timelock
      // will exceed remainingSaleRecipient amount, half to saleRecipient, remaining to timelock
      await expect(() => tokenSale.connect(buyer2).buy()).to.changeTokenBalances(
        tokenIn,
        [buyer2, saleRecipient, timelock],
        [BUYER_USDC_AMOUNT.mul(-1), BUYER_USDC_AMOUNT.div(2), BUYER_USDC_AMOUNT.div(2)]
      );

      // remainingSaleRecipient exceeded, all to timelock
      await expect(() => tokenSale.connect(buyer3).buy()).to.changeTokenBalances(
        tokenIn,
        [buyer3, timelock],
        [BUYER_USDC_AMOUNT.mul(-1), BUYER_USDC_AMOUNT]
      );
    });
  });

  after('reset network', async () => {
    await resetNetwork();
  });
});
