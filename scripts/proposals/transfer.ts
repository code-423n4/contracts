import {ethers, Signer} from 'ethers';
import fs from 'fs';
import path from 'path';
import _ from 'lodash';
import {ArenaGovernor__factory, ArenaToken__factory} from '../../typechain';
import {allConfigs} from '../deploy/config';
import {HardhatRuntimeEnvironment} from 'hardhat/types';

let transferInterface = new ethers.utils.Interface([`function transfer(address to, uint256 amount)`]);
const getContracts = (signer: Signer, config: typeof allConfigs[0]) => {
  const deploymentFilePath = path.join(`deployments`, config.EXPORT_FILENAME);
  if (!fs.existsSync(deploymentFilePath)) throw new Error(`File '${path.resolve(deploymentFilePath)}' does not exist.`);

  const contents = fs.readFileSync(deploymentFilePath, `utf8`);
  let governorAddress;
  let arenaAddress;
  try {
    ({governor: governorAddress, token: arenaAddress} = JSON.parse(contents));
  } catch (error) {
    throw new Error(`Cannot parse deployment config at '${path.resolve(deploymentFilePath)}'.`);
  }
  if (!governorAddress) throw new Error(`Deployment file did not include governor address '${deploymentFilePath}'.`);
  if (!arenaAddress) throw new Error(`Deployment file did not include arena token address '${deploymentFilePath}'.`);

  return {
    governor: ArenaGovernor__factory.connect(governorAddress, signer),
    arenaToken: ArenaToken__factory.connect(arenaAddress, signer),
  };
};

type BatchTransfer = {
  token: string;
  transfers: Array<{to: string; amount: string}>;
};
const getTransfers = (transferPath: string) => {
  if (!fs.existsSync(transferPath)) throw new Error(`File '${path.resolve(transferPath)}' does not exist.`);

  const contents = fs.readFileSync(transferPath, `utf8`);
  let json;
  try {
    json = JSON.parse(contents);
  } catch (error) {
    throw new Error(`Cannot parse transfer JSON file at '${path.resolve(transferPath)}'.`);
  }
  if (!Array.isArray(json)) throw new Error(`Transfer file must be an array of batch transfers`);

  return json as BatchTransfer[];
};

const toProposalPayload = (batchTransfer: BatchTransfer) => {
  return batchTransfer.transfers.map((transfer) => ({
    target: batchTransfer.token,
    calldata: transferInterface.encodeFunctionData(`transfer`, [transfer.to, transfer.amount]),
    value: `0`,
  }));
};

export async function transferProposal(json: string, hre: HardhatRuntimeEnvironment) {
  const networkId = hre.network.config.chainId as number;
  const [proposer] = await hre.ethers.getSigners();
  const proposerAddress = await proposer.getAddress();
  let config = allConfigs[networkId];
  if (!config) throw new Error(`Unknown network ${hre.network.name} (${networkId})`);

  const batchTransfers = _.flattenDeep(getTransfers(json).map(toProposalPayload));
  const targets = batchTransfers.map(({target}) => target);
  const values = batchTransfers.map(({value}) => value);
  const calldatas = batchTransfers.map(({calldata}) => calldata);

  const {governor, arenaToken} = getContracts(proposer, config);
  console.log(`Proposer: ${proposerAddress}`);
  console.log(`Governor: ${governor.address}`);
  console.log(`Proposal Threshold: ${await governor.proposalThreshold()}`);
  console.log(`Proposer Votes: ${await arenaToken.getVotes(proposerAddress)}`);

  console.log(JSON.stringify(targets));
  console.log(JSON.stringify(calldatas));

  const tx = await governor['propose(address[],uint256[],bytes[],string)'](
    targets,
    values,
    calldatas,
    `Distribute tokens for contest #Test`
  );
  console.log(`proposal submitted: ${tx.hash}`);
  console.log(`waiting for block inclusion ...`);
  await tx.wait(1);
  // TODO: query the transaction for the ProposalCreated event so we can get the proposalId

  console.log(`transaction included - proposal created!`);
  process.exit(0);
}
