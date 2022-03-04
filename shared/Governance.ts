import {Signer} from 'ethers';
import {ethers} from 'hardhat';
import {impersonateAccountWithFunds, stopImpersonateAccount} from './AccountManipulation';
import {increaseNextBlockTime, setNextBlockNumber} from './TimeManipulation';
import {POLYGON_AVERAGE_BLOCK_TIME} from './Constants';
import {DeployedContracts} from './Forking';
import {getABIFromPolygonscan} from './Polygonscan';

export const createAndExecuteProposal = async ({
  governor,
  timeLock,
  arenaToken,
  user,
  targets,
  values,
  calldatas,
}: {
  user: Signer;
  targets: string[];
  values: string[];
  calldatas: string[];
} & DeployedContracts) => {
  // 0. set voting delay & duration to 2 blocks, otherwise need to simulate 302,400 blocks
  const timeLockSigner = await impersonateAccountWithFunds(timeLock.address);
  let originalVotingDelay = await governor.votingDelay();
  let originalVotingPeriod = await governor.votingPeriod();
  console.log('setting voting delay and duration to 2 blocks...');
  await governor.connect(timeLockSigner).setVotingDelay(`2`);
  await governor.connect(timeLockSigner).setVotingPeriod(`2`);

  // 1. borrow some treasury tokens to user as we need signer with min. proposalThreshold tokens to propose
  const quorumAmount = await governor.quorumVotes();
  // careful, this sends ETH to timelock which might break real-world simulation for proposals involving Timelock ETH
  console.log('transferring tokens to user for proposal creation...');
  await arenaToken.connect(timeLockSigner).transfer(await user.getAddress(), quorumAmount);
  await arenaToken.connect(user).delegate(await user.getAddress());
  const descriptionHash = ethers.utils.keccak256([]); // keccak(``)
  console.log('creating proposal...');
  let tx = await governor.connect(user)['propose(address[],uint256[],bytes[],string)'](targets, values, calldatas, ``);
  let {events} = await tx.wait();
  // get first event (ProposalCreated), then get first arg of that event (proposalId)
  const proposalId: string = events![0].args![0].toString();

  // 2. advance time past voting delay and vote on proposal
  const voteStartBlock = await governor.proposalSnapshot(proposalId);
  // simulate elapsed time close to original voting delay
  await increaseNextBlockTime(Math.floor(POLYGON_AVERAGE_BLOCK_TIME * originalVotingDelay.toNumber()));
  await setNextBlockNumber(voteStartBlock.toNumber() + 1); // is a blocknumber which fits in Number
  console.log('casting vote...');
  tx = await governor.connect(user)['castVote'](proposalId, `1`);

  // 3. return borrowed tokens
  tx = await arenaToken.connect(user).transfer(timeLock.address, quorumAmount);

  // 4. advance time past voting period and queue proposal calls to Timelock via GovernorTimelockControl.queue
  const voteEndBlock = await governor.proposalDeadline(proposalId);
  // simulate elapsed time close to original voting delay
  await increaseNextBlockTime(Math.floor(POLYGON_AVERAGE_BLOCK_TIME * originalVotingPeriod.toNumber()));
  await setNextBlockNumber(voteEndBlock.toNumber() + 1); // is a blocknumber which fits in Number
  console.log('queueing proposal...');
  tx = await governor.connect(user)['queue(uint256)'](proposalId);
  await tx.wait();

  // can revert Governor changes now
  console.log('resetting voting delay and period...');
  await governor.connect(timeLockSigner).setVotingDelay(originalVotingDelay);
  await governor.connect(timeLockSigner).setVotingPeriod(originalVotingPeriod);
  await stopImpersonateAccount(timeLock.address);

  // 5. advance time past timelock delay and then execute
  const timeLockMinDelaySeconds = await timeLock.getMinDelay();
  await increaseNextBlockTime(timeLockMinDelaySeconds.toNumber());
  console.log('executing proposal...');
  tx = await governor.connect(user)['execute(uint256)'](proposalId);

  let result = await tx.wait(1);

  for (let i = 0; i < targets.length; i++) {
    let abi = await getABIFromPolygonscan(targets[i]);
    let iface = new ethers.utils.Interface(abi);
    let events = result.logs.map((log) => {
      try {
        return iface.parseLog(log);
      } catch (e) {
        // no matching event
      }
    });
    console.log(`### TARGET ${targets[i]} EVENTS ###`);
    console.log(events);
    console.log(`###################################`);
  }

  let timelockEvents = result.logs.map((log) => {
    try {
      return timeLock.interface.parseLog(log);
    } catch (e) {
      // no matching event
    }
  });
  console.log(`### TIMELOCK EVENTS ###`);
  console.log(timelockEvents);

  return proposalId;
};
