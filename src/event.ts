import gql from 'graphql-tag'
import { Observable } from 'rxjs'
import { first } from 'rxjs/operators'
import { Arc, IApolloQueryOptions } from './arc'
import { Address, ICommonQueryOptions, IStateful } from './types'
import { createGraphQlQuery } from './utils'

export interface IEventState {
  id: string
  dao: string
  proposal: string
  user: string
  type: string
  data: {[key: string]: any}
  timestamp: string
}

export interface IEventQueryOptions extends ICommonQueryOptions {
  where?: {
    id?: string,
    dao?: Address,
    proposal?: string,
    user?: Address
    [key: string]: any
  }
}

export class Event implements IStateful<IEventState> {

  public static fragments = {
    EventFields: gql`fragment EventFields on Event {
      id
      dao {
        id
      }
      type
      data
      user
      proposal {
        id
      }
      timestamp
    }`
  }

  /**
   * Event.search(context, options) searches for reward entities
   * @param  context an Arc instance that provides connection information
   * @param  options the query options, cf. IEventQueryOptions
   * @return         an observable of Event objects
   */
  public static search(
    context: Arc,
    options: IEventQueryOptions = {},
    apolloQueryOptions: IApolloQueryOptions = {}
  ): Observable<Event[]> {

    const itemMap = (item: any) => new Event({
      dao: item.dao.id,
      data: JSON.parse(item.data),
      id: item.id,
      proposal: item.proposal && item.proposal.id,
      timestamp: item.timestamp,
      type: item.type,
      user: item.user
    }, context)

    let query
    query = gql`query EventSearch
      {
        events ${createGraphQlQuery(options)} {
          ...EventFields
        }
      }
      ${Event.fragments.EventFields}
      `

    return context.getObservableList(
      query,
      itemMap,
      apolloQueryOptions
    ) as Observable<Event[]>
  }

  public id: string
  public coreState: IEventState | undefined

constructor(public idOrOpts: string | IEventState, public context: Arc) {
    this.context = context
    if (typeof idOrOpts === 'string') {
      this.id = idOrOpts
    } else {
      this.id = idOrOpts.id
      this.setState(idOrOpts)
    }
  }

  public state(apolloQueryOptions: IApolloQueryOptions = {}): Observable < IEventState > {

    const query = gql`
      query EventState {
        event (id: "${this.id}")
        {
          ...EventFields
        }
      }
      ${Event.fragments.EventFields}
    `

    const itemMap = (item: any): IEventState => {
      const state = {
        dao: item.dao.id,
        data: JSON.parse(item.data),
        id: item.id,
        proposal: item.proposal && item.proposal.id,
        timestamp: item.timestamp,
        type: item.type,
        user: item.user
      }
      this.setState(state)
      return state
    }

    return this.context.getObservableObject(query, itemMap, apolloQueryOptions)
  }

  public setState(opts: IEventState) {
    this.coreState = opts
  }

  public async fetchState(): Promise < IEventState > {
    if (!!this.coreState) {
      return this.coreState
    } else {
      const state = await this.state({ subscribe: false }).pipe(first()).toPromise()
      this.setState(state)
      return state
    }
  }

}
