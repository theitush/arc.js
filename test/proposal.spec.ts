import BN = require('bn.js');
import { first} from 'rxjs/operators'
import { Arc } from '../src/arc'
import { IProposalState, Proposal, ProposalOutcome, ProposalStage } from '../src/proposal'
import { createAProposal, fromWei, getArc, getTestDAO, toWei, waitUntilTrue} from './utils'

const DAOstackMigration = require('@daostack/migration')

jest.setTimeout(10000)

/**
 * Proposal test
 */
describe('Proposal', () => {
  let arc: Arc

  beforeAll(async () => {
    arc = getArc()
  })

  it('Proposal is instantiable', () => {
    const id = 'some-id'
    const proposal = new Proposal(id, '', arc)
    expect(proposal).toBeInstanceOf(Proposal)
  })

  it('get list of proposals', async () => {
    const { Avatar, proposalId } = DAOstackMigration.migration('private').test
    const dao = arc.dao(Avatar.toLowerCase())
    const proposals = dao.proposals()
    const proposalsList = await proposals.pipe(first()).toPromise()
    expect(typeof proposalsList).toBe('object')
    expect(proposalsList.length).toBeGreaterThan(0)
    expect(proposalsList[proposalsList.length - 1].id).toBe(proposalId)
  })

  it('dao.proposals() accepts different query arguments', async () => {
    const { Avatar, proposalId } = DAOstackMigration.migration('private').test
    const dao = arc.dao(Avatar.toLowerCase())
    const proposals = await dao.proposals({ stage: ProposalStage.Queued}).pipe(first()).toPromise()
    expect(typeof proposals).toEqual(typeof [])
    expect(proposals.length).toBeGreaterThan(0)
    expect(proposals[proposals.length - 1].id).toBe(proposalId)
  })

  it('get proposal dao', async () => {
    const { Avatar, proposalId } = DAOstackMigration.migration('private').test

    const dao = arc.dao(Avatar.toLowerCase()).address
    const proposal = new Proposal(proposalId, dao, arc)
    // const proposalDao = await proposal.dao.pipe(first()).toPromise()
    expect(proposal).toBeInstanceOf(Proposal)
    expect(proposal.dao.address).toBe(dao)
  })

  it('state should be available before the data is indexed', async () => {
    //TODO: state should **not** be available?
    const proposal = await createAProposal()
    const proposalState = await proposal.state.pipe(first()).toPromise()
    // the state is null because the proposal has not been indexed yet
    expect(proposalState).toEqual(null)
  })

  it('Check proposal state is correct', async () => {
    const { proposalId } = DAOstackMigration.migration('private').test

    const proposal = new Proposal(proposalId, '', arc)
    const proposalState = await proposal.state.pipe(first()).toPromise()
    expect(proposal).toBeInstanceOf(Proposal)
    delete proposalState.dao
    delete proposalState.createdAt

    // TODO: these amounts seem odd, I guess not using WEI when proposal created?
    expect(fromWei(proposalState.nativeTokenReward)).toEqual("0.00000000000000001")
    expect(fromWei(proposalState.stakesAgainst)).toEqual("0.0000001")
    expect(fromWei(proposalState.stakesFor)).toEqual("0")
    expect(fromWei(proposalState.reputationReward)).toEqual("0.00000000000000001")
    expect(fromWei(proposalState.ethReward)).toEqual("0.00000000000000001")
    expect(fromWei(proposalState.externalTokenReward)).toEqual("0.00000000000000001")
    expect(fromWei(proposalState.votesFor)).toEqual("1000")
    expect(fromWei(proposalState.votesAgainst)).toEqual("1000")
    expect(fromWei(proposalState.proposingRepReward)).toEqual("0.000000005")

    expect(proposalState).toMatchObject({
        beneficiary: '0xffcf8fdee72ac11b5c542428b35eef5769c409f0',
        boostedAt: 0,
        boostedVotePeriodLimit: 259200,
        boostingThreshold: 0,
        confidence: 0,
        description: null,
        descriptionHash: '0x000000000000000000000000000000000000000000000000000000000000abcd',
        executedAt: null,
        // id: '0xc31f2952787d52a41a2b2afd8844c6e295f1bed932a3a433542d4c420965028e',
        preBoostedVotePeriodLimit: 259200,
        proposer: '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1',
        quietEndingPeriodBeganAt: null,
        resolvedAt: null,
        stage: ProposalStage.Queued,
        title: null,
        url: null,
        winningOutcome: 'Fail'
    })
  })

  it('get proposal rewards', async () => {
    // TODO: fix this once the subgraph corretly indexes rewards
    const { proposalId } = DAOstackMigration.migration('private').test
    const proposal = new Proposal(proposalId, '', arc)
    const rewards = await proposal.rewards().pipe(first()).toPromise()
    return
  })

  it('get proposal stakes', async () => {
    const dao = await getTestDAO()
    const proposal = await createAProposal()
    const stakes: any[] = []
    proposal.stakes().subscribe((next) => stakes.push(next))

    // make sure the account has balance
    const stakeAmount = toWei("1008");
    const contract = await arc.GENToken().mint(arc.web3.eth.defaultAccount, stakeAmount).send()
    await arc.approveForStaking(stakeAmount).send()
    await proposal.stake(ProposalOutcome.Pass, stakeAmount).send()

    // wait until we have the we got the stake update
    await waitUntilTrue(() => stakes.length > 0 && stakes[stakes.length - 1].length > 0)
    expect(stakes[0].length).toEqual(0)
    expect(stakes[stakes.length - 1].length).toEqual(1)
    const proposalState = await proposal.state.pipe(first()).toPromise()
    // TODO: uncomment next test when https://github.com/daostack/subgraph/issues/90 is resolved
    // expect(proposalState.confidence).toEqual(proposalState.stakesFor/proposalState.stakesAgainst)
  })

  it('state gets all updates', async () => {
    // TODO: write this test!
    const states: IProposalState[] = []
    const proposal = await createAProposal()
    proposal.state.subscribe(
      (state: any) => {
        states.push(state)
      },
      (err: any) => {
        throw err
      }
    )
    // vote for the proposal
    await proposal.vote(ProposalOutcome.Pass).pipe(first()).toPromise()

    // wait until all transactions are indexed
    await waitUntilTrue(() => {
      if (states.length > 2 && states[states.length - 1].votesFor.gt(new BN(0))) {
        return true
      } else {
        return false
      }
    })

    // we expect our first state to be null
    // (we just created the proposal and subscribed immediately)
    expect(Number(fromWei(states[states.length - 1].votesFor))).toBeGreaterThan(0)
    expect(states[states.length - 1].winningOutcome).toEqual('Pass')
  })
})
