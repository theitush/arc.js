import { first } from 'rxjs/operators'
import { Arc } from '../src/arc'
import { DAO } from '../src/dao'
import { Proposal } from '../src/proposal'
import { Queue } from '../src/queue'
import { BN } from './utils'
import { getTestAddresses, getTestDAO, ITestAddresses,  newArc } from './utils'

jest.setTimeout(10000)

/**
 * Queue test
 */
describe('Queue', () => {

    let arc: Arc
    let addresses: ITestAddresses

    beforeAll(async () => {
      arc = await newArc()
      addresses = await getTestAddresses()
    })

    it('Queue is instantiable', () => {
      const queue = new Queue(
        '0x1234id',
        new DAO('0x124daoAddress', arc),
        'no-name',
        arc
      )
      expect(queue).toBeInstanceOf(Queue)
    })

    it('Queues are searchable', async () => {
      const dao = await getTestDAO()
      let result: Queue[]
      result = await Queue.search({dao: dao.address}, arc)
          .pipe(first()).toPromise()
      // TODO: we should expect 3 queus here, see https://github.com/daostack/subgraph/issues/195
      expect(result.length).toEqual(3)

      expect((result.map((r) => r.name)).sort()).toEqual([
        'GenericScheme',
        'ContributionReward',
        'SchemeRegistrar'
      ].sort())
      // TODO: this does not work, cf: https://github.com/daostack/subgraph/issues/196
      // result = await Queue.search({dao: dao.address, name: 'ContributionReward'}, arc, { fetchPolicy: 'no-cache' })
      //     .pipe(first()).toPromise()
      // expect(result.length).toEqual(1)
      result = await Queue.search({dao: dao.address, name: 'GenericScheme'}, arc)
          .pipe(first()).toPromise()

      expect(result.length).toEqual(1)

      result = await Queue.search({dao: dao.address, name: 'SchemeRegistrar'}, arc)
          .pipe(first()).toPromise()

      expect(result.length).toEqual(1)
    })

    it('Queue.state() is working', async () => {
      const dao = await getTestDAO()
      const result = await Queue.search({dao: dao.address, name: 'SchemeRegistrar'}, arc)
          .pipe(first()).toPromise()

      const queue = result[0]
      const state = await queue.state().pipe(first()).toPromise()
      expect(state).toMatchObject({
        address: arc.contractAddresses.SchemeRegistrar,
        id: queue.id,
        name: 'SchemeRegistrar'
      })
    })

    it('Queue.state() should be equal to proposal.state().queue', async () => {
    const { queuedProposalId } = addresses.test
    const { GenesisProtocol } = addresses.base
    const proposal = new Proposal(queuedProposalId, '', GenesisProtocol, arc)
    const proposalState = await proposal.state().pipe(first()).toPromise()
    console.log(queuedProposalId)
    console.log(proposalState.queue.id)
    const queue = new Queue(proposalState.queue.id, proposalState.queue.dao, '(name)', arc)
    const queueState = await queue.state().pipe(first()).toPromise()
    expect(proposalState.queue).toEqual(queueState)
  })
})
