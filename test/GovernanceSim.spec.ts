import chai, {expect} from 'chai';
import {waffle} from 'hardhat';
import {ZERO} from '../shared/Constants';
import {getPolygonContracts} from '../shared/Forking';
import {createAndExecuteProposal} from '../shared/Governance';

const {solidity} = waffle;
chai.use(solidity);

// can simulate poylgon mainnet governance proposals here, enable fork object in hardhat.config.ts
describe.skip('Governance - Polygon mainnet proposal simulations', async () => {
  const [user] = waffle.provider.getWallets();
  let deployment = getPolygonContracts(user);
  const {governorV1, governor, arenaToken, timeLock} = deployment;

  it('should allow governance to move tokens in timeLock contract', async () => {
    const treasuryAmount = await arenaToken.balanceOf(timeLock.address);
    expect(treasuryAmount).to.be.gt(ZERO, `Treasury currently does not have any ARENA tokens`);

    let targets: string[] = [arenaToken.address];
    let values: string[] = [`0`];
    let calldatas: string[] = [arenaToken.interface.encodeFunctionData('transfer', [user.address, treasuryAmount])];
    await createAndExecuteProposal({targets, values, calldatas, user, ...deployment});

    expect(await arenaToken.balanceOf(timeLock.address)).to.eq(ZERO);
  });

  it('should migrate to new governor', async () => {
    // set to current existing governor for proposal creation
    deployment.governor = governorV1;
    const PROPOSER_ROLE = '0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1';
    let targets: string[] = [timeLock.address, timeLock.address];
    let values: string[] = [`0`, `0`];
    let calldatas: string[] = [
      timeLock.interface.encodeFunctionData('grantRole', [PROPOSER_ROLE, governor.address]),
      timeLock.interface.encodeFunctionData('revokeRole', [PROPOSER_ROLE, governorV1.address]),
    ];
    await createAndExecuteProposal({targets, values, calldatas, user, ...deployment});

    const treasuryAmount = await arenaToken.balanceOf(timeLock.address);
    targets = [arenaToken.address];
    values = [`0`];
    calldatas = [arenaToken.interface.encodeFunctionData('transfer', [user.address, treasuryAmount])];

    // attempt to move funds through old governor, will fail
    try {
      await createAndExecuteProposal({targets, values, calldatas, user, ...deployment});
    } catch (e) {
      console.log(e);
    }

    // attempt to move funds through new governor, should be successful
    deployment.governor = governor;
    await createAndExecuteProposal({targets, values, calldatas, user, ...deployment});
    expect(await arenaToken.balanceOf(timeLock.address)).to.eq(ZERO);
  });
});
