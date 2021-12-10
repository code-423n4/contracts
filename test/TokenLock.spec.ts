import {expect} from 'chai';
import chai from 'chai';
import {ethers, waffle} from 'hardhat';
import {IERC20, TokenLock} from '../typechain';
import {ZERO_ADDRESS} from './shared/Constants';

const {solidity, loadFixture} = waffle;
chai.use(solidity);

let token: IERC20;
let tokenLock: TokenLock;

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
  beforeEach('deploy fixture', async () => {
    ({token, tokenLock} = await loadFixture(fixture));
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
});
