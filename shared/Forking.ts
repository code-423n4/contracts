import {Signer} from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import {
  ArenaGovernor,
  ArenaGovernor__factory,
  ArenaToken,
  ArenaToken__factory,
  TimelockController,
  TimelockController__factory,
  TokenLock,
  TokenLock__factory,
} from '../typechain';

export type DeployedContracts = {
  governor: ArenaGovernor;
  timeLock: TimelockController;
  tokenLock: TokenLock;
  arenaToken: ArenaToken;
};
export const getPolygonContracts = (signer: Signer): DeployedContracts => {
  const deploymentFilePath = path.join(`deployments`, `polygonAddresses.json`);
  if (!fs.existsSync(deploymentFilePath)) throw new Error(`File '${path.resolve(deploymentFilePath)}' does not exist.`);

  const contents = fs.readFileSync(deploymentFilePath, `utf8`);
  let governorAddress;
  let arenaAddress;
  let timelockAddress;
  let tokenLockAddress;
  try {
    ({
      governor: governorAddress,
      token: arenaAddress,
      tokenLock: tokenLockAddress,
      timelock: timelockAddress,
    } = JSON.parse(contents));
  } catch (error) {
    throw new Error(`Cannot parse deployment config at '${path.resolve(deploymentFilePath)}'.`);
  }
  if (!governorAddress) throw new Error(`Deployment file did not include governor address '${deploymentFilePath}'.`);
  if (!arenaAddress) throw new Error(`Deployment file did not include arena token address '${deploymentFilePath}'.`);
  if (!timelockAddress) throw new Error(`Deployment file did not include timelock address '${deploymentFilePath}'.`);
  if (!tokenLockAddress) throw new Error(`Deployment file did not include tokenLock address '${deploymentFilePath}'.`);

  return {
    governor: ArenaGovernor__factory.connect(governorAddress, signer),
    arenaToken: ArenaToken__factory.connect(arenaAddress, signer),
    timeLock: TimelockController__factory.connect(timelockAddress, signer),
    tokenLock: TokenLock__factory.connect(tokenLockAddress, signer),
  };
};

export function getForkParams() {
  if (process.env.POLYGON_URL == undefined) {
    console.log(`Missing POLYGON_URL in .env`);
    process.exit(1);
  }
  let forkParams: any = {
    forking: {
      jsonRpcUrl: process.env.POLYGON_URL
    }
  };
  if (process.env.FORK_BLOCK) forkParams['forking']['blockNumber'] = Number(process.env.FORK_BLOCK);
  return forkParams;
}
