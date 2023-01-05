import React, { Component } from 'react';
import ChangeRequestStore from '../../../common/stores/change-requests-store';
import OrganisationStore from '../../../common/stores/organisation-store';
import FeatureListStore from '../../../common/stores/feature-list-store';
import Button from '../base/forms/Button';
import UserSelect from '../UserSelect';
import Tabs from '../base/forms/Tabs';
import TabItem from '../base/forms/TabItem';
import Feature from '../Feature';
import withSegmentOverrides from '../../../common/providers/withSegmentOverrides';
import ProjectStore from '../../../common/stores/project-store';
import ValueEditor from '../ValueEditor';
import CreateFlagModal from '../modals/CreateFlag';
import InfoMessage from '../InfoMessage';
import JSONReference from "../JSONReference";

const labelWidth = 200;
const ChangeRequestsPage = class extends Component {
    static displayName = 'ChangeRequestsPage';

    static contextTypes = {
        router: propTypes.object.isRequired,
    };

    getApprovals = (users, approvals) => users.filter(v => approvals.includes(v.id))


    constructor(props, context) {
        super(props, context);
        this.state = {
            tags: [],
            showArchived: false,
        };
        ES6Component(this);
        this.listenTo(ChangeRequestStore, 'change', () => this.forceUpdate());
        this.listenTo(FeatureListStore, 'change', () => this.forceUpdate());
        this.listenTo(OrganisationStore, 'change', () => this.forceUpdate());
        this.listenTo(ChangeRequestStore, 'problem', () => this.setState({ error: true }));
        AppActions.getChangeRequest(this.props.match.params.id, this.props.match.params.projectId, this.props.match.params.environmentId);
        AppActions.getOrganisation(AccountStore.getOrganisation().id);
    }

    removeOwner = (id) => {
        if (ChangeRequestStore.isLoading) return;
        const changeRequest = ChangeRequestStore.model[this.props.match.params.id];
        AppActions.updateChangeRequest({
            id: changeRequest.id,
            title: changeRequest.title,
            description: changeRequest.description,
            feature_states: changeRequest.feature_states,
            approvals: changeRequest.approvals.filter(v => v.user !== id),
        });
    }

    addOwner = (id) => {
        if (ChangeRequestStore.isLoading) return;
        const changeRequest = ChangeRequestStore.model[this.props.match.params.id];
        AppActions.updateChangeRequest({
            id: changeRequest.id,
            title: changeRequest.title,
            description: changeRequest.description,
            feature_states: changeRequest.feature_states,
            approvals: changeRequest.approvals.concat([{ user: id }]),
        });
    }

    componentWillUpdate() {

    }

    componentDidMount = () => {

    };

    deleteChangeRequest = () => {
        openConfirm(<h3>Delete Change Request</h3>, (
            <p>
                Are you sure you want to delete this change request?
            </p>
        ), () => {
            AppActions.deleteChangeRequest(this.props.match.params.id, () => {
                this.context.router.history.replace(`/project/${this.props.match.params.projectId}/environment/${this.props.match.params.environmentId}/change-requests`);
            });
        });
    }

    editChangeRequest = (projectFlag, environmentFlag) => {
        const id = this.props.match.params.id;
        const changeRequest = ChangeRequestStore.model[id];

        openModal('Edit Change Request', <CreateFlagModal
          isEdit
          router={this.context.router}
          environmentId={this.props.match.params.environmentId}
          projectId={this.props.match.params.projectId}
          changeRequest={ChangeRequestStore.model[id]}
          projectFlag={projectFlag}
          multivariate_options={changeRequest.feature_states[0].multivariate_feature_state_values}
          environmentFlag={{
              ...environmentFlag,
              feature_state_value: Utils.featureStateToValue(changeRequest.feature_states[0].feature_state_value),
              enabled: changeRequest.feature_states[0].enabled,
          }}
          flagId={environmentFlag.id}
        />, null, { className: 'side-modal fade create-feature-modal' });
    }

    approveChangeRequest = () => {
        AppActions.actionChangeRequest(this.props.match.params.id, 'approve');
    }

    publishChangeRequest = () => {
        const id = this.props.match.params.id;
        const changeRequest = ChangeRequestStore.model[id];
        const isScheduled = new Date(changeRequest.feature_states[0].live_from).valueOf() > new Date().valueOf();
        const scheduledDate = moment(changeRequest.feature_states[0].live_from);

        openConfirm(<h3>{isScheduled ? 'Schedule' : 'Publish'} Change Request</h3>, (
            <p>
                Are you sure you want to {isScheduled ? 'schedule' : 'publish'} this change request{isScheduled ? ` for ${scheduledDate.format('Do MMM YYYY hh:mma')}` : ''}? This will adjust the feature for your environment.
            </p>
        ), () => {
            AppActions.actionChangeRequest(this.props.match.params.id, 'commit', () => {
                AppActions.refreshFeatures(this.props.match.params.projectId, this.props.match.params.environmentId, true);
            });
        });
    }

    fetchFeature = (featureId) => {
        this.activeFeature = featureId;
    }

    render() {
        const id = this.props.match.params.id;
        const changeRequest = ChangeRequestStore.model[id];
        const flags = ChangeRequestStore.flags[id];
        const environmentFlag = flags && flags.environmentFlag;
        const projectFlag = flags && flags.projectFlag;

        if (this.state.error && !changeRequest) {
            return (
                <div data-test="change-requests-page" id="change-requests-page" className="app-container container">
                    <h3>
                        Change Request not Found
                    </h3>
                    <p>
                        The Change Request may have been deleted.
                    </p>
                </div>
            );
        }
        if (!changeRequest || OrganisationStore.isLoading || !projectFlag || !environmentFlag) {
            return (
                <div data-test="change-requests-page" id="change-requests-page" className="app-container container">
                    <div className="text-center"><Loader/></div>
                </div>
            );
        }
        const orgUsers = OrganisationStore.model && OrganisationStore.model.users;
        const ownerUsers = changeRequest && this.getApprovals(orgUsers, changeRequest.approvals.map(v => v.user));
        const featureId = changeRequest && changeRequest.feature_states[0] && changeRequest.feature_states[0].feature;
        if (featureId !== this.activeFeature) {
            this.fetchFeature(featureId);
        }
        const user = changeRequest && orgUsers.find(v => v.id === changeRequest.user);
        const committedBy = changeRequest.committed_by && orgUsers && orgUsers.find(v => v.id === changeRequest.committed_by) || {};
        const isScheduled = new Date(changeRequest.feature_states[0].live_from).valueOf() > new Date().valueOf();
        const scheduledDate = moment(changeRequest.feature_states[0].live_from);
        const isMv = projectFlag && projectFlag.multivariate_options && !!projectFlag.multivariate_options.length;
        const { name, feature_state_value, description, is_archived, tags, enabled, hide_from_client, multivariate_options } = projectFlag ? Utils.getFlagValue(projectFlag, environmentFlag, null)
            : {
                multivariate_options: [],
            };

        const approval = changeRequest && changeRequest.approvals.find(v => v.user === AccountStore.getUser().id);
        const approvedBy = changeRequest.approvals.filter(v => !!v.approved_at).map((v) => {
            const matchingUser = orgUsers.find(u => u.id === v.user) || {};
            return `${matchingUser.first_name} ${matchingUser.last_name}`;
        });
        const approved = !!approval && !!approval.approved_at;
        const environment = ProjectStore.getEnvironment(this.props.match.params.environmentId);

        const minApprovals = environment.minimum_change_request_approvals || 0;
        const newValue = changeRequest.feature_states[0] && Utils.featureStateToValue(changeRequest.feature_states[0].feature_state_value);
        const oldValue = environmentFlag && environmentFlag.feature_state_value;
        const newEnabled = changeRequest.feature_states[0] && changeRequest.feature_states[0].enabled;
        const oldEnabled = environmentFlag && environmentFlag.enabled;
        let mvData = [];
        let mvChanged = false;
        if (isMv) {
            mvData = projectFlag.multivariate_options.map((v) => {
                const matchingOldValue = environmentFlag.multivariate_feature_state_values.find(e => e.multivariate_feature_option === v.id);
                const matchingNewValue = changeRequest.feature_states[0].multivariate_feature_state_values.find(e => e.multivariate_feature_option === v.id);
                if (matchingOldValue.percentage_allocation !== matchingNewValue.percentage_allocation) {
                    mvChanged = true;
                }
                return {
                    value: Utils.featureStateToValue(v),
                    changed: matchingOldValue.percentage_allocation !== matchingNewValue.percentage_allocation,
                    oldValue: matchingOldValue.percentage_allocation,
                    newValue: matchingNewValue.percentage_allocation,
                };
            });
        }
        const isYourChangeRequest = changeRequest.user === AccountStore.getUser().id;
        return (
            <Permission level="environment" permission={Utils.getApproveChangeRequestPermission(true)} id={this.props.match.params.environmentId}>
                {({ permission: approvePermission, isLoading }) => (
                    <Permission level="environment" permission="UPDATE_FEATURE_STATE" id={this.props.match.params.environmentId}>
                        {({ permission: publishPermission, isLoading }) => (
                            <div
                              style={{ opacity: ChangeRequestStore.isLoading ? 0.25 : 1 }} data-test="change-requests-page"
                              id="change-requests-page"
                              className="app-container container-fluid"
                            >
                                <div className="row">
                                    <Flex className="mb-2 ml-3">
                                        <Row>
                                            <Flex>
                                                <h3 className="ml-0">
                                                    {changeRequest.title}
                                                </h3>
                                            </Flex>

                                        </Row>
                                        <div className="list-item-footer faint">
                                            Created
                                            at {moment(changeRequest.created_at).format('Do MMM YYYY HH:mma')} by {changeRequest.user && user.first_name} {user && user.last_name}
                                        </div>
                                        <p className="mt-2">
                                            {changeRequest.description}
                                        </p>
                                    </Flex>
                                    <div className="mr-4">

                                        {((!committedBy || !committedBy.id) || isScheduled) && (
                                            <Row>
                                                <Button onClick={this.deleteChangeRequest} className="btn btn--small btn-danger">Delete</Button>
                                                <Button onClick={() => this.editChangeRequest(projectFlag, environmentFlag)} className="btn btn--small ml-2">Edit</Button>
                                            </Row>
                                        )}
                                    </div>
                                </div>
                                <div className="row">

                                    <div className="col-md-12">

                                        {
                                            isScheduled && !!changeRequest.committed_at && (
                                                <Row>
                                                    <InfoMessage icon="ion-md-calendar" title="Scheduled Change">
                                                        This feature change is scheduled to go live at {scheduledDate.format('Do MMM YYYY hh:mma')}. You can still edit / remove the change request before this date.
                                                    </InfoMessage>
                                                </Row>

                                            )
                                        }
                                        <InputGroup component={(
                                            <div>
                                                <Row>
                                                    <Button
                                                      className="btn--link"
                                                      onClick={() => this.setState({ showUsers: true })}
                                                    >Assignees <span className="ml-2 icon ion-md-cog"/>
                                                    </Button>
                                                </Row>
                                                <Row className="mt-2">
                                                    {ownerUsers && ownerUsers.map(u => (
                                                        <Row
                                                          onClick={() => this.removeOwner(u.id)}
                                                          className="chip chip--active"
                                                        >
                                                            <span className="font-weight-bold">
                                                                {u.first_name} {u.last_name}
                                                            </span>
                                                            <span className="chip-icon ion ion-ios-close"/>
                                                        </Row>
                                                    ))}
                                                </Row>
                                                <UserSelect
                                                  users={orgUsers}
                                                  value={ownerUsers && ownerUsers.map(v => v.id)}
                                                  onAdd={this.addOwner}
                                                  onRemove={this.removeOwner}
                                                  isOpen={this.state.showUsers}
                                                  onToggle={() => this.setState({ showUsers: !this.state.showUsers })}
                                                />
                                            </div>
                                        )}
                                        />
                                        <Panel
                                          title="Change Request"
                                        >

                                            <Row
                                              className="mt-2" style={{
                                                  marginLeft: '0.75rem',
                                                  marginRight: '0.75rem',
                                              }}
                                            >
                                                <strong style={{ width: labelWidth }}>
                                                    Feature
                                                </strong>

                                                <a target="_blank" className="btn--link btn--link-primary" href={`/project/${this.props.match.params.projectId}/environment/${this.props.match.params.environmentId}/features?feature=${projectFlag && projectFlag.id}`}>
                                                    {projectFlag && projectFlag.name}
                                                </a>
                                            </Row>
                                            <Row
                                              className="mt-2" style={{
                                                  marginLeft: '0.75rem',
                                                  marginRight: '0.75rem',
                                              }}
                                            >
                                                <span style={{ width: labelWidth }}/>

                                                <Flex>
                                                    {!changeRequest.committed_at && (
                                                        <strong>
                                                            Live Version
                                                        </strong>
                                                    )}
                                                </Flex>
                                                <Flex>
                                                    <strong>
                                                        Change Request
                                                    </strong>
                                                </Flex>
                                            </Row>

                                            <Row
                                              className="mt-2" style={{
                                                  marginLeft: '0.75rem',
                                                  marginRight: '0.75rem',
                                                  opacity: newEnabled === oldEnabled && !changeRequest.committed_at ? 0.25 : 1,
                                              }}
                                            >
                                                <strong style={{ width: labelWidth }}>
                                                    Enabled
                                                </strong>
                                                <Flex>
                                                    {!changeRequest.committed_at && (
                                                        <Switch checked={oldEnabled}/>
                                                    )}
                                                </Flex>
                                                <Flex>
                                                    <Switch checked={newEnabled}/>
                                                </Flex>
                                            </Row>
                                            <Row
                                              className="mt-2" style={{
                                                  marginLeft: '0.75rem',
                                                  marginRight: '0.75rem',
                                                  opacity: oldValue === newValue && !changeRequest.committed_at ? 0.25 : 1,
                                              }}
                                            >
                                                <strong style={{ width: labelWidth }}>
                                                    Value
                                                </strong>
                                                <Flex className="mr-2">
                                                    {!changeRequest.committed_at && (
                                                        <ValueEditor value={Utils.getTypedValue(oldValue)}/>
                                                    )}
                                                </Flex>
                                                <Flex className="ml-2">
                                                    <ValueEditor value={newValue}/>
                                                </Flex>
                                            </Row>
                                            {isMv && (
                                                <Row
                                                  className="mt-2 align-start" style={{
                                                      marginLeft: '0.75rem',
                                                      marginRight: '0.75rem',
                                                      opacity: !mvChanged && !changeRequest.committed_at ? 0.25 : 1,
                                                  }}
                                                >
                                                    <strong style={{ width: labelWidth }}>
                                                        Variations
                                                    </strong>
                                                    <Flex className="mr-2">
                                                        {
                                                            mvData.map((v, i) => (
                                                                <div className="mb-4" style={{ opacity: mvChanged && !v.changed ? 0.25 : 1 }}>
                                                                    <div>
                                                                        <div className="mb-2">
                                                                            <strong>Variation {i + 1}</strong>
                                                                        </div>
                                                                        <Row>
                                                                            <Flex>
                                                                                <ValueEditor value={Utils.getTypedValue(v.value)}/>
                                                                            </Flex>
                                                                        </Row>
                                                                    </div>
                                                                    <Row>
                                                                        <Flex className="ml-4">
                                                                            <span>
                                                                                Environment weight: <strong>{v.oldValue}%</strong>
                                                                            </span>
                                                                        </Flex>
                                                                        <Flex className="mr-4">
                                                                            <span>
                                                                                Environment weight: <strong>{v.newValue}%</strong>
                                                                            </span>
                                                                        </Flex>
                                                                    </Row>
                                                                </div>
                                                            ))
                                                        }
                                                    </Flex>
                                                </Row>
                                            )}

                                            <Row className="mt-2">
                                                <span style={{ width: labelWidth }}/>

                                                <Flex/>
                                                <Flex>


                                                    {
                                                        approvedBy.length ? (
                                                            <div className="text-right mb-2 mr-2">
                                                                <span className="ion icon-primary text-primary icon ion-md-checkbox mr-2"/>
                                                                Approved by {approvedBy.join(', ')}
                                                            </div>
                                                        ) : !!minApprovals && (
                                                            <div className="text-right mb-2 mr-2">
                                                                <span className="ion icon-primary text-primary icon ion-ios-information-circle mr-2"/>
                                                                You need at least {minApprovals} approval{minApprovals != 1 ? 's' : ''} to {isScheduled ? 'schedule' : 'publish'} this change
                                                            </div>
                                                        )
                                                    }

                                                    {changeRequest.committed_at ? (
                                                        <div className="text-right">
                                                            <span className="ion icon-primary text-primary icon ion-ios-git-merge mr-2"/>
                                                            Committed at {moment(changeRequest.committed_at).format('Do MMM YYYY HH:mma')} by {committedBy.first_name} {committedBy.last_name}
                                                        </div>
                                                    ) : (
                                                        <Row className="text-right mr-2">
                                                            <Flex/>
                                                            {!isYourChangeRequest && (
                                                                Utils.renderWithPermission(approvePermission, Constants.environmentPermissions('Approve Change Requests'), (
                                                                    <Button disabled={approved || !approvePermission} onClick={this.approveChangeRequest} className="btn">
                                                                        <span className="ion icon ion-md-checkbox text-light mr-2"/>
                                                                        {approved ? 'Approved' : 'Approve'}
                                                                    </Button>
                                                                ))
                                                            )}
                                                            {Utils.renderWithPermission(publishPermission, Constants.environmentPermissions('Update Feature States'), (
                                                                <Button disabled={(approvedBy.length<minApprovals) || !publishPermission} onClick={this.publishChangeRequest} className="btn ml-2">
                                                                    <span className="ion icon ion-ios-git-merge text-light mr-2"/>
                                                                    {isScheduled ? 'Schedule' : 'Publish'} Change
                                                                </Button>
                                                            ))}

                                                        </Row>
                                                    )}

                                                </Flex>
                                            </Row>

                                        </Panel>
                                    </div>
                                </div>
                                <JSONReference className="mt-4" title={"Change Request"} json={ChangeRequestStore.model?.[id]}/>

                                <Row>
                                    <div style={{ minHeight: 300 }}/>
                                </Row>
                            </div>
                        )}
                    </Permission>
                )}
            </Permission>
        );
    }
};

ChangeRequestsPage.propTypes = {};

module.exports = ConfigProvider(withSegmentOverrides(ChangeRequestsPage));
