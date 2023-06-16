import {task} from 'hardhat/config';

task('deployFull', 'deploy governance (timelock + governor) and token contracts').setAction(async (taskArgs, hre) => {
  // only load this file when task is run because it depends on typechain built artifacts
  // which will create a circular dependency when required by hardhat.config.ts for first compilation
  const {deployFull} = await import('./deployFull');
  await deployFull(hre);
});

task('upgradeGov', 'deploy ArenaGovernor').setAction(async (taskArgs, hre) => {
  const {upgradeGov} = await import('./upgradeGov');
  await upgradeGov(hre);
});

task('deployTokenSale', 'deploy token sale and make proposal for relevant actions').setAction(async (taskArgs, hre) => {
  // only load this file when task is run because it depends on typechain built artifacts
  // which will create a circular dependency when required by hardhat.config.ts for first compilation
  const {deployTokenSale} = await import('./deployTokenSale');
  await deployTokenSale(hre);
});
