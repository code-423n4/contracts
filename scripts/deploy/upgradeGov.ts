import {ArenaGovernor__factory, ArenaGovernor} from '../../typechain';

import deployedAddrsJson from '../../deployments/polygonAddresses.json';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {verifyContract} from './verify';

let deployerAddress: string;
let governor: ArenaGovernor;

export async function upgradeGov(hre: HardhatRuntimeEnvironment) {
  const networkId = hre.network.config.chainId as number;
  const [deployer] = await hre.ethers.getSigners();
  deployerAddress = await deployer.getAddress();
  console.log(`Deployer: ${deployerAddress}`);

  console.log(`token address: ${deployedAddrsJson.token}`);
  console.log(`timelock address: ${deployedAddrsJson.timelock}`);

  console.log(`deploying governor...`);
  const ArenaGovernorFactory = (await hre.ethers.getContractFactory('ArenaGovernor')) as ArenaGovernor__factory;
  governor = await ArenaGovernorFactory.deploy(deployedAddrsJson.token, deployedAddrsJson.timelock);
  await governor.deployed();
  console.log(`governor address: ${governor.address}`);

  console.log(`sleeping for 30s...`);
  // sleep for 30s for network propagation
  await new Promise((f) => setTimeout(f, 30_000));

  console.log('verifying address on etherscan...');
  await verifyContract(hre, governor.address, [deployedAddrsJson.token, deployedAddrsJson.timelock]);
  process.exit(0);
}
