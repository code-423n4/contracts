import {task} from 'hardhat/config';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import fs from 'fs';

import {
  ArenaToken,
  RevokableTokenLock,
  TimelockController,
  ArenaGovernor,
} from '../typechain';

import {allConfigs} from './config';

let token: ArenaToken;
let revokableTokenLock: RevokableTokenLock;
let timelock: TimelockController;
let governor: ArenaGovernor;

task('verifyContracts', 'verify deployed contracts')
.addParam('i', 'JSON file containing exported addresses')
.setAction(async (taskArgs, hre) => {
  const networkId = (hre.network.config.chainId) as number;
  console.log('verifying addresses...');
  const addresses = JSON.parse(fs.readFileSync(taskArgs.i, 'utf8'));

  token = await hre.ethers.getContractAt('ArenaToken', addresses['token']);
  revokableTokenLock = await hre.ethers.getContractAt('RevokableTokenLock', addresses['tokenLock']);
  timelock = await hre.ethers.getContractAt('TimelockController', addresses['timelock']);
  governor = await hre.ethers.getContractAt('ArenaGovernor', addresses['governor']);
  
  let config = allConfigs[networkId];

  await verifyContract(hre, token.address, [
    config.FREE_SUPPLY,
    config.AIRDROP_SUPPLY,
    config.CLAIMABLE_PROPORTION,
    new Date(config.CLAIM_END_DATE).getTime() / 1000,
    config.VEST_DURATION,
  ]);

  await verifyContract(hre, revokableTokenLock.address, [token.address, addresses['deployer']]);
  await verifyContract(hre, timelock.address, [config.TIMELOCK_DELAY, [], []]);
  await verifyContract(hre, governor.address, [token.address, timelock.address]);
  process.exit(0);
});

async function verifyContract(hre: HardhatRuntimeEnvironment, contractAddress: string, ctorArgs: any[]) {
  await hre.run('verify:verify', {
    address: contractAddress,
    constructorArguments: ctorArgs,
  });
}
