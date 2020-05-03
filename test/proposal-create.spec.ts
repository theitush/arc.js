import { Arc, IProposalCreateOptionsCR, ContributionRewardProposal } from '../src'
import { DAO } from '../src'
import { IProposalStage } from '../src'

import {
  fromWei,
  getTestAddresses,
  getTestDAO,
  getTestScheme,
  newArc,
  toWei,
  createCRProposal
} from './utils'

jest.setTimeout(20000)

describe('Create a ContributionReward proposal', () => {
  let arc: Arc
  let accounts: string[]
  let dao: DAO

  beforeAll(async () => {
    arc = await newArc()
    if (!arc.web3) throw new Error('Web3 provider not set')
    accounts = await arc.web3.listAccounts()
    arc.defaultAccount = accounts[0]
    dao = await getTestDAO()
  })

  it('is properly indexed', async () => {
    const options: IProposalCreateOptionsCR  = {
      beneficiary: '0xffcf8fdee72ac11b5c542428b35eef5769c409f0',
      dao: dao.id,
      ethReward: toWei('300'),
      externalTokenAddress: undefined,
      externalTokenReward: toWei('0'),
      nativeTokenReward: toWei('1'),
      reputationReward: toWei('10'),
      plugin: getTestScheme("ContributionReward")
    }

    const proposal = await createCRProposal(arc, options)
    expect(proposal.id).toBeDefined()

    const proposalState = await proposal.fetchState()

    expect(fromWei(proposalState.externalTokenReward)).toEqual('0.0')
    expect(fromWei(proposalState.ethReward)).toEqual('300.0')
    expect(fromWei(proposalState.nativeTokenReward)).toEqual('1.0')
    expect(fromWei(proposalState.reputationReward)).toEqual('10.0')
    expect(fromWei(proposalState.stakesAgainst)).toEqual('100.0')
    expect(fromWei(proposalState.stakesFor)).toEqual('0.0')

    if(!dao.context.web3) throw new Error('Web3 provider not set')
    let defaultAccount = await dao.context.getDefaultAddress()

    if (!defaultAccount) {
      defaultAccount = await dao.context.web3.getSigner().getAddress()
    }

    expect(proposalState).toMatchObject({
      executedAt: 0,
      proposer: defaultAccount.toLowerCase(),
      quietEndingPeriodBeganAt: 0,
      resolvedAt: 0,
      stage: IProposalStage.Queued
    })

    expect(proposalState).toMatchObject({
      beneficiary: options.beneficiary
    })

    expect(proposalState.dao.id).toEqual(dao.id)
  })

  it('saves title etc on ipfs', async () => {
    const options: IProposalCreateOptionsCR = {
      beneficiary: '0xffcf8fdee72ac11b5c542428b35eef5769c409f0',
      dao: dao.id,
      description: 'Just eat them',
      ethReward: toWei('300'),
      externalTokenAddress: undefined,
      externalTokenReward: toWei('0'),
      nativeTokenReward: toWei('1'),
      plugin: getTestScheme("ContributionReward"),
      title: 'A modest proposal',
      url: 'http://swift.org/modest'
    }

    const proposal = await createCRProposal(arc, options)
    const proposal2 = new ContributionRewardProposal(arc, proposal.id)
    const proposalState = await proposal2.fetchState()
    expect(proposalState.descriptionHash).toEqual('QmRg47CGnf8KgqTZheTejowoxt4SvfZFqi7KGzr2g163uL')

    // get the data
    // TODO - do the round trip test to see if subgraph properly indexs the fields
    // (depends on https://github.com/daostack/subgraph/issues/42)
    if (!arc.ipfs) throw Error('IPFS provider not set')
    const savedData = await arc.ipfs.cat(proposalState.descriptionHash as string) // + proposalState.descriptionHash)
    expect(savedData).toEqual({
      description: options.description,
      title: options.title,
      url: options.url
    })

  })

  it('handles the fact that the ipfs url is not set elegantly', async () => {
    const arcWithoutIPFS = await newArc()
    arcWithoutIPFS.ipfsProvider = ''
    const contractAddresses = await getTestAddresses()
    const anotherDAO = arcWithoutIPFS.dao(contractAddresses.dao.Avatar)
    const options: IProposalCreateOptionsCR = {
      beneficiary: '0xffcf8fdee72ac11b5c542428b35eef5769c409f0',
      dao: anotherDAO.id,
      description: 'Just eat them',
      ethReward: toWei('300'),
      externalTokenAddress: undefined,
      nativeTokenReward: toWei('1'),
      plugin: getTestScheme("ContributionReward"),
      title: 'A modest proposal',
      url: 'http://swift.org/modest'
    }

    await expect((await anotherDAO.createProposal(options)).send()).rejects.toThrowError(
      /No ipfsProvider set/i
    )
  })
})
