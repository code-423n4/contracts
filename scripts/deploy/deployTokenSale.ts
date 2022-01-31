import {BigNumber as BN, Signer} from 'ethers';
import {expect} from 'chai';
import fs from 'fs';
import path from 'path';

import {
  ArenaToken__factory,
  TimelockController__factory,
  ArenaGovernor__factory,
  TokenSale__factory,
  TokenSale,
  TokenLock__factory,
} from '../../typechain';

import {allConfigs, tokenSaleConfigs} from './config';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {verifyContract} from './verify';

let proposerAddress: string;
let tokenSale: TokenSale;

const getContracts = (signer: Signer, config: typeof allConfigs[0]) => {
  const deploymentFilePath = path.join(`deployments`, config.EXPORT_FILENAME);
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
    contents: contents,
    deploymentFilePath: deploymentFilePath,
    governor: ArenaGovernor__factory.connect(governorAddress, signer),
    arenaToken: ArenaToken__factory.connect(arenaAddress, signer),
    timelock: TimelockController__factory.connect(timelockAddress, signer),
    tokenLock: TokenLock__factory.connect(tokenLockAddress, signer),
  };
};

export async function deployTokenSale(hre: HardhatRuntimeEnvironment) {
  const networkId = hre.network.config.chainId as number;
  const [proposer] = await hre.ethers.getSigners();
  proposerAddress = await proposer.getAddress();
  console.log(`Proposer: ${proposerAddress}`);

  let config = tokenSaleConfigs[networkId];
  let deployConfig = allConfigs[networkId];
  if (!config) throw new Error(`No config exists for network ${hre.network.name} (${networkId})`);
  const {contents, deploymentFilePath, governor, arenaToken, timelock, tokenLock} = getContracts(
    proposer,
    deployConfig
  );

  console.log(`deploying tokensale...`);
  const TokenSaleFactory = (await hre.ethers.getContractFactory('TokenSale')) as TokenSale__factory;

  tokenSale = await TokenSaleFactory.deploy(
    config.TOKEN_SALE_USDC,
    arenaToken.address,
    config.TOKEN_SALE_START,
    config.TOKEN_SALE_DURATION,
    config.TOKEN_SALE_ARENA_PRICE,
    config.TOKEN_SALE_RECIPIENT,
    tokenLock.address,
    allConfigs[networkId].VEST_DURATION,
    config.RECIPIENT_AMOUNT
  );
  await tokenSale.deployed();
  console.log(`tokenSale address: ${tokenSale.address}`);

  // set up token sale whitelist
  await tokenSale.changeWhiteList(
    config.TOKEN_SALE_WHITELIST.map(({buyer}) => buyer),
    config.TOKEN_SALE_WHITELIST.map(({arenaAmount}) => arenaAmount)
  );
  // transfer token sale admin role to timelock
  await tokenSale.transferOwnership(timelock.address);

  // 1st action: set token sale in TokenLock
  // 2nd action: request TOKEN_SALE_SUPPLY tokens from timelock to tokenSale
  let targets: string[] = [tokenLock.address, arenaToken.address];
  let values: string[] = ['0', '0'];
  let calldatas: string[] = [
    tokenLock.interface.encodeFunctionData('setTokenSale', [tokenSale.address]),
    arenaToken.interface.encodeFunctionData('transfer', [tokenSale.address, config.TOKEN_SALE_SUPPLY]),
  ];

  const tx = await governor['propose(address[],uint256[],bytes[],string)'](
    targets,
    values,
    calldatas,
    `# C4IP-6: Transfer ARENA for token sale\nThis proposal takes action on the token sale approved by [C4IP-1\\]
    \\(https://www.withtally.com/governance/eip155:137:0xc6eaDcC36aFcf1C430962506ad79145aD5140E58/proposal/61969381053746686972699442694032986733206504062025717191093241526145462208038) 
    and the hiring of Code4 Corporation approved by [C4IP-3\\]\\(https://www.withtally.com/governance/eip155:137:0xc6eaDcC36aFcf1C430962506ad79145aD5140E58/proposal/46190911081008287731655546929165163023822387405966829437304548060152876868278) 
    both of which are discussed in detail in [this forum post\\]\\(https://forum.code4rena.com/t/c4ip-1-constitution-dao-bootstrapping-reimbursements-token-sale/93)\n\n\n\n- 100,000,000 $ARENA tokens transferred to the [token sale contract\\]
    \\(${tokenSale.address})\n\n- Tokens are sold at price of 1 ARENA = .03 USDC\n\n- Token sale details to be administered by Code4 Corporation\n\n- $1.75M of the initial sale will immediately be used to fund Code4 Corporation operations\n\n
    - Remaining $1.25M proceeds will be transferred to the Code4rena treasury<br>\n\n\n<!-- -->\n\n`
  );
  console.log(`proposal submitted: ${tx.hash}`);
  console.log(`waiting for block inclusion ...`);
  await tx.wait(1);

  console.log('exporting addresses...');
  let addressesToExport = JSON.parse(contents);
  addressesToExport.tokenSale = tokenSale.address;
  let exportJson = JSON.stringify(addressesToExport, null, 2);
  fs.writeFileSync(deploymentFilePath, exportJson);

  console.log(`Verifying tokenSale contract...`);
  await verifyContract(hre, tokenSale.address, [
    config.TOKEN_SALE_USDC,
    arenaToken.address,
    config.TOKEN_SALE_START,
    config.TOKEN_SALE_DURATION,
    config.TOKEN_SALE_ARENA_PRICE,
    config.TOKEN_SALE_RECIPIENT,
    tokenLock.address,
    allConfigs[networkId].VEST_DURATION,
    config.RECIPIENT_AMOUNT,
  ]);

  /////////////////////////////////
  // ACCESS CONTROL VERIFICATION //
  /////////////////////////////////
  console.log('verifying access control settings...');
  // tokenSale's owner should be timelock
  expect(await tokenSale.owner()).to.be.eq(timelock.address);

  console.log('verification complete!');
  process.exit(0);
}
