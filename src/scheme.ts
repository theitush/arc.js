import gql from 'graphql-tag'
import { Observable } from 'rxjs'
import { Arc, IApolloQueryOptions } from './arc'
import { IProposalCreateOptions, IProposalQueryOptions, Proposal } from './proposal'
import { Address } from './types'

export interface ISchemeState {
  id: string
  name: string
  address: Address
  canDelegateCall: boolean
  canRegisterSchemes: boolean
  canUpgradeController: boolean
  canManageGlobalConstraints: boolean
  dao: Address
  paramsHash: string
}

export interface ISchemeQueryOptions {
  id?: string,
  address?: Address,
  dao?: Address,
  name?: string

}

export class Scheme {
  public static search(
    options: ISchemeQueryOptions,
    context: Arc,
    apolloQueryOptions: IApolloQueryOptions = {}
): Observable<Scheme[]> {
    let where = ''
    for (const key of Object.keys(options)) {
      const value = (options as any)[key]

      // querying by'name' will not work as the name is not always populated
      if (value !== undefined && key !== 'name') {
        where += `${key}: "${value}"\n`
      }
    }

    const query = gql`{
      controllerSchemes (where: {${where}})
      {
        id
        address
        dao { id }
        name
      }
    }`
    const itemMap = (item: any): Scheme|null => {
      const name = item.name || context.getContractName(item.address)
      // we must filter explictly by name as the subgraph does not return the name
      if (options.name && options.name !== name) {
        return null
      }
      return new Scheme(
        item.id,
        item.dao.id,
        name,
        item.address,
        context
      )
    }

    return context.getObservableList(query, itemMap, apolloQueryOptions) as Observable<Scheme[]>
  }

  public address: Address
  public id: Address
  public dao: Address
  public name: string

  constructor(id: Address, dao: Address, name: string, address: Address, public context: Arc) {
    this.context = context
    this.id = id
    this.dao = dao
    this.name = name
    this.address = address
  }

  public state(): Observable<ISchemeState> {
    const query = gql`
      {
        controllerScheme (id: "${this.id}") {
          id
          address
          name
          dao { id }
          canDelegateCall
          canRegisterSchemes
          canUpgradeController
          canManageGlobalConstraints
          paramsHash
        }
      }
    `

    const itemMap = (item: any): ISchemeState|null => {

      const name = item.name || this.context.getContractName(item.address)
      return {
        address: item.address,
        canDelegateCall: item.canDelegateCall,
        canManageGlobalConstraints: item.canManageGlobalConstraints,
        canRegisterSchemes: item.canRegisterSchemes,
        canUpgradeController: item.canUpgradeController,
        dao: item.dao.id,
        id: item.id,
        name,
        paramsHash: item.paramsHash
      }
    }
    return this.context.getObservableObject(query, itemMap) as Observable<ISchemeState>
  }

    /**
     * create a new proposal in this DAO
     * TODO: move this to the schemes - we should call proposal.scheme.createProposal
     * @param  options [description ]
     * @return a Proposal instance
     */
    public createProposal(options: IProposalCreateOptions) {
      options.dao = this.address
      return Proposal.create(options, this.context)
    }

    public proposals(options: IProposalQueryOptions = {}): Observable<Proposal[]> {
      options.scheme = this.address
      return Proposal.search(options, this.context)
    }

}
