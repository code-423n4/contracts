import {task} from 'hardhat/config';
import '@nomiclabs/hardhat-ethers';

import {
  ArenaToken__factory,
  ArenaToken,
  RevokableTokenLock__factory,
  RevokableTokenLock
} from '../typechain';

let deployerAddress: string;
let token: ArenaToken;
let revokableTokenLock: RevokableTokenLock;
let merkleRoot: string; // TODO: define string here

task('deploy', 'deploy token and lock contracts')
  .setAction(async (taskArgs, hre) => {
    const BN = hre.ethers.BigNumber;
    const WeiPerEther = hre.ethers.constants.WeiPerEther;
    const [deployer] = await hre.ethers.getSigners();
    deployerAddress = await deployer.getAddress();
    console.log(`Deployer: ${deployerAddress}`);

    console.log(`deploying token...`);
    const TokenFactory = (await hre.ethers.getContractFactory('ArenaToken')) as ArenaToken__factory;
    token = await TokenFactory.deploy(
        BN.from(900).mul(1_000_000).mul(WeiPerEther), // 900M
        BN.from(100).mul(1_000_000).mul(WeiPerEther), // 100M
        2000, // 20%
        BN.from(new Date().getTime()).add(365 * 86400), // 1 year (TBD)
        BN.from(new Date().getTime()).add(4 * 365 * 86400) // 4 years
        );
    await token.deployed();
    console.log(`token address: ${token.address}`);

    console.log(`deploying lock...`);
    const RevokableTokenLockFactory = (await hre.ethers.getContractFactory('RevokableTokenLock')) as RevokableTokenLock__factory;
    revokableTokenLock = await RevokableTokenLockFactory.deploy(
      token.address,
      deployerAddress
    );
    await revokableTokenLock.deployed();
    console.log(`revokableLock address: ${revokableTokenLock.address}`);

    // set lock in token
    await token.setTokenLock(revokableTokenLock.address);

    // TODO: load up merkle root
    // await token.setMerkleRoot(merkleRoot);
    process.exit(0);
  });
