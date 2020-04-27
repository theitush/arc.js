import gql from 'graphql-tag'
import { Observable } from 'rxjs'
import {
  Arc,
  IApolloQueryOptions,
  createGraphQlQuery,
  Entity,
  Address,
  ICommonQueryOptions
} from './index'
import { DocumentNode } from 'graphql'

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

export class Event extends Entity<IEventState> {

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

  public static search(
    context: Arc,
    options: IEventQueryOptions = {},
    apolloQueryOptions: IApolloQueryOptions = {}
  ): Observable<Event[]> {

    const itemMap = (context: Arc, item: any, query: DocumentNode) => {
      const state = Event.itemMap(context, item, query)
      return new Event(context, state)
    }

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
      context,
      query,
      itemMap,
      apolloQueryOptions
    ) as Observable<Event[]>
  }

  public static itemMap(_context: Arc, item: any, query: DocumentNode): IEventState {

    if(!item) {
      throw Error(`Event ItemMap failed. Query: ${query.loc?.source.body}`)
    }

    return {
      dao: item.dao.id,
      data: JSON.parse(item.data),
      id: item.id,
      proposal: item.proposal && item.proposal.id,
      timestamp: item.timestamp,
      type: item.type,
      user: item.user
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

    return this.context.getObservableObject(this.context, query, Event.itemMap, apolloQueryOptions)
  }
}
