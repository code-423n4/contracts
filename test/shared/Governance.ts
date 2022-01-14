import {Signer} from 'ethers';
import {ethers} from 'hardhat';
import {impersonateAccountWithFunds, stopImpersonateAccount} from '../shared/AccountManipulation';
import {increaseNextBlockTime, setNextBlockNumber} from '../shared/TimeManipulation';
import {DeployedContracts} from './Forking';

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
  // we need address with min. proposalThreshold tokens to propose
  // 1. borrow some treasury tokens to user
  const quorumAmount = await governor.quorumVotes();
  // careful, this sends ETH to timelock which might break real-world simulation for proposals involving Timelock ETH
  const timeLockSigner = await impersonateAccountWithFunds(timeLock.address);
  await arenaToken.connect(timeLockSigner).transfer(await user.getAddress(), quorumAmount);
  // set voting delay & duration to 2 blocks, otherwise need to simulate 302,400 blocks
  await governor.connect(timeLockSigner).setVotingDelay(`2`);
  await governor.connect(timeLockSigner).setVotingPeriod(`2`);
  await stopImpersonateAccount(timeLock.address);

  await arenaToken.connect(user).delegate(await user.getAddress());
  const descriptionHash = ethers.utils.keccak256([]); // keccak(``)
  let tx = await governor.connect(user)['propose(address[],uint256[],bytes[],string)'](targets, values, calldatas, ``);
  let {events} = await tx.wait();
  // get first event (ProposalCreated), then get first arg of that event (proposalId)
  const proposalId: string = events![0].args![0].toString();

  // 2. vote on proposal
  const voteStartBlock = await governor.proposalSnapshot(proposalId);
  await setNextBlockNumber(voteStartBlock.toNumber() + 1); // is a blocknumber which fits in Number
  tx = await governor.connect(user)['castVote'](proposalId, `1`);

  // 3. return borrowed tokens
  tx = await arenaToken.connect(user).transfer(timeLock.address, quorumAmount);

  // 4. advance time past voting period and queue proposal calls to Timelock via GovernorTimelockControl.queue
  const voteEndBlock = await governor.proposalDeadline(proposalId);
  await setNextBlockNumber(voteEndBlock.toNumber() + 1); // is a blocknumber which fits in Number
  tx = await governor
    .connect(user)
    ['queue(address[],uint256[],bytes[],bytes32)'](targets, values, calldatas, descriptionHash);
  await tx.wait();

  // 5. advance time past timelock delay and then execute
  const timeLockMinDelaySeconds = await timeLock.getMinDelay();
  await increaseNextBlockTime(timeLockMinDelaySeconds.toNumber());
  await governor
    .connect(user)
    ['execute(address[],uint256[],bytes[],bytes32)'](targets, values, calldatas, descriptionHash);

  return proposalId;
};
