import { first } from 'rxjs/operators'
import { Arc } from '../src/arc'
import { DAO } from '../src/dao'
import { IProposalOutcome, IProposalStage, IProposalState, Proposal } from '../src/proposal'

import BN = require('bn.js')
import { createAProposal, firstResult, getTestAddresses, getTestDAO, ITestAddresses, LATEST_ARC_VERSION, newArc,
  toWei, voteToPassProposal, waitUntilTrue } from './utils'
import { BigNumber } from 'ethers/utils'
import { Contract, ethers } from 'ethers'

jest.setTimeout(60000)

describe('Claim rewards', () => {
  let arc: Arc
  let testAddresses: ITestAddresses
  let dao: DAO

  beforeAll(async () => {
    arc = await newArc()
    testAddresses = getTestAddresses(arc)
    dao = await getTestDAO()
  })

  it('works for ether and native token', async () => {
    const beneficiary = '0xffcf8fdee72ac11b5c542428b35eef5769c409f0'
    const ethReward = new BN(12345)
    const nativeTokenReward = toWei('271828')
    const reputationReward = toWei('8008')
    const states: IProposalState[] = []
    const lastState = () => states[states.length - 1]

    if(!arc.web3) throw new Error("Web3 provider not set")

    // make sure that the DAO has enough Ether to pay forthe reward
    await arc.web3.getSigner().sendTransaction({
      gasLimit: 4000000,
      gasPrice: 100000000000,
      to: dao.id,
      value: new BigNumber(ethReward.toString()).toHexString()
    })

    const daoBalance = await arc.web3.getBalance(dao.id)

    const daoEthBalance = new BN(daoBalance.toString())
    expect(Number(daoEthBalance.toString())).toBeGreaterThanOrEqual(Number(ethReward.toString()))

    const options = {
      beneficiary,
      dao: dao.id,
      ethReward,
      externalTokenAddress: undefined,
      externalTokenReward: toWei('0'),
      nativeTokenReward,
      reputationReward,
      scheme: testAddresses.base.ContributionReward
    }

    const response = await dao.createProposal(options).send()
    const proposal = response.result as Proposal

    // vote for the proposal
    await voteToPassProposal(proposal)
    // check if proposal is indeed accepted etc
    proposal.state().subscribe(((next) => states.push(next)))

    await waitUntilTrue(() => {
      return lastState() && lastState().stage === IProposalStage.Executed
    })

    const daoState = await firstResult(dao.state())
    const prevNativeTokenBalance = await firstResult(daoState.token.balanceOf(beneficiary))
    const reputationBalances: Array<BN> = []

    daoState.reputation.reputationOf(beneficiary).subscribe((next: BN) => {
      reputationBalances.push(next)
    })

    const prevBalance = await arc.web3.getBalance(beneficiary)
    const prevEthBalance = new BN(prevBalance.toString())

    await proposal.claimRewards(beneficiary).send()

    const newNativeTokenBalance = await firstResult(daoState.token.balanceOf(beneficiary))
    expect(newNativeTokenBalance.sub(prevNativeTokenBalance).toString()).toEqual(nativeTokenReward.toString())

    const newBalance = await arc.web3.getBalance(beneficiary)
    const newethBalance = new BN(newBalance.toString())
    expect(newethBalance.sub(prevEthBalance).toString()).toEqual(ethReward.toString())
    // no rewards were claimable yet
    await waitUntilTrue(() => reputationBalances.length === 2)
    // expect the repatution change to be equal or greater than the reward
    // (it could be higher because we may get rewards for voting)
    expect(Number(reputationBalances[1].sub(reputationBalances[0]).toString()))
      .toBeGreaterThanOrEqual(Number(reputationReward.toString()))
  })

  it('works for external token', async () => {
    const beneficiary = '0xffcf8fdee72ac11b5c542428b35eef5769c409f0'
    const externalTokenAddress = testAddresses.base.GEN
    const externalTokenReward = new BN(12345)

    await arc.GENToken().transfer(dao.id, externalTokenReward).send()
    const daoBalance =  await firstResult(arc.GENToken().balanceOf(dao.id))
    expect(Number(daoBalance.toString())).toBeGreaterThanOrEqual(Number(externalTokenReward.toString()))
    const options = {
      beneficiary,
      dao: dao.id,
      ethReward: new BN(0),
      externalTokenAddress,
      externalTokenReward,
      nativeTokenReward: new BN(0),
      reputationReward: new BN(0),
      scheme: testAddresses.base.ContributionReward
    }

    const response = await dao.createProposal(options).send()
    const proposal = response.result as Proposal

    // vote for the proposal with all the votest
    await voteToPassProposal(proposal)
    // check if prposal is indeed accepted etc
    const states: IProposalState[] = []
    proposal.state().subscribe(((next) => states.push(next)))
    const lastState = () => states[states.length - 1]

    await waitUntilTrue(() => {
      return lastState() && lastState().stage === IProposalStage.Executed
    })

    const prevTokenBalance = await firstResult(arc.GENToken().balanceOf(beneficiary))

    await proposal.claimRewards(beneficiary).send()

    const newTokenBalance = await firstResult(arc.GENToken().balanceOf(beneficiary))
    expect(newTokenBalance.sub(prevTokenBalance).toString()).toEqual(externalTokenReward.toString())

  })

  it('claimRewards should also work without providing a "beneficiary" argument', async () => {
    const proposal: Proposal = await createAProposal()
    await proposal.claimRewards().send()
  })

  it('claimRewards should also work for expired proposals', async () => {
     const proposal: Proposal = await arc.proposal(testAddresses.test.queuedProposalId)
     await proposal.claimRewards().send()
  })

  it('works with non-CR proposal', async () => {

    const version = '0.0.1-rc.32'
    testAddresses = getTestAddresses(arc)
    // dao = await getTestDAO()
    const ugenericSchemes = await arc.schemes({where: {name: "UGenericScheme", version}}).pipe(first()).toPromise()
    const ugenericScheme = ugenericSchemes[0]
    const ugenericSchemeState = await ugenericScheme.state().pipe(first()).toPromise()
    dao  = new DAO(ugenericSchemeState.dao, arc)

    const beneficiary = arc.defaultAccount
    const stakeAmount = new BN(123456789)
    await arc.GENToken().transfer(dao.id, stakeAmount).send()
    const actionMockABI = arc.getABI(undefined, 'ActionMock', LATEST_ARC_VERSION)

    if(!arc.web3) throw new Error("Web3 provider not set")

    const actionMock = new Contract(testAddresses.test.ActionMock.toString(), actionMockABI, arc.web3.getSigner())
    const callData = new ethers.utils.Interface(actionMockABI).functions.test2.encode([dao.id])

    const proposal = await createAProposal(dao, {
      callData,
      scheme: ugenericSchemeState.address,
      schemeToRegister: actionMock.address,
      value: 0
    })

    const proposalState = await proposal.fetchState()
    await arc.GENToken().approveForStaking(proposalState.votingMachine, stakeAmount).send()
    await proposal.stake(IProposalOutcome.Pass, stakeAmount).send()

    // vote for the proposal with all the votest
    await voteToPassProposal(proposal)
    // check if prposal is indeed accepted etc
    const states: IProposalState[] = []
    proposal.state().subscribe(((next) => states.push(next)))
    const lastState = () => states[states.length - 1]

    await waitUntilTrue(() => {
      return lastState() && lastState().stage === IProposalStage.Executed
    })

    if(!beneficiary) throw new Error("Beneficiary not set")

    const prevBalance =  await firstResult(arc.GENToken().balanceOf(beneficiary))
    await proposal.claimRewards(beneficiary).send()
    const newBalance =  await firstResult(arc.GENToken().balanceOf(beneficiary))
    expect(newBalance.sub(prevBalance).toString()).toEqual(stakeAmount.toString())

  })

})
