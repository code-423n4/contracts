import {expect} from 'chai';
import chai from 'chai';
import hre, {ethers, waffle} from 'hardhat';
import {IERC20, TokenLock} from '../typechain';
import {MAX_UINT, ONE, ONE_DAY, ONE_YEAR, ONE_18, ZERO, ZERO_ADDRESS} from './shared/Constants';
import {mineBlockAt, resetNetwork, setNextBlockTimeStamp} from './shared/TimeManipulation';

const {solidity, loadFixture} = waffle;
chai.use(solidity);

let token: IERC20;
let tokenLock: TokenLock;
let unlockBegin: number;
let unlockCliff: number;
let unlockEnd: number;

describe('TokenLock', async () => {
  const [user, admin, tokenSale, other] = waffle.provider.getWallets();

  // TODO: maybe create shared fixtures that can be imported by the test files
  async function fixture() {
    const TokenFactory = await ethers.getContractFactory('TestERC20');
    const token = (await TokenFactory.connect(admin).deploy('TEST', 'TEST')) as IERC20;
    const TokenLockFactory = await ethers.getContractFactory('TokenLock');
    const tokenLock = (await TokenLockFactory.connect(admin).deploy(token.address)) as TokenLock;
    return {token, tokenLock};
  }
  beforeEach('deploy fixture, update time', async () => {
    ({token, tokenLock} = await loadFixture(fixture));
    // hardhat implicitly uses now as block time, so need to make tests relative to now
    unlockBegin = Math.floor(Date.now() / 1000) + ONE_DAY;
    unlockCliff = unlockBegin; // in our case, there isn't a cliff
    unlockEnd = unlockBegin + 4 * ONE_YEAR;
  });

  describe('#setTokenSale', async () => {
    it('should revert if caller is not owner', async () => {
      await expect(tokenLock.connect(user).setTokenSale(tokenSale.address)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
      await expect(tokenLock.connect(other).setTokenSale(tokenSale.address)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('should revert if owner tries to set null address', async () => {
      await expect(tokenLock.connect(admin).setTokenSale(ZERO_ADDRESS)).to.be.revertedWith('TokenLock: Null address');
    });

    it('should set tokenSale address', async () => {
      await tokenLock.connect(admin).setTokenSale(tokenSale.address);
      expect(await tokenLock.tokenSale()).to.be.eq(tokenSale.address);

      await tokenLock.connect(admin).setTokenSale(user.address);
      expect(await tokenLock.tokenSale()).to.be.eq(user.address);
    });
  });

  describe('#setupVesting', async () => {
    it('should revert for non-authorized actors', async () => {
      await expect(
        tokenLock.connect(user).setupVesting(user.address, unlockBegin, unlockCliff, unlockEnd)
      ).to.be.revertedWith('TokenLock: Only owner/ claims/ sale contract can call');

      await expect(
        tokenLock.connect(other).setupVesting(other.address, unlockBegin, unlockCliff, unlockEnd)
      ).to.be.revertedWith('TokenLock: Only owner/ claims/ sale contract can call');
    });

    it('should setup vesting for authorized actors', async () => {
      await tokenLock.connect(admin).setupVesting(admin.address, unlockBegin, unlockCliff, unlockEnd);
      let vest = await tokenLock.vesting(admin.address);
      expect(vest.unlockBegin).to.be.eq(unlockBegin);
      expect(vest.unlockCliff).to.be.eq(unlockCliff);
      expect(vest.unlockEnd).to.be.eq(unlockEnd);

      await tokenLock.connect(admin).setTokenSale(tokenSale.address);
      await tokenLock.connect(tokenSale).setupVesting(user.address, unlockBegin, unlockCliff, unlockEnd);
      vest = await tokenLock.vesting(user.address);
      expect(vest.unlockBegin).to.be.eq(unlockBegin);
      expect(vest.unlockCliff).to.be.eq(unlockCliff);
      expect(vest.unlockEnd).to.be.eq(unlockEnd);
    });

    it('should revert if begin > cliff', async () => {
      await expect(tokenLock.connect(admin).setupVesting(user.address, 1000, 999, 2000)).to.be.revertedWith(
        'TokenLock: Unlock cliff must not be before unlock begin'
      );

      await expect(
        tokenLock.connect(admin).setupVesting(user.address, unlockBegin, unlockBegin - 1, unlockEnd)
      ).to.be.revertedWith('TokenLock: Unlock cliff must not be before unlock begin');
    });

    it('should revert if cliff > end', async () => {
      await expect(tokenLock.connect(admin).setupVesting(user.address, 1000, 1000, 999)).to.be.revertedWith(
        'TokenLock: Unlock end must not be before unlock cliff'
      );

      await expect(
        tokenLock.connect(admin).setupVesting(user.address, unlockBegin, unlockCliff, unlockCliff - 1)
      ).to.be.revertedWith('TokenLock: Unlock end must not be before unlock cliff');
    });
  });

  describe('#lock', async () => {
    beforeEach('set vesting schedule for user', async () => {
      await tokenLock.connect(admin).setupVesting(user.address, unlockBegin, unlockCliff, unlockEnd);
    });

    it('should revert locks if unlock period has completed', async () => {
      await setNextBlockTimeStamp(unlockEnd);
      await expect(tokenLock.connect(admin).lock(user.address, ONE)).to.be.revertedWith(
        'TokenLock: Unlock period already complete'
      );
    });

    it('should revert lock if vesting has not been setup for recipient', async () => {
      await expect(tokenLock.connect(admin).lock(other.address, ONE)).to.be.revertedWith(
        'TokenLock: Unlock period already complete'
      );
    });

    it('should revert if lock() is called without sufficient balance or allowance', async () => {
      await expect(tokenLock.connect(user).lock(user.address, ONE)).to.be.revertedWith(
        'ERC20: transfer amount exceeds balance'
      );
      await expect(tokenLock.connect(admin).lock(user.address, ONE)).to.be.revertedWith(
        'ERC20: transfer amount exceeds allowance'
      );
    });

    describe('successful lock', async () => {
      beforeEach('admin gives tokenLock token allowance', async () => {
        await token.connect(admin).approve(tokenLock.address, MAX_UINT);
      });

      it('should emit Locked event', async () => {
        expect(await tokenLock.connect(admin).lock(user.address, ONE_18))
          .to.emit(tokenLock, 'Locked')
          .withArgs(admin.address, user.address, ONE_18);
      });

      it('should have transferred tokens from caller to contract', async () => {
        await expect(() => tokenLock.connect(admin).lock(user.address, ONE_18)).to.changeTokenBalances(
          token,
          [admin, tokenLock],
          [ONE_18.mul(-1), ONE_18]
        );
      });

      it('should have successfully locked user balance before UnlockBegin', async () => {
        await setNextBlockTimeStamp(unlockBegin - 1);
        // verify zero locked amount prior to lock
        expect((await tokenLock.vesting(user.address)).lockedAmounts).to.be.eq(ZERO);
        await tokenLock.connect(admin).lock(user.address, ONE_18);
        expect((await tokenLock.vesting(user.address)).lockedAmounts).to.be.eq(ONE_18);
      });

      it('should have successfully locked user balance before UnlockEnd', async () => {
        await setNextBlockTimeStamp(unlockEnd - 1);
        // verify zero locked amount prior to lock
        expect((await tokenLock.vesting(user.address)).lockedAmounts).to.be.eq(ZERO);
        await tokenLock.connect(admin).lock(user.address, ONE_18);
        expect((await tokenLock.vesting(user.address)).lockedAmounts).to.be.eq(ONE_18);
      });
    });
  });

  describe('#claimableBalance, #claim', async () => {
    beforeEach('reset time, setup vesting schedule and lock some tokens', async () => {
      await setNextBlockTimeStamp(unlockBegin - 100);
      await tokenLock.connect(admin).setupVesting(user.address, unlockBegin, unlockCliff, unlockEnd);
      await token.connect(admin).approve(tokenLock.address, ONE_18);
      await tokenLock.connect(admin).lock(user.address, ONE_18);
    });

    it('should return 0 claimable balance for user without vesting schedule setup', async () => {
      expect(await tokenLock.claimableBalance(other.address)).to.be.eq(ZERO);
    });

    it('should have claimed 0 tokens if timestamp < cliff', async () => {
      await expect(() => tokenLock.connect(user).claim(user.address, ONE)).to.changeTokenBalance(token, user, ZERO);
    });

    it('should allow a proportional amount to be claimed after the cliff', async () => {
      let claimTime = unlockEnd - ONE_YEAR;
      await mineBlockAt(claimTime);
      const unlockAmount = ONE_18.mul(claimTime - unlockBegin).div(unlockEnd - unlockBegin);
      expect(await tokenLock.claimableBalance(user.address)).to.be.eq(unlockAmount);
      const balanceBefore = await token.balanceOf(user.address);
      await expect(tokenLock.connect(user).claim(user.address, unlockAmount))
        .to.emit(tokenLock, 'Claimed')
        .withArgs(user.address, user.address, unlockAmount);
      expect(await token.balanceOf(user.address)).to.be.eq(balanceBefore.add(unlockAmount));
    });

    it('should automatically limit claims to the maximum allowed', async () => {
      let claimTime = unlockEnd - ONE_YEAR;
      await setNextBlockTimeStamp(claimTime);
      const unlockAmount = ONE_18.mul(claimTime - unlockBegin).div(unlockEnd - unlockBegin);
      await expect(() => tokenLock.connect(user).claim(user.address, MAX_UINT)).to.changeTokenBalance(
        token,
        user,
        unlockAmount
      );
    });

    it('should return 0 claimable balance immediately after claiming', async () => {
      let claimTime = unlockEnd - ONE_YEAR;
      await setNextBlockTimeStamp(claimTime);
      await tokenLock.connect(user).claim(user.address, MAX_UINT);
      expect(await tokenLock.claimableBalance(user.address)).to.be.eq(ZERO);
    });

    it('should have non-zero claimable balance as remaining tokens continue to be vested', async () => {
      let claimTime = unlockEnd - ONE_YEAR;
      await setNextBlockTimeStamp(claimTime);
      await tokenLock.connect(user).claim(user.address, MAX_UINT);
      // 1 day after claim
      await mineBlockAt(claimTime + ONE_DAY);
      expect(await tokenLock.claimableBalance(user.address)).to.be.gt(ZERO);
    });

    it('should have all tokens claimable after tokens are fully unlocked', async () => {
      await mineBlockAt(unlockEnd);
      expect(await tokenLock.claimableBalance(user.address)).to.equal(ONE_18);
      await expect(() => tokenLock.connect(user).claim(user.address, ONE_18)).to.changeTokenBalance(
        token,
        user,
        ONE_18
      );
      expect(await tokenLock.claimableBalance(user.address)).to.be.eq(ZERO);
      // 1 year after claim
      await mineBlockAt(unlockEnd + ONE_YEAR);
      expect(await tokenLock.claimableBalance(user.address)).to.be.eq(ZERO);
      // should have no change in token balance if user attempts to claim
      await expect(() => tokenLock.connect(user).claim(user.address, MAX_UINT)).to.changeTokenBalance(
        token,
        user,
        ZERO
      );
    });
  });

  after('reset network', async () => {
    await resetNetwork();
  });
});
