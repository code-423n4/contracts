import {task} from 'hardhat/config';

task('propose', 'propose transfer')
  .addOptionalParam('json', 'The path to batch transfer JSON file', `transfers.json`)
  .setAction(async ({json}, hre) => {
    // only load this file when task is run because it depends on typechain built artifacts
    // which will create a circular dependency when required by hardhat.config.ts for first compilation
    const {transferProposal} = await import('./transfer');
    await transferProposal(json, hre);
  });

task('simulateExistingProposal', 'simulates an existing proposal (by cloning it)')
  .addParam('id', 'Proposal ID')
  .setAction(async ({id}, hre) => {
    const {simulateExistingProposal} = await import('./simulateExistingProposal');
    await simulateExistingProposal(id, hre);
  });
