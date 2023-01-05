import React, { Component } from 'react';
import EditIdentityModal from './UserPage';
import CreateUserModal from '../modals/CreateUser';
import EnvironmentTraitsProvider from '../../../common/providers/EnvironmentTraitsProvider';
import RemoveIcon from '../RemoveIcon';
import JSONReference from "../JSONReference";
import Constants from "../../../common/constants";

const UsersPage = class extends Component {
    static displayName = 'UsersPage'

    constructor(props, context) {
        super(props, context);
        this.state = {
            search: Utils.fromParam().search,
        };
    }

    componentDidMount() {
        if (this.state.search) {
            AppActions.searchIdentities(this.props.match.params.environmentId, this.state.search);
        } else {
            AppActions.getIdentities(this.props.match.params.environmentId);
        }
        API.trackPage(Constants.pages.USERS);
    }

    componentWillUpdate(nextProps, nextState, nextContext) {
        if (nextProps.match.params.environmentId !== this.props.match.params.environmentId) {
            AppActions.getIdentities(nextProps.match.params.environmentId);
        }
    }

    onSave = () => {
        toast('Environment Saved');
    };

    editIdentity = (id, envFlags) => {
        openModal(<EditIdentityModal id={id} envFlags={envFlags}/>);
    };

    removeIdentity = (id, identifier) => {
        openConfirm(
            <h3>Delete User</h3>,
            <p>
                {'Are you sure you want to delete '}
                <strong>{identifier}</strong>
                {'?'}
            </p>,
            () => AppActions.deleteIdentity(this.props.match.params.environmentId, id),
        );
    }

    newUser = () => {
        openModal('New Users', <CreateUserModal
          environmentId={this.props.match.params.environmentId}
        />, null, { className: 'alert fade expand' });
    }

    deleteTrait = (id, func) => {
        openConfirm(<h3>Delete Trait</h3>, <p>
            Are you sure you want to delete the trait <strong>{id}</strong> for all users in this environment?
        </p>, func);
    }

    render() {
        const { projectId, environmentId } = this.props.match.params;
        const preventAddTrait = !AccountStore.getOrganisation().persist_trait_data;

        return (
            <div className="app-container container">
                <Permission level="environment" permission={Utils.getManageUserPermission()} id={environmentId}>
                    {({ permission }) => (
                        <div>
                            <div>
                                <Row>
                                    <Flex>
                                        <div>
                                            <h3>Users</h3>
                                            <p>
                                                View and manage features states for individual users. This will override individual default
                                                feature settings for your selected environment.
                                                {' '}
                                                <ButtonLink target="_blank" href="https://docs.flagsmith.com/basic-features/managing-identities">Learn more.</ButtonLink>
                                            </p>
                                        </div>
                                    </Flex>
                                    {permission ? (
                                        <FormGroup className="float-right">
                                            <Button
                                              className="float-right" data-test="show-create-feature-btn" id="show-create-feature-btn"
                                              onClick={this.newUser}
                                            >
                                            Create Users
                                            </Button>
                                        </FormGroup>
                                    ) : (
                                        <Tooltip
                                          html
                                          title={(
                                              <Button
                                                disabled data-test="show-create-feature-btn" id="show-create-feature-btn"
                                                onClick={this.newUser}
                                              >
                                                    Create Users
                                              </Button>
                                            )}
                                          place="right"
                                        >
                                            {Constants.environmentPermissions(Utils.getManageUserPermissionDescription())}
                                        </Tooltip>
                                    )}
                                </Row>
                            </div>

                            <FormGroup>
                                <IdentityListProvider>
                                    {({ isLoading, identities, identitiesPaging }) => (
                                        <div>
                                            <FormGroup>
                                                <PanelSearch
                                                  renderSearchWithNoResults
                                                  id="users-list"
                                                  title="Users"
                                                  className="no-pad"
                                                  isLoading={isLoading}
                                                  filterLabel={Utils.getIsEdge() ? 'Starts with' : 'Contains'}
                                                  icon="ion-md-person"
                                                  items={identities}
                                                  paging={identitiesPaging}
                                                  showExactFilter
                                                  renderFooter={()=><JSONReference className="mx-2 mt-4" title={"Users"} json={identities}/>}
                                                  nextPage={() => AppActions.getIdentitiesPage(environmentId, identitiesPaging.next, 'NEXT')}
                                                  prevPage={() => AppActions.getIdentitiesPage(environmentId, identitiesPaging.previous, 'PREVIOUS')}
                                                  goToPage={page => AppActions.getIdentitiesPage(environmentId, `${Project.api}environments/${environmentId}/${Utils.getIdentitiesEndpoint()}/?page=${page}`)}
                                                  renderRow={({ id, identifier }, index) =>(
                                                      <Row
                                                          space className="list-item clickable" key={id}
                                                          data-test={`user-item-${index}`}
                                                      >
                                                          <Flex>
                                                              <Link
                                                                  to={`/project/${this.props.match.params.projectId}/environment/${this.props.match.params.environmentId}/users/${encodeURIComponent(identifier)}/${id}`}
                                                              >
                                                                  <ButtonLink>
                                                                      {identifier}

                                                                      <span className="ion-ios-arrow-forward ml-3"/>
                                                                  </ButtonLink>

                                                              </Link>
                                                          </Flex>
                                                          {
                                                              Utils.renderWithPermission(permission, Constants.environmentPermissions(Utils.getManageUserPermissionDescription()), (
                                                                  <Column>
                                                                      <button
                                                                          disabled={!permission}
                                                                          id="remove-feature"
                                                                          className="btn btn--with-icon"
                                                                          type="button"
                                                                          onClick={() => this.removeIdentity(id, identifier)}
                                                                      >
                                                                          <RemoveIcon/>
                                                                      </button>
                                                                  </Column>
                                                              ))
                                                          }

                                                      </Row>
                                                  )}
                                                  renderNoResults={(
                                                      <div>
                                                                    You have no users in your project{this.state.search ? <span> for <strong>"{this.state.search}"</strong></span> : ''}.
                                                      </div>
                                                            )}
                                                  filterRow={(flag, search) => true}
                                                  search={this.state.search}
                                                  onChange={(e) => {
                                                      this.setState({ search: Utils.safeParseEventValue(e) });
                                                      AppActions.searchIdentities(this.props.match.params.environmentId, Utils.safeParseEventValue(e));
                                                  }}
                                                  isLoading={isLoading}
                                                />
                                            </FormGroup>
                                            <FormGroup>
                                                <p className="faint mt-4">
                                                        Users are created for your environment automatically when calling
                                                        identify/get flags
                                                        from any of the SDKs.
                                                    <br/>
                                                        We've created
                                                    {' '}
                                                    <strong>user_123456</strong>
                                                    {' '}
                                                        for you so you always have an example user to
                                                        test with on your environments.
                                                </p>
                                                <div className="row">
                                                    <div className="col-md-12">
                                                        <CodeHelp
                                                          showInitially
                                                          title="Creating users and getting their feature settings"
                                                          snippets={Constants.codeHelp.CREATE_USER(this.props.match.params.environmentId, identities && identities[0] && identities[0].identifier)}
                                                        />
                                                    </div>
                                                </div>

                                            </FormGroup>
                                        </div>
                                    )}
                                </IdentityListProvider>
                            </FormGroup>
                        </div>
                    )}
                </Permission>
            </div>
        );
    }
};

UsersPage.propTypes = {};

module.exports = ConfigProvider(UsersPage);
