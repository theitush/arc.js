import BN = require('bn.js');
import gql from 'graphql-tag'
import { Observable } from 'rxjs'
import { map, switchMap } from 'rxjs/operators'
import { Arc } from './arc'
import { DAO } from './dao'

import { IProposalQueryOptions, Proposal } from './proposal'
import { Reward } from './reward'
import { IStake, IStakeQueryOptions } from './stake'
import { Address, ICommonQueryOptions, IStateful } from './types'
import { IVote, IVoteQueryOptions, Vote } from './vote'

export interface IMemberState {
  address: Address
  dao: DAO,
  reputation: BN
  // 'tokens' --> balance of address in dao.nativeToken.balanceOf
  tokens: BN
}

/**
 * Represents a user of a DAO
 */

export class Member implements IStateful<IMemberState> {
  public state: Observable<IMemberState>

  /**
   * @param address addresssof the member
   * @param daoAdress addresssof the DAO this member is a member of
   * @param context an instance of Arc
   */
  constructor(public address: Address, public daoAddress: Address, public context: Arc) {
    const query = gql`
      {
        members (
          where: {
            address: "${address}"
            dao: "${daoAddress}"
          }
        ) {
          id
          address
          dao {
            id
          }
          reputation
          tokens
        }
      }
    `

    const itemMap = (items: any) => {
      if (items.length === 0) {
        return {
          address,
          dao: new DAO(daoAddress, this.context),
          reputation: new BN(0),
          // TODO: we did not find the member, so we do not know how many tokens she holds,
          // cf. https://github.com/daostack/subgraph/issues/97
          tokens: new BN(0)
        }
      } else {
        const item = items[0]
        return {
          address,
          dao: new DAO(daoAddress, this.context),
          reputation: new BN(item.reputation),
          tokens: new BN(item.tokens)
        }
      }
    }

    this.state = context._getObservableObject(query, itemMap) as Observable<IMemberState>

  }

  public dao(): DAO {
    return new DAO(this.daoAddress, this.context)
  }

  public rewards(): Observable<Reward[]> {
    throw new Error('not implemented')
  }

  public proposals(options: IProposalQueryOptions = {}): Observable<Proposal[]> {
    options.proposer = this.address
    return this.dao().proposals(options)
  }

  public stakes(options: IStakeQueryOptions = {}): Observable<IStake[]> {
    options.staker = this.address
    return this.dao().stakes(options)
  }

  public votes(options: IVoteQueryOptions = {}): Observable<IVote[]> {
    throw new Error('not implemented')
    // TODO: implementation is pending https://github.com/daostack/subgraph/issues/96
    // options.voter = this.address
    // return Vote.search(this.context, options)
  }
}

export interface IMemberQueryOptions extends ICommonQueryOptions {
  address?: Address
  dao?: Address
}
