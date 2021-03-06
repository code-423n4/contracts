import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {getPolygonContracts, getForkParams} from '../../shared/Forking';
import {createAndExecuteProposal} from '../../shared/Governance';

export async function simulateExistingProposal(proposalId: string, hre: HardhatRuntimeEnvironment) {
  const [user] = await hre.ethers.getSigners();
  const deployment = getPolygonContracts(user);

  // attempt mainnet forking
  await hre.network.provider.request({
    method: 'hardhat_reset',
    params: [getForkParams()],
  });

  const proposalActions = await deployment.governor.getActions(proposalId);
  let valuesArray = proposalActions[1].map((value) => value.toString());
  console.log(`proposal targets: ${proposalActions.targets}`);
  console.log(`proposal values: ${valuesArray}`);
  console.log(`proposal calldatas: ${proposalActions.calldatas}`);
  console.log(`cloning proposal...`);
  await createAndExecuteProposal({
    user,
    targets: proposalActions.targets,
    values: valuesArray,
    calldatas: proposalActions.calldatas,
    ...deployment,
  });
}
