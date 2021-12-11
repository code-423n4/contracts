import {expect} from 'chai';
import chai from 'chai';
import hre, {ethers, waffle} from 'hardhat';
import {IERC20, TokenLock, TokenSale} from '../typechain';
import {ZERO_ADDRESS, BN, MAX_UINT} from './shared/Constants';
import {BigNumber} from 'ethers';

const {solidity, loadFixture} = waffle;
chai.use(solidity);

let tokenIn: IERC20;
let tokenOut: IERC20;
let tokenLock: TokenLock;
let tokenSale: TokenSale;
const SALE_START = Math.floor(new Date(`2021-12-24T12:00:00.000Z`).getTime() / 1000);
const ONE_DAY = 24 * 60 * 60;
const ARENA_DECIMALS = 18;
const ONE_18 = BigNumber.from(`10`).pow(`18`);
const ONE_ARENA = ethers.utils.parseUnits(`1`, ARENA_DECIMALS);
// Polygon USDC only has 6 decimals
const TOKEN_IN_DECIMALS = 6;
const ONE_USDC = ethers.utils.parseUnits(`1`, TOKEN_IN_DECIMALS);
// 0.05 USDC per 1 ARENA (0.05e6 * 1e18 / 1*1e18)
const TOKEN_OUT_PRICE = ethers.utils.parseUnits(`0.05`, TOKEN_IN_DECIMALS).mul(ONE_18).div(ONE_ARENA);
const SALE_DURATION = 7 * ONE_DAY;
const WHITELISTED_ACCOUNTS: string[] = [];
const WHITELISTED_AMOUNTS = [BN.from(`1000`).mul(ONE_ARENA), BN.from(`500`).mul(ONE_ARENA)];

describe('TokenSale', async () => {
  const [user, admin, saleRecipient, buyer1, buyer2, other] = waffle.provider.getWallets();
  WHITELISTED_ACCOUNTS.push(buyer1.address, buyer2.address);

  // TODO: maybe create shared fixtures that can be imported by the test files
  async function fixture() {
    let TokenFactory = await ethers.getContractFactory('TestERC20');
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
    await tokenLock.setTokenSale(tokenSale.address);
    await tokenSale.changeWhiteList(WHITELISTED_ACCOUNTS, WHITELISTED_AMOUNTS);

    // distribute tokens and set approvals
    await tokenOut.connect(admin).transfer(
      tokenSale.address,
      WHITELISTED_AMOUNTS.reduce((acc, amount) => acc.add(amount), BN.from(`0`))
    );
    for (const buyer of [buyer1, buyer2]) {
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

  describe('#sweep', async () => {
    let otherToken: IERC20;
    beforeEach('distribute other token', async () => {
      let TokenFactory = await ethers.getContractFactory('TestERC20');
      otherToken = (await TokenFactory.connect(admin).deploy('OTHER', 'OTHER')) as IERC20;
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
      await hre.network.provider.send('evm_setNextBlockTimestamp', [SALE_START]);
    });

    it('should revert if trying to buy before sale', async () => {
      await hre.network.provider.send('evm_setNextBlockTimestamp', [SALE_START - 1]);
      await expect(tokenSale.connect(buyer1).buy(`1`)).to.be.revertedWith('TokenSale: not started');
    });

    it('should revert if trying to buy after sale duration', async () => {
      await hre.network.provider.send('evm_setNextBlockTimestamp', [SALE_START + SALE_DURATION + 1]);
      await expect(tokenSale.connect(buyer1).buy(`1`)).to.be.revertedWith('TokenSale: already ended');
    });

    it('should revert if non-whitelisted tries to buy', async () => {
      await expect(tokenSale.connect(user).buy(`1`)).to.be.revertedWith('TokenSale: cannot buy more than allowed');
      await expect(tokenSale.connect(other).buy(`1`)).to.be.revertedWith('TokenSale: cannot buy more than allowed');
    });

    it('should revert if whitelisted tries to buy more than allotted', async () => {
      await expect(tokenSale.connect(buyer1).buy(WHITELISTED_AMOUNTS[0].add(`1`))).to.be.revertedWith(
        'TokenSale: cannot buy more than allowed'
      );
      await expect(tokenSale.connect(buyer2).buy(WHITELISTED_AMOUNTS[1].add(`1`))).to.be.revertedWith(
        'TokenSale: cannot buy more than allowed'
      );
    });

    it('should let whitelisted buy full amount', async () => {
      let preBuyerTokenInBalance = await tokenIn.balanceOf(buyer1.address);
      let preSellerTokenInBalance = await tokenIn.balanceOf(saleRecipient.address);
      await tokenSale.connect(buyer1).buy(WHITELISTED_AMOUNTS[0]);
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

      // whitelisted cannot buy more
      await expect(tokenSale.connect(buyer1).buy(WHITELISTED_AMOUNTS[0].add(`1`))).to.be.revertedWith(
        'TokenSale: cannot buy more than allowed'
      );
    });

    it('should let whitelisted buy partial amounts several times', async () => {
      let preBuyerTokenInBalance = await tokenIn.balanceOf(buyer1.address);
      let preSellerTokenInBalance = await tokenIn.balanceOf(saleRecipient.address);
      await tokenSale.connect(buyer1).buy(WHITELISTED_AMOUNTS[0].div(4));
      await hre.network.provider.send('evm_setNextBlockTimestamp', [SALE_START + ONE_DAY]);
      await tokenSale.connect(buyer1).buy(WHITELISTED_AMOUNTS[0].div(4));
      await hre.network.provider.send('evm_setNextBlockTimestamp', [SALE_START + 2 * ONE_DAY]);
      await tokenSale.connect(buyer1).buy(WHITELISTED_AMOUNTS[0].div(4));
      await hre.network.provider.send('evm_setNextBlockTimestamp', [SALE_START + 3 * ONE_DAY]);
      await tokenSale.connect(buyer1).buy(WHITELISTED_AMOUNTS[0].div(4));
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
      let expectedVestingStart = SALE_START + 3 * ONE_DAY;
      expect(vesting.unlockBegin).to.eq(expectedVestingStart);
      expect(vesting.unlockCliff).to.eq(expectedVestingStart);
      expect(vesting.unlockEnd).to.eq(expectedVestingStart + ONE_DAY);
      expect(vesting.lockedAmounts).to.eq(WHITELISTED_AMOUNTS[0].mul(4).div(5));

      // whitelisted cannot buy more
      await expect(tokenSale.connect(buyer1).buy(WHITELISTED_AMOUNTS[0].add(`1`))).to.be.revertedWith(
        'TokenSale: cannot buy more than allowed'
      );
    });
  });
});
