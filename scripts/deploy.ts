import {task} from 'hardhat/config';
import {expect} from 'chai';
import fs from 'fs';

import {
  ArenaToken__factory,
  ArenaToken,
  RevokableTokenLock__factory,
  RevokableTokenLock,
  TimelockController__factory,
  TimelockController,
  ArenaGovernor__factory,
  ArenaGovernor,
} from '../typechain';

import {allConfigs} from './config';

let deployerAddress: string;
let token: ArenaToken;
let revokableTokenLock: RevokableTokenLock;
let timelock: TimelockController;
let governor: ArenaGovernor;

// see OZ docs: https://docs.openzeppelin.com/contracts/4.x/api/governance#timelock-roles
const ADMIN_ROLE = '0x5f58e3a2316349923ce3780f8d587db2d72378aed66a8261c916544fa6846ca5';
const PROPOSER_ROLE = '0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1';
const EXECUTOR_ROLE = '0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63';

task('deploy', 'deploy contracts').setAction(async (taskArgs, hre) => {
  const networkId = (hre.network.config.chainId) as number;
  const [deployer] = await hre.ethers.getSigners();
  deployerAddress = await deployer.getAddress();
  console.log(`Deployer: ${deployerAddress}`);

  let config = allConfigs[networkId];

  console.log(`deploying token...`);
  const TokenFactory = (await hre.ethers.getContractFactory('ArenaToken')) as ArenaToken__factory;
  token = await TokenFactory.deploy(
    config.FREE_SUPPLY,
    config.AIRDROP_SUPPLY,
    config.CLAIMABLE_PROPORTION,
    new Date(config.CLAIM_END_DATE).getTime() / 1000,
    config.VEST_DURATION
  );
  await token.deployed();
  console.log(`token address: ${token.address}`);

  console.log(`deploying lock...`);
  const RevokableTokenLockFactory = (await hre.ethers.getContractFactory(
    'RevokableTokenLock'
  )) as RevokableTokenLock__factory;
  revokableTokenLock = await RevokableTokenLockFactory.deploy(token.address, deployerAddress);
  await revokableTokenLock.deployed();
  console.log(`revokableLock address: ${revokableTokenLock.address}`);

  // set lock in token
  await token.setTokenLock(revokableTokenLock.address);

  await token.setMerkleRoot(config.MERKLE_ROOT);

  console.log(`deploying timelock...`);
  const TimelockControllerFactory = (await hre.ethers.getContractFactory(
    'TimelockController'
  )) as TimelockController__factory;
  timelock = await TimelockControllerFactory.deploy(
    config.TIMELOCK_DELAY, // minDelay of 1 day
    [], // proposer and executor roles to be set after governor deployment
    []
  );
  await timelock.deployed();
  console.log(`timelock address: ${timelock.address}`);

  console.log(`deploying governor...`);
  const ArenaGovernorFactory = (await hre.ethers.getContractFactory('ArenaGovernor')) as ArenaGovernor__factory;
  governor = await ArenaGovernorFactory.deploy(token.address, timelock.address);
  await governor.deployed();
  console.log(`governor address: ${governor.address}`);

  // give governor proposer role
  // https://docs.openzeppelin.com/contracts/4.x/api/governance#timelock-proposer
  await timelock.grantRole(PROPOSER_ROLE, governor.address);

  // set executor role to null address so that ANY address can execute a queued proposal
  // https://docs.openzeppelin.com/contracts/4.x/api/governance#timelock-executor
  await timelock.grantRole(EXECUTOR_ROLE, hre.ethers.constants.AddressZero);

  // https://docs.openzeppelin.com/contracts/4.x/api/governance#timelock-admin
  // Timelock is self-governed, admin role has already been bestowed to itself
  // Deployer renounce roles so that all further maintenance operations have to go through the timelock process
  await timelock.renounceRole(ADMIN_ROLE, deployerAddress);

  // set revoker role in TokenLock to timelock
  await revokableTokenLock.setRevoker(timelock.address);

  // transfer all tokens held by deployer to timelock
  await token.transfer(timelock.address, config.FREE_SUPPLY);

  // transfer token admin role to timelock
  await token.transferOwnership(timelock.address);

  /////////////////////////////////
  // ACCESS CONTROL VERIFICATION //
  /////////////////////////////////
  console.log('verifying access control settings...');

  // deployer does not hold any role in timelock
  expect(await timelock.hasRole(ADMIN_ROLE, deployerAddress)).to.be.false;
  expect(await timelock.hasRole(PROPOSER_ROLE, deployerAddress)).to.be.false;
  expect(await timelock.hasRole(EXECUTOR_ROLE, deployerAddress)).to.be.false;

  // timelock is admin of itself
  expect(await timelock.hasRole(ADMIN_ROLE, timelock.address)).to.be.true;

  // governor is given proposer role
  expect(await timelock.hasRole(PROPOSER_ROLE, governor.address)).to.be.true;

  // null address is given executor role so that any address is allowed to execute proposal
  // see onlyRoleOrOpenRole modifier of TimelockController
  expect(await timelock.hasRole(EXECUTOR_ROLE, hre.ethers.constants.AddressZero)).to.be.true;

  // TokenLock revoker to be timelock
  expect(await revokableTokenLock.revoker()).to.be.eq(timelock.address);

  // Token's owner should be timelock
  expect(await token.owner()).to.be.eq(timelock.address);

  // check Token's tokenlock has been set
  expect(await token.tokenLock()).to.be.eq(revokableTokenLock.address);

  /////////////////////////
  // CONFIG VERIFICATION //
  /////////////////////////
  console.log('verifying config settings...');

  // check ArenaToken's token balance == AIRDROP_SUPPLY
  expect(await token.balanceOf(token.address)).to.be.eq(config.AIRDROP_SUPPLY);

  // check timelock's token balance == FREE_SUPPLY
  expect(await token.balanceOf(timelock.address)).to.be.eq(config.FREE_SUPPLY);

  // check timelock's minDelay
  expect(await timelock.getMinDelay()).to.be.eq(config.TIMELOCK_DELAY);

  // check merkle root is set
  expect(await token.merkleRoot()).to.be.eq(config.MERKLE_ROOT);

  // check claimable proportion
  expect(await token.claimableProportion()).to.be.eq(config.CLAIMABLE_PROPORTION);

  // check vest duration
  expect(await token.vestDuration()).to.be.eq(config.VEST_DURATION);

  console.log('verification complete!');
  console.log('exporting addresses...');
  let addressesToExport = {
    deployer: deployerAddress,
    token: token.address,
    tokenLock: revokableTokenLock.address,
    timelock: timelock.address,
    governor: governor.address,
  };
  let exportJson = JSON.stringify(addressesToExport, null, 2);
  fs.writeFileSync(config.EXPORT_FILENAME, exportJson);

  process.exit(0);
});
