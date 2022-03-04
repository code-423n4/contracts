import {expect} from 'chai';
import {BigNumber} from 'ethers';
import {ethers, waffle} from 'hardhat';
import {IERC20, RevokableTokenLock} from '../typechain';
import {ZERO_ADDRESS, ONE_HOUR} from '../shared/Constants';
import {setNextBlockTimeStamp, mineBlockAt} from '../shared/TimeManipulation';

const {loadFixture} = waffle;

let token: IERC20;
let revokableTokenLock: RevokableTokenLock;

describe('RevokableTokenLock', async () => {
  const [owner, revoker, recipient, other] = waffle.provider.getWallets();
  const amount = ethers.utils.parseEther('20');

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
    const begin = dt + ONE_HOUR;
    const cliff = dt + 5 * ONE_HOUR;
    const end = dt + 20 * ONE_HOUR;
    await revokableTokenLock.setupVesting(recipient.address, begin, cliff, end);
    await token.approve(revokableTokenLock.address, amount);
    await revokableTokenLock.lock(recipient.address, amount);

    return {token, revokableTokenLock};
  }
  beforeEach('deploy fixture', async () => {
    ({token, revokableTokenLock} = await loadFixture(fixture));
  });
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
    let transferred: BigNumber;
    let remaining: BigNumber;
    let unlockBegin: BigNumber;
    let unlockCliff: BigNumber;
    let unlockEnd: BigNumber;
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
    it('should claim none and revoke all tokens to owner if revoke is called before unlockCliff', async () => {
      await expect(() => revokableTokenLock.revoke(recipient.address)).to.changeTokenBalances(
        token,
        [recipient, owner],
        [0, amount]
      );
    });
    it('should claim any tokens vested and revoke the remaining to owner when revoke is called after unlockCliff but before unlockEnd', async () => {
      await setNextBlockTimeStamp(unlockCliff.toNumber());
      await expect(() => revokableTokenLock.revoke(recipient.address)).to.changeTokenBalances(
        token,
        [recipient, owner],
        [transferred, remaining]
      );
    });
    it('should claim all tokens and revoke none to owner when revoke is called after unlockEnd', async () => {
      await setNextBlockTimeStamp(unlockEnd.toNumber());
      await expect(() => revokableTokenLock.revoke(recipient.address)).to.changeTokenBalances(
        token,
        [recipient, owner],
        [amount, 0]
      );
    });
    it('should return claimable balance of 0 after some time has passed since revoke was called.', async () => {
      const unlock = unlockCliff.toNumber();
      await setNextBlockTimeStamp(unlock);
      await revokableTokenLock.revoke(recipient.address);

      // Set next block timestamp to 2 hour after revoke was called and mine a block.
      await mineBlockAt(unlock + 2 * ONE_HOUR);
      const bal = await revokableTokenLock.claimableBalance(recipient.address);
      expect(bal).to.equal(0);
    });
    it('should emit the Revoked event when revoke is called', async () => {
      await setNextBlockTimeStamp(unlockCliff.toNumber());
      expect(await revokableTokenLock.revoke(recipient.address))
        .to.emit(revokableTokenLock, 'Revoked')
        .withArgs(recipient.address, remaining);
    });
  });
});
