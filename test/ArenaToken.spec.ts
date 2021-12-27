import chai, {expect} from 'chai';
import {BigNumber as BN} from 'ethers';
import * as fs from 'fs';
import {ethers, waffle} from 'hardhat';
import * as path from 'path';
import {ArenaToken, RevokableTokenLock} from '../typechain';
import {impersonateAccountWithFunds, stopImpersonateAccount} from './shared/AccountManipulation';
import {ONE_18, ONE_DAY, ONE_YEAR} from './shared/Constants';
import {resetNetwork, setNextBlockTimeStamp} from './shared/TimeManipulation';
import {MerkleDistributorInfo} from '../src/parse-balance-map';

const {solidity, loadFixture} = waffle;
chai.use(solidity);

let tokenLock: RevokableTokenLock;
let token: ArenaToken;
const CLAIMABLE_PROPORTION = 2000;
const VEST_DURATION = 4 * ONE_YEAR;
const NOW = Math.floor(Date.now() / 1000);
const CLAIM_END_TIME = NOW + ONE_YEAR;

const airdropJson = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, `./fixtures/testAirdrop.json`), `utf8`)
) as MerkleDistributorInfo;
const {claims} = airdropJson;
const claimers = Object.keys(claims);
const AIRDROP_SUPPLY = BN.from(airdropJson.tokenTotal);
const FREE_SUPPLY = BN.from(1000_000_000).mul(ONE_18).sub(AIRDROP_SUPPLY);

describe('TokenSale', async () => {
  const [user, admin, other] = waffle.provider.getWallets();

  async function fixture() {
    let ArenaTokenFactory = await ethers.getContractFactory('ArenaToken');
    let token = (await ArenaTokenFactory.connect(admin).deploy(
      FREE_SUPPLY,
      AIRDROP_SUPPLY,
      CLAIMABLE_PROPORTION,
      CLAIM_END_TIME,
      VEST_DURATION
    )) as ArenaToken;

    let TokenLockFactory = await ethers.getContractFactory('RevokableTokenLock');
    let tokenLock = (await TokenLockFactory.connect(admin).deploy(token.address, admin.address)) as RevokableTokenLock;

    await token.setTokenLock(tokenLock.address);
    return {token, tokenLock};
  }

  beforeEach('deploy fixture', async () => {
    ({token, tokenLock} = await loadFixture(fixture));
  });

  describe('#setTokenLock', async () => {
    it('should revert if caller is not owner', async () => {
      await expect(token.connect(user).setTokenLock(tokenLock.address)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('should allow owner to set', async () => {
      await token.connect(admin).setTokenLock(tokenLock.address);
      expect(await token.tokenLock()).to.eq(tokenLock.address);
    });
  });

  describe('#setMerkleRoot', async () => {
    it('should revert if caller is not owner', async () => {
      await expect(token.connect(user).setTokenLock(tokenLock.address)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('should allow owner to set exactly once', async () => {
      await token.connect(admin).setMerkleRoot(airdropJson.merkleRoot);
      expect(await token.merkleRoot()).to.eq(airdropJson.merkleRoot);
      await expect(
        token.connect(admin).setMerkleRoot(`0xdeadbeef42c0ffeedeadbeef42c0ffeedeadbeef42c0ffeedeadbeef42c0ffee`)
      ).to.be.revertedWith('ArenaToken: Merkle root already set');
    });
  });

  describe('#mint', async () => {
    it('should revert if caller is not owner', async () => {
      await expect(token.connect(user).mint(user.address, ONE_18)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('should allow owner to mint new tokens', async () => {
      await token.connect(admin).mint(user.address, ONE_18);
      expect(await token.balanceOf(user.address)).to.eq(ONE_18);
    });
  });

  describe('#sweep', async () => {
    it('should revert if trying to sweep before claim period ended', async () => {
      await expect(token.connect(admin).sweep(other.address)).to.be.revertedWith(
        'ArenaToken: Claim period not yet ended'
      );
    });

    it('should revert if caller is not owner', async () => {
      await setNextBlockTimeStamp(CLAIM_END_TIME - 1);
      await expect(token.connect(user).sweep(other.address)).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('should allow owner to sweep after claim period ended', async () => {
      await setNextBlockTimeStamp(CLAIM_END_TIME);
      await expect(() => token.connect(admin).sweep(other.address)).to.changeTokenBalances(
        token,
        [token, other],
        [AIRDROP_SUPPLY.mul(-1), AIRDROP_SUPPLY]
      );
    });
  });

  describe('#claimTokens', async () => {
    describe('when no merkle root is set', async () => {
      it('should revert when trying to claim', async () => {
        const claim = claims[claimers[0]];
        const claimerSigner = await impersonateAccountWithFunds(claimers[0]);
        await expect(token.connect(claimerSigner).claimTokens(claim.amount, claim.proof)).to.be.revertedWith(
          'ArenaToken: Valid proof required.'
        );
      });
    });

    describe('when merkle root is set', async () => {
      beforeEach('set merkle root', async () => {
        await token.setMerkleRoot(airdropJson.merkleRoot);
      });

      it('should revert when claimer not in merkle tree', async () => {
        const claim = claims[claimers[0]];
        await expect(token.connect(user).claimTokens(claim.amount, claim.proof)).to.be.revertedWith(
          'ArenaToken: Valid proof required.'
        );
      });

      it('should let everyone in the merkle tree claim exactly once', async () => {
        for (let i = 0; i < claimers.length; i++) {
          const claimer = claimers[i];
          const claim = claims[claimer];
          const claimerSigner = await impersonateAccountWithFunds(claimer);
          const claimAmount = BN.from(claim.amount);
          const distributedAmount = claimAmount.mul(CLAIMABLE_PROPORTION).div(1e4);

          const nextBlock = NOW + ONE_DAY + i * 13;
          await setNextBlockTimeStamp(nextBlock);
          await expect(() =>
            token.connect(claimerSigner).claimTokens(claim.amount, claim.proof)
          ).to.changeTokenBalances(
            token,
            [claimerSigner, tokenLock, token],
            [distributedAmount, claimAmount.sub(distributedAmount), claimAmount.mul(-1)]
          );

          const vesting = await tokenLock.vesting(claimer);
          expect(vesting.unlockBegin).to.eq(nextBlock);
          expect(vesting.unlockCliff).to.eq(nextBlock);
          expect(vesting.unlockEnd).to.eq(nextBlock + VEST_DURATION);
          expect(vesting.lockedAmounts).to.eq(claimAmount.sub(distributedAmount));

          await expect(token.connect(claimerSigner).claimTokens(claim.amount, claim.proof)).to.be.revertedWith(
            'ArenaToken: Tokens already claimed.'
          );
          expect(await token.isClaimed(claim.index)).to.be.true;
          await stopImpersonateAccount(claimer);
        }

        // all airdrops distributed => zero balance left
        expect(await token.balanceOf(token.address)).to.be.eq(`0`);
      });
    });
  });

  after('reset network', async () => {
    await resetNetwork();
  });
});
