import { first, take } from 'rxjs/operators'
import { Arc } from '../src/arc'
import { ProposalOutcome} from '../src/proposal'
import { Vote } from '../src/vote'
import { createAProposal, getArc, getTestDAO, waitUntilTrue } from './utils'

/**
 * Stake test
 */
describe('Stake', () => {

  let arc: Arc

  beforeAll(() => {
    arc = getArc()
  })

  it('Vote is instantiable', () => {
      // public voter: string,
      // public createdAt: Date,
      // public outcome: ProposalOutcome,
      // public amount: number,
      // public proposalId: string,
      // public dao: Addre
  const stake = new Vote(
    '0x1234id',
    '0x124votes',
    0,
    ProposalOutcome.Fail,
    3e18,
    '0x12445proposalId',
    '0x12445daoAddress'
  )
  expect(stake).toBeInstanceOf(Vote)
  })

  it('Votes are searchable', async () => {

    let result
    // TODO: setup a proposal and create some votes
    const dao = await getTestDAO()
    const proposal = await createAProposal(dao)

    // let's have a vote
    await proposal.vote(ProposalOutcome.Pass).pipe(take(2)).toPromise()

    result = await Vote.search(arc, {proposal: '0x8ec40ce2c3708fe021c59e8011c3bae94db66de3987b54543fe4020507e3ec41'})
      .pipe(first()).toPromise()
    expect(result.length).toEqual(1)

    const voteIsIndexed = async () => {
      // we pass no-cache to make sure we hit the server on each request
      result = await Vote.search(arc, {proposal: proposal.id}, { fetchPolicy: 'no-cache' })
        .pipe(first()).toPromise()
      return result.length > 0
    }
    await waitUntilTrue(voteIsIndexed)
    expect(result.length).toEqual(1)
    expect(result[0].outcome).toEqual(ProposalOutcome.Pass)

    result = await Vote.search(arc, {})
      .pipe(first()).toPromise()
    expect(Array.isArray(result)).toBe(true)

    result = await Vote.search(arc, {proposal: '0x12345doesnotexist'})
      .pipe(first()).toPromise()
    expect(result).toEqual([])

    result = await Vote.search(arc, {id: '0x12345doesnotexist'})
      .pipe(first()).toPromise()
    expect(result).toEqual([])

    result = await Vote.search(arc, {
      dao: '0xsomedao',
      id: '0x12345doesnotexist'
    }).pipe(first()).toPromise()
    expect(result).toEqual([])
  })
})
