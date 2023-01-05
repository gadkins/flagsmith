import React, { Component } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import Tabs from '../base/forms/Tabs';
import TabItem from '../base/forms/TabItem';
import withSegmentOverrides from '../../../common/providers/withSegmentOverrides';
import data from '../../../common/data/base/_data';
import ProjectStore from '../../../common/stores/project-store';
import _data from '../../../common/data/base/_data';
import SegmentOverrides from '../SegmentOverrides';
import AddEditTags from '../AddEditTags';
import Constants from '../../../common/constants';
import FlagOwners from '../FlagOwners';
import FeatureListStore from '../../../common/stores/feature-list-store';
import ChangeRequestModal from './ChangeRequestModal';
import Feature from '../Feature';
import { ButtonOutline } from '../base/forms/Button';
import ChangeRequestStore from '../../../common/stores/change-requests-store';
import { setInterceptClose } from '../../project/modals';
import classNames from 'classnames'
import InfoMessage from "../InfoMessage";
import JSONReference from "../JSONReference";
const FEATURE_ID_MAXLENGTH = Constants.forms.maxLength.FEATURE_ID;

const CreateFlag = class extends Component {
    static displayName = 'CreateFlag'

    constructor(props, context) {
        super(props, context);
        const { name, feature_state_value, description, is_archived, tags, enabled, hide_from_client, multivariate_options } = this.props.isEdit ? Utils.getFlagValue(this.props.projectFlag, this.props.environmentFlag, this.props.identityFlag)
            : {
                multivariate_options: [],
            };
        const { allowEditDescription } = this.props;
        if (this.props.projectFlag) {
            this.userOverridesPage(1);
        }
        this.state = {
            default_enabled: enabled,
            hide_from_client,
            name,
            tags: tags || [],
            initial_value: typeof feature_state_value === 'undefined' ? undefined : Utils.getTypedValue(feature_state_value),
            description,
            multivariate_options: _.cloneDeep(multivariate_options),
            identityVariations: this.props.identityFlag && this.props.identityFlag.multivariate_feature_state_values ? _.cloneDeep(this.props.identityFlag.multivariate_feature_state_values) : [],
            selectedIdentity: null,
            allowEditDescription,
            enabledIndentity: false,
            tab: Utils.fromParam().tab || 0,
            enabledSegment: false,
            is_archived,
            period: '28d',
        };
    }


    close() {
        closeModal();
    }


    componentDidUpdate(prevProps, prevState, snapshot) {
        if (!this.props.identity && this.props.environmentVariations !== prevProps.environmentVariations) {
            if (this.props.environmentVariations && this.props.environmentVariations.length) {
                this.setState({
                    multivariate_options: this.state.multivariate_options && this.state.multivariate_options.map((v) => {
                        const matchingVariation = (this.props.multivariate_options || this.props.environmentVariations).find(e => e.multivariate_feature_option === v.id);
                        return {
                            ...v,
                            default_percentage_allocation: v.default_percentage_allocation || (matchingVariation && matchingVariation.percentage_allocation) || 0,
                        };
                    }),
                });
            }
        }
    }

    onClosing = () => {
        if (this.props.isEdit) {
            return new Promise((resolve) => {
                if (this.state.valueChanged || this.state.segmentsChanged || this.state.settingsChanged) {
                    openConfirm('Are you sure', 'Closing this will discard your unsaved changes.', () => resolve(true), () => resolve(false), 'Ok', 'Cancel');
                } else {
                    resolve(true);
                }
            });
        }
        return Promise.resolve(true);
    }


    componentDidMount = () => {
        setInterceptClose(this.onClosing);
        if (!this.props.isEdit && !E2E) {
            this.focusTimeout = setTimeout(() => {
                this.input.focus();
                this.focusTimeout = null;
            }, 500);
        }
        AppActions.getIdentities(this.props.environmentId, 3);
        if (!Project.disableInflux && this.props.projectFlag && this.props.environmentFlag) {
            this.getInfluxData();
        }
    };

    componentWillUnmount() {
        if (this.focusTimeout) {
            clearTimeout(this.focusTimeout);
        }
    }

    userOverridesPage = (page) => {
        if (Utils.getIsEdge()) {
            return;
        }
        data.get(`${Project.api}environments/${this.props.environmentId}/${Utils.getFeatureStatesEndpoint()}/?anyIdentity=1&feature=${this.props.projectFlag.id}&page=${page}`)
            .then((userOverrides) => {
                this.setState({
                    userOverrides: userOverrides.results,
                    userOverridesPaging: {
                        next: userOverrides.next,
                        count: userOverrides.count,
                        currentPage: page,
                    },
                });
            });
    }

    getInfluxData = () => {
        if (Utils.getFlagsmithHasFeature('flag_analytics') && this.props.environmentFlag) {
            AppActions.getFlagInfluxData(this.props.projectId, this.props.environmentFlag.environment, this.props.projectFlag.id, this.state.period);
        }
    }

    getDisplayPeriod = () => {
        const { period } = this.state;
        if (period == '24h') {
            return '30d';
        }
        return '24h';
    }

    changePeriod = () => {
        const changePeriod = this.getDisplayPeriod();
        this.state = {
            ...this.state,
            period: changePeriod,
        };
        this.getInfluxData();
    }

    save = (func, isSaving) => {
        const { projectFlag: _projectFlag, segmentOverrides, environmentFlag, identity, identityFlag, environmentId } = this.props;
        const { name, initial_value, description, is_archived, default_enabled, hide_from_client } = this.state;
        const projectFlag = {
            skipSaveProjectFeature: this.state.skipSaveProjectFeature,
            ..._projectFlag,
        };
        const hasMultivariate = this.props.environmentFlag && this.props.environmentFlag.multivariate_feature_state_values && this.props.environmentFlag.multivariate_feature_state_values.length;
        if (identity) {
            !isSaving && name && func({
                identity,
                projectFlag,
                environmentFlag,
                identityFlag: Object.assign({}, identityFlag || {}, {
                    multivariate_options: this.state.identityVariations,
                    feature_state_value: hasMultivariate ? this.props.environmentFlag.feature_state_value : initial_value,
                    enabled: default_enabled,
                }),
                environmentId,
            });
        } else {
            FeatureListStore.isSaving = true;
            FeatureListStore.trigger('change');
            !isSaving && name && func(this.props.projectId, this.props.environmentId, {
                name,
                initial_value,
                default_enabled,
                tags: this.state.tags,
                hide_from_client,
                description,
                is_archived,
                multivariate_options: this.state.multivariate_options,
            }, projectFlag, environmentFlag, segmentOverrides);
        }
    }

    changeSegment = (items) => {
        const { enabledSegment } = this.state;
        items.forEach((item) => {
            item.enabled = enabledSegment;
        });
        this.props.updateSegments(items);
        this.setState({ enabledSegment: !enabledSegment });
    }

    changeIdentity = (items) => {
        const { environmentId } = this.props;
        const { enabledIndentity } = this.state;

        Promise.all(items.map(item => new Promise((resolve) => {
            AppActions.changeUserFlag({
                identityFlag: item.id,
                identity: item.identity.id,
                environmentId,
                onSuccess: resolve,
                payload: {
                    id: item.identity.id,
                    enabled: enabledIndentity,
                    value: item.identity.identifier,
                },
            });
        }))).then(() => {
            this.userOverridesPage(1);
        });

        this.setState({ enabledIndentity: !enabledIndentity });
    }

    toggleUserFlag = ({ id, feature_state_value, enabled, identity }) => {
        const { environmentId } = this.props;

        AppActions.changeUserFlag({
            identityFlag: id,
            identity: identity.id,
            environmentId,
            onSuccess: () => {
                this.userOverridesPage(1);
            },
            payload: {
                id: identity.id,
                enabled: !enabled,
                value: identity.identifier,
            },
        });
    }

    drawChart = (data) => {
        const { name } = this.state;
        if (data && data.events_list) { // protect against influx setup incorrectly
            return data.events_list.length ? (
                <ResponsiveContainer height={400} width="100%">
                    <BarChart data={data.events_list}>
                        <CartesianGrid strokeDasharray="3 5"/>
                        <XAxis
                          interval={0}
                          height={100} angle={-90}
                          textAnchor="end" allowDataOverflow={false} dataKey="datetime"
                        />
                        <YAxis allowDataOverflow={false}/>
                        <RechartsTooltip/>
                        <Bar dataKey={name} stackId="a" fill="#6633ff" />
                    </BarChart>
                </ResponsiveContainer>
            ) : (
                <div className="text-center">
                There has been no activity for this flag within the past month. Find out about Flag Analytics <a target="_blank" href="https://docs.flagsmith.com/advanced-use/flag-analytics">here</a>.
                </div>
            );
        }
        return null;
    }

    addItem = () => {
        const { projectFlag, environmentFlag, environmentId, identity } = this.props;
        this.setState({ isLoading: true });
        const selectedIdentity = this.state.selectedIdentity.value;
        const identities = identity ? identity.identifier : [];

        if (!_.find(identities, v => v.identifier === selectedIdentity)) {
            _data.post(`${Project.api}environments/${environmentId}/${Utils.getIdentitiesEndpoint()}/${selectedIdentity}/${Utils.getFeatureStatesEndpoint()}/`, {
                feature: projectFlag.id,
                enabled: !environmentFlag.enabled,
                feature_state_value: environmentFlag.value || null,
            }).then((res) => {
                this.setState({
                    isLoading: false,
                    selectedIdentity: null,
                });
                this.userOverridesPage(1);
            })
                .catch((e) => {
                    this.setState({ error, isLoading: false });
                });
        } else {
            this.setState({
                isLoading: false,
                selectedIdentity: null,
            });
        }
    }

    identityOptions = (identities, value, isLoading) => {
        if (!value) {
            return [];
        }
        return _.filter(
            identities, identity => !value || !_.find(value, v => v.identity.identifier === identity.identifier),
        ).map(({ identifier: label, id: value }) => ({ value, label })).slice(0, 10);
    }

    onSearchIdentityChange = (e) => {
        AppActions.searchIdentities(this.props.environmentId, Utils.safeParseEventValue(e), 3);
    }

    addVariation = () => {
        this.setState({
            valueChanged: true,
            multivariate_options: this.state.multivariate_options.concat([
                {
                    ...Utils.valueToFeatureState(''),
                    default_percentage_allocation: 0,
                },
            ]),
        });
    }

    removeVariation = (i) => {
        this.state.valueChanged = true;
        if (this.state.multivariate_options[i].id) {
            const idToRemove = this.state.multivariate_options[i].id;
            if (idToRemove) {
                this.props.removeMultiVariateOption(idToRemove);
            }
            this.state.multivariate_options.splice(i, 1);
            this.forceUpdate();
        } else {
            this.state.multivariate_options.splice(i, 1);
            this.forceUpdate();
        }
    }

    updateVariation = (i, e, environmentVariations) => {
        this.props.onEnvironmentVariationsChange(environmentVariations);
        this.state.multivariate_options[i] = e;
        this.state.valueChanged = true;
        this.forceUpdate();
    }


    render() {
        const {
            name,
            initial_value,
            hide_from_client,
            default_enabled,
            multivariate_options,
            description,
            is_archived,
            enabledSegment,
            enabledIndentity,
        } = this.state;
        const { isEdit, projectFlag, identity, identityName } = this.props;
        const Provider = identity ? IdentityProvider : FeatureListProvider;
        const environmentVariations = this.props.environmentVariations;
        const environment = ProjectStore.getEnvironment(this.props.environmentId);
        const is4Eyes = !!environment && Utils.changeRequestsEnabled(environment.minimum_change_request_approvals)
        const canSchedule = Utils.getPlansPermission('SCHEDULE_FLAGS');
        const is4EyesSegmentOverrides = is4Eyes && Utils.getFlagsmithHasFeature('4eyes_segment_overrides'); //
        const project = ProjectStore.model;
        const caseSensitive = Utils.getFlagsmithHasFeature("case_sensitive_flags") && project?.only_allow_lower_case_feature_names;
        const regex = project?.feature_name_regex;
        const controlValue = Utils.calculateControl(multivariate_options);
        const invalid = !!multivariate_options && multivariate_options.length && controlValue < 0;
        const existingChangeRequest = this.props.changeRequest;
        const hideIdentityOverridesTab = Utils.getShouldHideIdentityOverridesTab();
        const noPermissions = this.props.noPermissions;
        let regexValid = true;
        try {
            if(!isEdit && name && regex) {
                regexValid = name.match(new RegExp(regex))
            }
        } catch (e) {
            regexValid = false;
        }
        const Settings = (projectAdmin, createFeature) => (
            <>
                {!identity && this.state.tags && (
                    <FormGroup className="mb-4 mr-3 ml-3" >
                        <InputGroup
                          title={identity ? 'Tags' : 'Tags (optional)'}
                          tooltip={Constants.strings.TAGS_DESCRIPTION}
                          component={(
                              <AddEditTags
                                readOnly={!!identity || !createFeature} projectId={this.props.projectId} value={this.state.tags}
                                onChange={tags => this.setState({ tags, settingsChanged: true })}
                              />
                            )}
                        />
                    </FormGroup>
                )}
                {!identity && projectFlag && (
                    <Permission level="project" permission="ADMIN" id={this.props.projectId}>
                        {({ permission: projectAdmin }) => projectAdmin && (
                            <FormGroup className="mb-4 mr-3 ml-3" >
                                <FlagOwners projectId={this.props.projectId} id={projectFlag.id}/>
                            </FormGroup>

                        )}
                    </Permission>
                )}
                <FormGroup className="mb-4 mr-3 ml-3" >
                    <InputGroup
                      value={description}
                      data-test="featureDesc"
                      inputProps={{
                          className: 'full-width',
                          name: 'featureDesc',
                      }}
                      onChange={e => this.setState({ description: Utils.safeParseEventValue(e), settingsChanged: true })}
                      ds
                      type="text" title={identity ? 'Description' : 'Description (optional)'}
                      placeholder="e.g. 'This determines what size the header is' "
                    />
                </FormGroup>
                {!identity && isEdit && (
                    <FormGroup className="mb-4 mr-3 ml-3" >
                        <InputGroup
                          value={description}
                          component={(
                              <Switch checked={this.state.is_archived} onChange={is_archived => this.setState({ is_archived, settingsChanged: true })}/>
                          )}
                          onChange={e => this.setState({ description: Utils.safeParseEventValue(e) })}
                          type="text"
                          title="Archived"
                          tooltip="Archiving a flag allows you to filter out flags from the Flagsmith dashboard that are no longer relevant.<br/>An archived flag will still return as normal in all SDK endpoints."
                          placeholder="e.g. 'This determines what size the header is' "
                        />
                    </FormGroup>
                )}


                {!identity && Utils.getFlagsmithHasFeature('hide_flag') && (
                    <FormGroup className="mb-4 mr-3 ml-3">
                        <Tooltip
                          title={<label className="cols-sm-2 control-label">Hide from SDKs <span className="icon ion-ios-information-circle"/></label>}
                          place="right"
                        >
                            {Constants.strings.HIDE_FROM_SDKS_DESCRIPTION}
                        </Tooltip>
                        <div>
                            <Switch
                              data-test="toggle-feature-button"
                              defaultChecked={hide_from_client}
                              checked={hide_from_client}
                              onChange={hide_from_client => this.setState({ hide_from_client })}
                            />
                        </div>
                    </FormGroup>
                )}
            </>
        );

        const Value = (projectAdmin, createFeature, hideValue) => (
            <>
                {!isEdit && (
                    <FormGroup className="mb-4 mr-3 mt-2 ml-3">
                        <InputGroup
                          ref={e => this.input = e}
                          data-test="featureID"
                          inputProps={{
                              readOnly: isEdit,
                              className: 'full-width',
                              name: 'featureID',
                              maxLength: FEATURE_ID_MAXLENGTH,
                          }}
                          value={name}
                          onChange={e => {
                              const newName = Utils.safeParseEventValue(e).replace(/ /g, '_');
                              this.setState({ name: caseSensitive?newName.toLowerCase() : newName })
                          }}
                          isValid={!!name && regexValid}
                          type="text" title={<>
                            {isEdit ? 'ID' : 'ID*'}
                            {!!regex && !isEdit && <div className="mt-2"> <InfoMessage> This must conform to the regular expression <code>{regex}</code></InfoMessage></div>}
                        </>}
                          placeholder="E.g. header_size"
                        />
                    </FormGroup>
                )}

                {identity && description && (
                    <FormGroup className="mb-4 mt-2 mr-3 ml-3" >
                        <InputGroup
                          value={description}
                          data-test="featureDesc"
                          inputProps={{
                              className: 'full-width',
                              readOnly: !!identity || noPermissions,
                              name: 'featureDesc',
                              valueChanged: true,
                          }}
                          onChange={e => this.setState({ description: Utils.safeParseEventValue(e) })}
                          type="text" title={identity ? 'Description' : 'Description (optional)'}
                          placeholder="No description"
                        />
                    </FormGroup>
                )}
                {!hideValue && (
                    <div className={identity && !description ? 'mt-2' : ''}>
                        <Feature
                          readOnly={noPermissions}
                          hide_from_client={hide_from_client}
                          multivariate_options={multivariate_options}
                          environmentVariations={environmentVariations}
                          isEdit={isEdit}
                          canCreateFeature={createFeature}
                          identity={identity}
                          removeVariation={this.removeVariation}
                          updateVariation={this.updateVariation}
                          addVariation={this.addVariation}
                          checked={default_enabled}
                          value={initial_value}
                          identityVariations={this.state.identityVariations}
                          onChangeIdentityVariations={(identityVariations) => {
                              this.setState({ identityVariations, valueChanged: true });
                          }}
                          environmentFlag={this.props.environmentFlag}
                          projectFlag={projectFlag}
                          onValueChange={(e) => {
                              const initial_value = Utils.getTypedValue(Utils.safeParseEventValue(e));
                              this.setState({ valueChanged: true, initial_value });
                          }}
                          onCheckedChange={default_enabled => this.setState({ default_enabled })}
                        />
                    </div>
                )}
                {!isEdit && !identity && Settings(projectAdmin, createFeature)}
            </>
        );
        return (
            <ProjectProvider
              id={this.props.projectId}
            >
                {({ project }) => (
                    <Provider onSave={() => {
                        if (!isEdit || identity) {
                            this.close();
                        }
                        AppActions.refreshFeatures(this.props.projectId, this.props.environmentId);
                    }}
                    >
                        {({ isLoading, isSaving, error, influxData }, { createFlag, editFlagSettings, editFlagValue, editFlagSegments, createChangeRequest }) => {
                            const saveFeatureValue = (schedule) => {
                                this.setState({ valueChanged: false });
                                if ((is4Eyes || schedule) && !identity) {
                                    openModal2(schedule ? 'New Scheduled Flag Update' : this.props.changeRequest ? 'Update Change Request' : 'New Change Request', <ChangeRequestModal
                                      showAssignees={is4Eyes}
                                      changeRequest={this.props.changeRequest}
                                      onSave={({
                                          title, description, approvals, live_from,
                                      }) => {
                                          closeModal2();
                                          this.save((projectId, environmentId, flag, projectFlag, environmentFlag, segmentOverrides) => {
                                              createChangeRequest(projectId, environmentId, flag, projectFlag, environmentFlag, segmentOverrides, {
                                                  id: this.props.changeRequest && this.props.changeRequest.id,
                                                  featureStateId: this.props.changeRequest && this.props.changeRequest.feature_states[0].id,
                                                  title,
                                                  description,
                                                  approvals,
                                                  live_from,
                                                  multivariate_options: this.props.multivariate_options ? (
                                                      this.props.multivariate_options.map((v) => {
                                                          const matching = this.state.multivariate_options.find(m => m.id === v.multivariate_feature_option);
                                                          return {
                                                              ...v,
                                                              percentage_allocation: matching.default_percentage_allocation,
                                                          };
                                                      })

                                                  ) : this.state.multivariate_options,
                                              }, !is4Eyes);
                                          });
                                      }}
                                    />);
                                } else if (document.getElementById('language-validation-error')) {
                                    openConfirm('Validation error', 'Your remote config value does not pass validation for the language you have selected. Are you sure you wish to save?', () => {
                                        this.save(editFlagValue, isSaving);
                                    }, null, 'Save', 'Cancel');
                                } else {
                                    this.save(editFlagValue, isSaving);
                                }
                            };

                            const saveSettings = () => {
                                this.setState({ settingsChanged: false });
                                this.save(editFlagSettings, isSaving);
                            };

                            const saveFeatureSegments = () => {
                                this.setState({ segmentsChanged: false });

                                this.save(editFlagSegments, isSaving);
                            };

                            const onCreateFeature = () => {
                                this.save(createFlag, isSaving);
                            };

                            return (

                                <Permission level="project" permission="CREATE_FEATURE" id={this.props.projectId}>
                                    {({ permission: createFeature }) => (
                                        <Permission level="project" permission="ADMIN" id={this.props.projectId}>
                                            {({ permission: projectAdmin }) => {
                                                this.state.skipSaveProjectFeature = !createFeature;
                                                return (
                                                    <div
                                                      id="create-feature-modal"
                                                    >
                                                        {isEdit && !identity ? (
                                                            <Tabs value={this.state.tab} onChange={tab => this.setState({ tab })}>
                                                                <TabItem
                                                                  data-test="value" tabLabel={(
                                                                      <Row className="justify-content-center">Value {this.state.valueChanged && (
                                                                      <div className="unread ml-2 px-1">
                                                                          {'*'}
                                                                      </div>
                                                                      )}
                                                                      </Row>
                                                                )}
                                                                >
                                                                    <FormGroup className="mr-3 ml-3">
                                                                        <Panel title={(
                                                                            <Tooltip
                                                                              title={<h6 className="mb-0">Environment Value <span className="icon ion-ios-information-circle"/></h6>}
                                                                              place="top"
                                                                            >
                                                                                {Constants.strings.ENVIRONMENT_OVERRIDE_DESCRIPTION(_.find(project.environments, { api_key: this.props.environmentId }).name)}
                                                                            </Tooltip>
                                                                        )}
                                                                        >
                                                                            {Value(projectAdmin, createFeature)}

                                                                            {isEdit && (
                                                                                <>
                                                                                    <JSONReference showNamesButton title={"Feature"} json={projectFlag}/>
                                                                                    <JSONReference title={"Feature state"} json={this.props.environmentFlag}/>
                                                                                </>
                                                                            )}

                                                                        </Panel>
                                                                        <p className="text-right mt-4">
                                                                            {is4Eyes ? 'This will create a change request for the environment' : 'This will update the feature value for the environment'}
                                                                            {' '}
                                                                            <strong>
                                                                                {
                                                                                    _.find(project.environments, { api_key: this.props.environmentId }).name
                                                                                }
                                                                            </strong>
                                                                        </p>


                                                                        <Permission level="environment" permission={Utils.getManageFeaturePermission(is4Eyes, identity)} id={this.props.environmentId}>
                                                                            {({ permission: savePermission }) => (
                                                                                Utils.renderWithPermission(savePermission, Constants.environmentPermissions(Utils.getManageFeaturePermissionDescription(is4Eyes, identity)), (
                                                                                    <div className="text-right">
                                                                                        {!is4Eyes && (
                                                                                                <>
                                                                                                    {canSchedule ? (
                                                                                                        <ButtonOutline
                                                                                                          onClick={() => saveFeatureValue(true)} className="mr-2" type="button"
                                                                                                          data-test="create-change-request"
                                                                                                          id="create-change-request-btn" disabled={isSaving || !name || invalid || !savePermission}
                                                                                                        >
                                                                                                            {isSaving ? existingChangeRequest ? 'Updating Change Request' : 'Scheduling Update' : existingChangeRequest ? 'Update Change Request' : 'Schedule Update'}
                                                                                                        </ButtonOutline>
                                                                                                    ) : (
                                                                                                        <Tooltip title={(
                                                                                                            <ButtonOutline
                                                                                                              disabled
                                                                                                              className="mr-2" type="button"
                                                                                                              data-test="create-change-request"
                                                                                                              id="create-change-request-btn"
                                                                                                            >
                                                                                                                {isSaving ? existingChangeRequest ? 'Updating Change Request' : 'Scheduling Update' : existingChangeRequest ? 'Update Change Request' : 'Schedule Update'}
                                                                                                            </ButtonOutline>
                                                                                                        )}
                                                                                                        >
                                                                                                            {'This feature is available on our start-up plan'}
                                                                                                        </Tooltip>
                                                                                                    )}
                                                                                                </>

                                                                                        )}

                                                                                        {is4Eyes ? (
                                                                                            <Button
                                                                                              onClick={() => saveFeatureValue()} type="button" data-test="update-feature-btn"
                                                                                              id="update-feature-btn" disabled={!savePermission || isSaving || !name || invalid}
                                                                                            >
                                                                                                {isSaving ? existingChangeRequest ? 'Updating Change Request' : 'Creating Change Request' : existingChangeRequest ? 'Update Change Request' : 'Create Change Request'}
                                                                                            </Button>

                                                                                        ) : (
                                                                                            <Button
                                                                                              onClick={() => saveFeatureValue()} type="button" data-test="update-feature-btn"
                                                                                              id="update-feature-btn" disabled={isSaving || !name || invalid || !savePermission}
                                                                                            >
                                                                                                {isSaving ? 'Updating' : 'Update Feature Value'}
                                                                                            </Button>
                                                                                        )}
                                                                                    </div>)))}
                                                                        </Permission>

                                                                    </FormGroup>
                                                                </TabItem>
                                                                {!existingChangeRequest && (
                                                                    <TabItem
                                                                      data-test="segment_overrides" tabLabel={(
                                                                          <Row className="justify-content-center">Segment Overrides {this.state.segmentsChanged && (
                                                                          <div className="unread ml-2 px-2">
                                                                                *
                                                                          </div>
                                                                          )}
                                                                          </Row>
                                                                    )}
                                                                    >
                                                                        {!identity && isEdit && (
                                                                            <FormGroup className="mb-4 mr-3 ml-3">
                                                                                <Permission level="environment" permission={Utils.getManageFeaturePermission(false, identity)} id={this.props.environmentId}>
                                                                                    {({ permission: environmentAdmin }) => ((
                                                                                        <div>
                                                                                            <Panel
                                                                                              icon="ion-ios-settings"
                                                                                              title={(
                                                                                                  <Tooltip
                                                                                                    title={<h6 className="mb-0">Segment Overrides <span className="icon ion-ios-information-circle"/></h6>}
                                                                                                    place="right"
                                                                                                  >
                                                                                                      {Constants.strings.SEGMENT_OVERRIDES_DESCRIPTION}
                                                                                                  </Tooltip>
                                                                                                )}
                                                                                              action={
                                                                                                    !this.state.showCreateSegment && !noPermissions && (
                                                                                                        <Button onClick={() => this.changeSegment(this.props.segmentOverrides)} type="button" className={`btn--outline${enabledSegment ? '' : '-red'}`}>
                                                                                                            {enabledSegment ? 'Enable All' : 'Disable All'}
                                                                                                        </Button>
                                                                                                    )
                                                                                                }
                                                                                            >
                                                                                                {this.props.segmentOverrides ? (
                                                                                                    <SegmentOverrides
                                                                                                      readOnly={noPermissions}
                                                                                                      showEditSegment
                                                                                                      showCreateSegment={this.state.showCreateSegment}
                                                                                                      setShowCreateSegment={showCreateSegment => this.setState({ showCreateSegment })}
                                                                                                      feature={projectFlag.id}
                                                                                                      projectId={this.props.projectId}
                                                                                                      multivariateOptions={multivariate_options}
                                                                                                      environmentId={this.props.environmentId}
                                                                                                      value={this.props.segmentOverrides}
                                                                                                      controlValue={initial_value}
                                                                                                      onChange={(v) => {
                                                                                                          this.setState({ segmentsChanged: true });
                                                                                                          this.props.updateSegments(v);
                                                                                                      }}
                                                                                                    />
                                                                                                ) : (
                                                                                                    <div className="text-center">
                                                                                                        <Loader/>
                                                                                                    </div>
                                                                                                )}
                                                                                            </Panel>
                                                                                            {!this.state.showCreateSegment && (
                                                                                                <div>
                                                                                                    <p className="text-right mt-4">
                                                                                                        {is4Eyes && is4EyesSegmentOverrides ? 'This will create a change request for the environment' : 'This will update the segment overrides for the environment'}
                                                                                                        {' '}
                                                                                                        <strong>
                                                                                                            {
                                                                                                                _.find(project.environments, { api_key: this.props.environmentId }).name
                                                                                                            }
                                                                                                        </strong>
                                                                                                    </p>
                                                                                                    <Permission level="environment" permission={Utils.getManageFeaturePermission(is4Eyes, identity)} id={this.props.environmentId}>
                                                                                                        {({ permission: savePermission }) => (
                                                                                                            Utils.renderWithPermission(savePermission, Constants.environmentPermissions(Utils.getManageFeaturePermissionDescription(is4Eyes, identity)), (
                                                                                                                <div className="text-right">
                                                                                                                    <Button
                                                                                                                      onClick={saveFeatureSegments} type="button" data-test="update-feature-segments-btn"
                                                                                                                      id="update-feature-segments-btn" disabled={isSaving || !name || invalid || !savePermission}
                                                                                                                    >
                                                                                                                        {isSaving ? 'Updating' : 'Update Segment Overrides'}
                                                                                                                    </Button>
                                                                                                                </div>

                                                                                                            )))}
                                                                                                    </Permission>
                                                                                                </div>
                                                                                            )}
                                                                                        </div>

                                                                                    ))}
                                                                                </Permission>
                                                                            </FormGroup>
                                                                        )}
                                                                    </TabItem>
                                                                )}

                                                                {
                                                                    !identity
                                                                    && isEdit && !existingChangeRequest && !hideIdentityOverridesTab && (
                                                                        <TabItem data-test="identity_overrides" tabLabel="Identity Overrides">
                                                                            <FormGroup className="mb-4 mr-3 ml-3">
                                                                                <PanelSearch
                                                                                  id="users-list"
                                                                                  title={(
                                                                                      <Tooltip
                                                                                        title={<h6 className="mb-0">Identity Overrides <span className="icon ion-ios-information-circle"/></h6>}
                                                                                        place="right"
                                                                                      >
                                                                                          {Constants.strings.IDENTITY_OVERRIDES_DESCRIPTION}
                                                                                      </Tooltip>
                                                                                    )}
                                                                                  action={
                                                                                        (
                                                                                            <Button onClick={() => this.changeIdentity(this.state.userOverrides)} type="button" className={`btn--outline${enabledIndentity ? '' : '-red'}`}>
                                                                                                {enabledIndentity ? 'Enable All' : 'Disable All'}
                                                                                            </Button>
                                                                                        )
                                                                                    }
                                                                                  icon="ion-md-person"
                                                                                  items={this.state.userOverrides}
                                                                                  paging={this.state.userOverridesPaging}
                                                                                  nextPage={() => this.userOverridesPage(this.state.userOverridesPaging.currentPage + 1)}
                                                                                  prevPage={() => this.userOverridesPage(this.state.userOverridesPaging.currentPage - 1)}
                                                                                  goToPage={page => this.userOverridesPage(page)}
                                                                                  searchPanel={
                                                                                        (
                                                                                            <div className="text-center mt-2 mb-2">
                                                                                                <IdentityListProvider>
                                                                                                    {({ isLoading, identities }) => (
                                                                                                        <Flex className="text-left">
                                                                                                            <Select
                                                                                                              onInputChange={this.onSearchIdentityChange}
                                                                                                              data-test="select-identity"
                                                                                                              placeholder="Create an Identity Override..."
                                                                                                              value={this.state.selectedIdentity}
                                                                                                              onChange={selectedIdentity => this.setState({ selectedIdentity }, this.addItem)}
                                                                                                              options={this.identityOptions(identities, this.state.userOverrides, isLoading)}
                                                                                                              styles={{
                                                                                                                  control: base => ({
                                                                                                                      ...base,
                                                                                                                      '&:hover': { borderColor: '$bt-brand-secondary' },
                                                                                                                      border: '1px solid $bt-brand-secondary',
                                                                                                                  }),
                                                                                                              }}
                                                                                                            />
                                                                                                        </Flex>
                                                                                                    )}
                                                                                                </IdentityListProvider>
                                                                                            </div>
                                                                                        )
                                                                                    }
                                                                                  renderRow={({ id, feature_state_value, enabled, identity }) => (
                                                                                      <Row
                                                                                        space className="list-item cursor-pointer"
                                                                                        key={id}
                                                                                      >
                                                                                          <Flex onClick={() => {
                                                                                              window.open(`${document.location.origin}/project/${this.props.projectId}/environment/${this.props.environmentId}/users/${identity.identifier}/${identity.id}?flag=${projectFlag.name}`, '_blank');
                                                                                          }}
                                                                                          >
                                                                                              {identity.identifier}
                                                                                          </Flex>
                                                                                          <Switch checked={enabled} onChange={() => this.toggleUserFlag({ id, identity, enabled })}/>
                                                                                          <div className="ml-2">
                                                                                              {feature_state_value && (
                                                                                              <FeatureValue
                                                                                                value={feature_state_value}
                                                                                              />
                                                                                              )}
                                                                                          </div>


                                                                                          <a
                                                                                            target="_blank"
                                                                                            href={`/project/${this.props.projectId}/environment/${this.props.environmentId}/users/${identity.identifier}/${identity.id}?flag=${projectFlag.name}`}
                                                                                            className="ml-2 btn btn-link btn--link" onClick={() => {
                                                                                            }}
                                                                                          >
                                                                                                Edit
                                                                                          </a>
                                                                                      </Row>
                                                                                  )}
                                                                                  renderNoResults={(
                                                                                      <Panel
                                                                                        id="users-list"
                                                                                        title={(
                                                                                            <Tooltip
                                                                                              title={<h6 className="mb-0">Identity Overrides <span className="icon ion-ios-information-circle"/></h6>}
                                                                                              place="right"
                                                                                            >
                                                                                                {Constants.strings.IDENTITY_OVERRIDES_DESCRIPTION}
                                                                                            </Tooltip>
                                                                                            )}
                                                                                      >
                                                                                          { (
                                                                                              <IdentityListProvider>
                                                                                                  {({ isLoading, identities }) => (
                                                                                                      <div>
                                                                                                          <Flex className="text-left">
                                                                                                              <Select
                                                                                                                data-test="select-identity"
                                                                                                                placeholder="Search"
                                                                                                                onInputChange={this.onSearchIdentityChange}
                                                                                                                value={this.state.selectedIdentity}
                                                                                                                onChange={selectedIdentity => this.setState({ selectedIdentity }, this.addItem)}
                                                                                                                options={this.identityOptions(identities, this.state.userOverrides, isLoading)}
                                                                                                                styles={{
                                                                                                                    control: base => ({
                                                                                                                        ...base,
                                                                                                                        '&:hover': { borderColor: '$bt-brand-secondary' },
                                                                                                                        border: '1px solid $bt-brand-secondary',
                                                                                                                    }),
                                                                                                                }}
                                                                                                              />
                                                                                                          </Flex>
                                                                                                          <div className="mt-2">
                                                                                                                No identities are overriding this feature.
                                                                                                          </div>
                                                                                                      </div>
                                                                                                  )}
                                                                                              </IdentityListProvider>
                                                                                            )}
                                                                                      </Panel>
                                                                                    )}
                                                                                  isLoading={!this.state.userOverrides}
                                                                                />
                                                                            </FormGroup>
                                                                        </TabItem>
                                                                    )
                                                                }
                                                                { !existingChangeRequest && !Project.disableInflux && (Utils.getFlagsmithHasFeature('flag_analytics') && this.props.flagId) && (
                                                                    <TabItem data-test="analytics" tabLabel="Analytics">
                                                                        <FormGroup className="mb-4 mr-3 ml-3">
                                                                            <Panel
                                                                              title={!!influxData && <h6 className="mb-0">Flag events for last {influxData.timespan} days</h6>}
                                                                            >
                                                                                {!influxData && <div className="text-center"><Loader/></div> }

                                                                                {this.drawChart(influxData)}
                                                                            </Panel>
                                                                        </FormGroup>
                                                                    </TabItem>
                                                                )}
                                                                {!existingChangeRequest && createFeature && (
                                                                    <TabItem
                                                                      data-test="settings" tabLabel={(
                                                                          <Row className="justify-content-center">Settings {this.state.settingsChanged && (
                                                                          <div className="unread ml-2 px-1">
                                                                              {'*'}
                                                                          </div>
                                                                          )}
                                                                          </Row>
                                                                    )}
                                                                    >
                                                                        {Settings(projectAdmin, createFeature)}
                                                                        <JSONReference className="mx-4" showNamesButton title={"Feature"} json={projectFlag}/>

                                                                        {isEdit && (
                                                                            <div className="text-right mr-3">
                                                                                {createFeature ? (
                                                                                    <p className="text-right">
                                                                                        This will save the above settings <strong>all environments</strong>.
                                                                                    </p>
                                                                                ) : (
                                                                                    <p className="text-right">
                                                                                        To edit this feature's settings, you will need <strong>Project Administrator permissions</strong>. Please contact your project administrator.
                                                                                    </p>
                                                                                )}

                                                                                {createFeature ? (
                                                                                    <Button
                                                                                      onClick={saveSettings} data-test="update-feature-btn" id="update-feature-btn"
                                                                                      disabled={(isSaving || !name || invalid)}
                                                                                    >
                                                                                        {isSaving ? 'Updating' : 'Update Settings'}
                                                                                    </Button>
                                                                                ) : null}

                                                                            </div>
                                                                        )}
                                                                    </TabItem>
                                                                )}
                                                            </Tabs>
                                                        ) : (
                                                            <div className={classNames(!isEdit?"create-feature-tab":"")}>
                                                                {Value(projectAdmin, createFeature, project.prevent_flag_defaults)}
                                                                {!identity && (
                                                                    <div className="text-right mr-3">
                                                                        {project.prevent_flag_defaults ? (
                                                                            <p className="text-right">
                                                                                This will create the feature for <strong>all environments</strong>, you can edit this feature per environment once the feature's enabled state and environment once the feature is created.
                                                                            </p>
                                                                        ) : (
                                                                            <p className="text-right">
                                                                                This will create the feature for <strong>all environments</strong>, you can edit this feature per environment once the feature is created.
                                                                            </p>
                                                                        )}

                                                                        <Button
                                                                          onClick={onCreateFeature} data-test="create-feature-btn" id="create-feature-btn"
                                                                          disabled={isSaving || !name || invalid || !regexValid}
                                                                        >
                                                                            {isSaving ? 'Creating' : 'Create Feature'}
                                                                        </Button>
                                                                    </div>
                                                                )}

                                                            </div>
                                                        )}

                                                        {error && <Error error={error}/>}
                                                        {identity && (
                                                            <div className="pr-3">
                                                                {identity ? (
                                                                    <div className="mb-3">
                                                                        <p className="text-left ml-3">
                                                                            This will update the feature value for the user
                                                                            {' '}
                                                                            <strong>{identityName}</strong>
                                                                            {' '}
                                                                            in
                                                                            <strong>
                                                                                {' '}
                                                                                {
                                                                                    _.find(project.environments, { api_key: this.props.environmentId }).name
                                                                                }.
                                                                            </strong>
                                                                            {' Any segment overrides for this feature will now be ignored.'}
                                                                        </p>
                                                                    </div>
                                                                ) : ''}

                                                                <div className="text-right mb-2">
                                                                    {identity && (
                                                                        <div>
                                                                            <Button
                                                                              onClick={() => saveFeatureValue()} data-test="update-feature-btn" id="update-feature-btn"
                                                                              disabled={isSaving || !name || invalid}
                                                                            >
                                                                                {isSaving ? 'Updating' : 'Update Feature'}
                                                                            </Button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            }}
                                        </Permission>
                                    )}
                                </Permission>
                            );
                        }}

                    </Provider>
                )}
            </ProjectProvider>
        );
    }
};

CreateFlag.propTypes = {};

module.exports = ConfigProvider(withSegmentOverrides(CreateFlag));
