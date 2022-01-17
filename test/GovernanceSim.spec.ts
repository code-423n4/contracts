import chai, {expect} from 'chai';
import {waffle} from 'hardhat';
import {ZERO} from './shared/Constants';
import {getPolygonContracts} from './shared/Forking';
import {createAndExecuteProposal} from './shared/Governance';

const {solidity} = waffle;
chai.use(solidity);

// can simulate poylgon mainnet governance proposals here, enable fork object in hardhat.config.ts
describe.skip('Governance - Polygon mainnet proposal simulations', async () => {
  const [user] = waffle.provider.getWallets();
  const deployment = getPolygonContracts(user);
  const {arenaToken, timeLock} = deployment;

  it('should allow governance to move tokens in timeLock contract', async () => {
    const treasuryAmount = await arenaToken.balanceOf(timeLock.address);
    expect(treasuryAmount).to.be.gt(ZERO, `Treasury currently does not have any ARENA tokens`);

    let targets: string[] = [arenaToken.address];
    let values: string[] = [`0`];
    let calldatas: string[] = [arenaToken.interface.encodeFunctionData('transfer', [user.address, treasuryAmount])];
    await createAndExecuteProposal({targets, values, calldatas, user, ...deployment});

    expect(await arenaToken.balanceOf(timeLock.address)).to.eq(ZERO);
  });
});
