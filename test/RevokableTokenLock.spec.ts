import {expect} from 'chai';
import {ethers, waffle} from 'hardhat';
import {IERC20, RevokableTokenLock} from '../typechain';
import {ZERO_ADDRESS, HOUR} from './shared/Constants';
import {setNextBlockTimestamp} from './shared/Functions';

const {loadFixture} = waffle;

let token: IERC20;
let revokableTokenLock: RevokableTokenLock;

describe('TokenLock', async () => {
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

    const dt = new Date();
    const begin = ethers.BigNumber.from(dt.getTime()).add(HOUR);
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
      // Set up data
      const before = ethers.utils.parseEther('100000000');
      const amount = ethers.utils.parseEther('20');
      let {unlockBegin, unlockCliff, unlockEnd, claimedAmounts, lockedAmounts} = await revokableTokenLock.vesting(
        recipient.address
      );
      await token.approve(revokableTokenLock.address, amount);
      await revokableTokenLock.lock(recipient.address, amount);
      await setNextBlockTimestamp(unlockCliff.toNumber());

      // Call revoke
      await revokableTokenLock.revoke(recipient.address);

      // Check token balances
      const transferred = amount.mul(unlockCliff.sub(unlockBegin)).div(unlockEnd.sub(unlockBegin));
      expect(await token.balanceOf(recipient.address)).to.equal(transferred);
      expect(await token.balanceOf(owner.address)).to.equal(before.sub(transferred));

      // Check contract values
      ({unlockEnd, claimedAmounts, lockedAmounts} = await revokableTokenLock.vesting(recipient.address));
      expect(claimedAmounts).to.equal(transferred);
      expect(lockedAmounts).to.equal(claimedAmounts);
      expect(unlockEnd).to.equal(unlockCliff);
    });
    it('should emit the Revoked event when revoke is called', async () => {
      // Set up data
      const amount = ethers.utils.parseEther('20');
      const {unlockBegin, unlockCliff, unlockEnd} = await revokableTokenLock.vesting(recipient.address);
      const transferred = amount.mul(unlockCliff.sub(unlockBegin)).div(unlockEnd.sub(unlockBegin));
      await token.approve(revokableTokenLock.address, amount);
      await revokableTokenLock.lock(recipient.address, amount);
      await setNextBlockTimestamp(unlockCliff.toNumber());

      // Call revoke
      expect(await revokableTokenLock.revoke(recipient.address))
        .to.emit(revokableTokenLock, 'Revoked')
        .withArgs(recipient.address, amount.sub(transferred));
    });
  });
});
