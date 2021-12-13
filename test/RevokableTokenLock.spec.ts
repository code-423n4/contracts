import {expect} from 'chai';
import {BigNumber} from 'ethers';
import {ethers, waffle} from 'hardhat';
import {IERC20, RevokableTokenLock} from '../typechain';
import {ZERO_ADDRESS, HOUR} from './shared/Constants';
import {setNextBlockTimeStamp} from './shared/TimeManipulation';

const {loadFixture} = waffle;

let token: IERC20;
let revokableTokenLock: RevokableTokenLock;

describe('RevokableTokenLock', async () => {
  const [owner, revoker, recipient, other] = waffle.provider.getWallets();

  // TODO: maybe create shared fixtures that can be imported by the test files
  async function fixture() {
    const TokenFactory = await ethers.getContractFactory('TestERC20');
    const token = (await TokenFactory.deploy('TEST', 'TEST')) as IERC20;
    const RevokableTokenLockFactory = await ethers.getContractFactory('RevokableTokenLock');
    const revokableTokenLock = (await RevokableTokenLockFactory.deploy(
      token.address,
      revoker.address
    )) as RevokableTokenLock;

    const dt = Math.floor(new Date().getTime() / 1000);
    const begin = ethers.BigNumber.from(dt).add(HOUR);
    const cliff = begin.add(HOUR.mul(5));
    const end = begin.add(HOUR.mul(20));
    await revokableTokenLock.setupVesting(recipient.address, begin, cliff, end);

    return {token, revokableTokenLock};
  }
  beforeEach('deploy fixture', async () => {
    ({token, revokableTokenLock} = await loadFixture(fixture));
  });
  // TODO: maybe do getStorageAt() tests as well
  describe('#setRevoker', async () => {
    it('should revert if caller is not owner', async () => {
      await expect(revokableTokenLock.connect(recipient).setRevoker(other.address)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });
    it('should revert if _revoker is the null address', async () => {
      await expect(revokableTokenLock.setRevoker(ZERO_ADDRESS)).to.be.revertedWith('RevokableTokenLock: null address');
    });
    it('should not revert if caller is owner and _revoker is not the null address', async () => {
      await expect(revokableTokenLock.setRevoker(other.address)).to.not.be.reverted;
    });
    it('should update value of revoker in contract to other address', async () => {
      await revokableTokenLock.setRevoker(other.address);
      const revoker = await revokableTokenLock.revoker();
      expect(revoker).to.equal(other.address);
    });
  });
  describe('#revoke', async () => {
    const amount = ethers.utils.parseEther('20');
    let transferred: BigNumber;
    let remaining: BigNumber;
    let unlockBegin: BigNumber;
    let unlockCliff: BigNumber;
    let unlockEnd: BigNumber;
    let claimedAmounts: BigNumber;
    let lockedAmounts: BigNumber;
    before('Set up data', async () => {
      ({unlockBegin, unlockCliff, unlockEnd} = await revokableTokenLock.vesting(recipient.address));
      transferred = amount.mul(unlockCliff.sub(unlockBegin)).div(unlockEnd.sub(unlockBegin));
      remaining = amount.sub(transferred);
    });
    it('should revert if caller is not owner or revoker', async () => {
      await expect(revokableTokenLock.connect(other).revoke(recipient.address)).to.be.revertedWith(
        'RevokableTokenLock: onlyAuthorizedActors'
      );
    });
    it('should not revert if caller is revoker', async () => {
      await expect(revokableTokenLock.connect(revoker).revoke(recipient.address)).to.not.be.reverted;
    });
    it('should not revert if caller is owner', async () => {
      await expect(revokableTokenLock.revoke(recipient.address)).to.not.be.reverted;
    });
    it('should claim any tokens vested and revoke the rest when revoke is called', async () => {
      // TODO: how to move this into a fixture?
      await token.approve(revokableTokenLock.address, amount);
      await revokableTokenLock.lock(recipient.address, amount);
      await setNextBlockTimeStamp(unlockCliff.toNumber());

      // Call revoke and check token balances
      await expect(() => revokableTokenLock.revoke(recipient.address)).to.changeTokenBalances(
        token,
        [recipient, owner],
        [transferred, remaining]
      );

      // Check contract values
      ({unlockEnd, claimedAmounts, lockedAmounts} = await revokableTokenLock.vesting(recipient.address));
      expect(claimedAmounts).to.equal(transferred);
      expect(lockedAmounts).to.equal(claimedAmounts);
      expect(unlockEnd).to.equal(unlockCliff);
    });
    it('should emit the Revoked event when revoke is called', async () => {
      // TODO: how to move this into a fixture?
      await token.approve(revokableTokenLock.address, amount);
      await revokableTokenLock.lock(recipient.address, amount);
      await setNextBlockTimeStamp(unlockCliff.toNumber());

      // Call revoke
      expect(await revokableTokenLock.revoke(recipient.address))
        .to.emit(revokableTokenLock, 'Revoked')
        .withArgs(recipient.address, remaining);
    });
    // TODO: mock revert on transfers to test transfer fails
  });
});
