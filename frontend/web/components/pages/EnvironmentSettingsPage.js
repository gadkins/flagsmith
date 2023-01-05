import React, { Component } from 'react';
import ConfirmRemoveEnvironment from '../modals/ConfirmRemoveEnvironment';
import ProjectStore from '../../../common/stores/project-store';
import ConfigProvider from '../../../common/providers/ConfigProvider';
import withWebhooks from '../../../common/providers/withWebhooks';
import CreateWebhookModal from '../modals/CreateWebhook';
import ConfirmRemoveWebhook from '../modals/ConfirmRemoveWebhook';
import EditPermissions from '../EditPermissions';
import ServerSideSDKKeys from '../ServerSideSDKKeys';
import PaymentModal from '../modals/Payment';
import Tabs from '../base/forms/Tabs'
import TabItem from '../base/forms/TabItem'
import { ColourSelect } from '../AddEditTags';
import JSONReference from "../JSONReference";
const EnvironmentSettingsPage = class extends Component {
    static displayName = 'EnvironmentSettingsPage'

    static contextTypes = {
        router: propTypes.object.isRequired,
    };

    constructor(props, context) {
        super(props, context);
        this.state = {};
        AppActions.getProject(this.props.match.params.projectId);
    }

    componentDidMount = () => {
        API.trackPage(Constants.pages.ENVIRONMENT_SETTINGS);
        this.props.getWebhooks();
    };

    onSave = () => {
        toast('Environment Saved');
    };

    componentWillReceiveProps(newProps) {
        if (newProps.projectId !== this.props.projectId) {
            AppActions.getProject(newProps.match.params.projectId);
        }
    }

    onRemove = () => {
        toast('Your project has been removed');
        this.context.router.history.replace('/projects');
    };

    confirmRemove = (environment, cb) => {
        openModal('Remove Environment', <ConfirmRemoveEnvironment
          environment={environment}
          cb={cb}
        />);
    };

    onRemoveEnvironment = () => {
        const envs = ProjectStore.getEnvs();
        if (envs && envs.length) {
            this.context.router.history.replace(`/project/${this.props.match.params.projectId}/environment` + `/${envs[0].api_key}/features`);
        } else {
            this.context.router.history.replace(`/project/${this.props.match.params.projectId}/environment/create`);
        }
    };

    saveEnv = (e) => {
        e && e.preventDefault();
        const { name, allow_client_traits, description } = this.state;
        if (ProjectStore.isSaving || (!name)) {
            return;
        }
        const has4EyesPermission = Utils.getPlansPermission('4_EYES');

        const env = _.find(ProjectStore.getEnvs(), { api_key: this.props.match.params.environmentId });
        AppActions.editEnv(Object.assign({}, env, {
            name: name || env.name,
            description: description || env.description,
            allow_client_traits: !!this.state.allow_client_traits,
            banner_text: this.state.banner_text,
            banner_colour: this.state.banner_colour,
            minimum_change_request_approvals: has4EyesPermission ? this.state.minimum_change_request_approvals : null,
        }));
    }

    saveDisabled = () => {
        const { name } = this.state;
        if (ProjectStore.isSaving || (!name)) {
            return true;
        }

        const env = _.find(ProjectStore.getEnvs(), { api_key: this.props.match.params.environmentId });

        // Must have name
        if (name !== undefined && !name) {
            return true;
        }

        return false;
    }

    createWebhook = () => {
        openModal('New Webhook', <CreateWebhookModal
          router={this.context.router}
          environmentId={this.props.match.params.environmentId}
          projectId={this.props.match.params.projectId}
          save={this.props.createWebhook}
        />, null, { className: 'alert fade expand' });
    };


    editWebhook = (webhook) => {
        openModal('Edit Webhook', <CreateWebhookModal
          router={this.context.router}
          webhook={webhook}
          isEdit
          environmentId={this.props.match.params.environmentId}
          projectId={this.props.match.params.projectId}
          save={this.props.saveWebhook}
        />, null, { className: 'alert fade expand' });
    };

    deleteWebhook = (webhook) => {
        openModal('Remove Webhook', <ConfirmRemoveWebhook
          environmentId={this.props.match.params.environmentId}
          projectId={this.props.match.params.projectId}
          url={webhook.url}
          cb={() => this.props.deleteWebhook(webhook)}
        />);
    };

    render() {
        const { props: { webhooks, webhooksLoading }, state: { name, allow_client_traits } } = this;
        const has4EyesPermission = Utils.getPlansPermission('4_EYES');

        return (
            <div className="app-container">
                <ProjectProvider
                  onRemoveEnvironment={this.onRemoveEnvironment}
                  id={this.props.match.params.projectId} onRemove={this.onRemove} onSave={this.onSave}
                >
                    {({ isLoading, isSaving, editProject, editEnv, deleteProject, deleteEnv, project }) => {
                        const env = _.find(project.environments, { api_key: this.props.match.params.environmentId });
                        if (env && (typeof this.state.minimum_change_request_approvals === 'undefined')) {
                            setTimeout(() => {
                                this.setState({
                                    name: env.name,
                                    banner_colour: env.banner_colour || Constants.tagColors[0],
                                    banner_text: env.banner_text,
                                    allow_client_traits: !!env.allow_client_traits,
                                    minimum_change_request_approvals: Utils.changeRequestsEnabled(env.minimum_change_request_approvals) ? env.minimum_change_request_approvals : null,
                                });
                            }, 10);
                        }
                        return (
                            <div className="container">
                                {isLoading && <div className="centered-container"><Loader/></div>}
                                {!isLoading && (
                                    <Tabs inline transparent uncontrolled>
                                        <TabItem tabLabel="General" tabIcon="ion-md-settings" >
                                            <div className="mt-4">
                                                <JSONReference title={"Environment"} json={env}/>
                                                <div>
                                                    <form onSubmit={this.saveEnv}>
                                                        <div className="row">
                                                            <div className="col-md-6">
                                                                <InputGroup
                                                                    ref={e => this.input = e}
                                                                    value={typeof this.state.name === 'string' ? this.state.name : env.name}
                                                                    inputProps={{ className: 'full-width', name: 'env-name' }}
                                                                    className="full-width"
                                                                    onChange={e => this.setState({ name: Utils.safeParseEventValue(e) })}
                                                                    isValid={name && name.length}
                                                                    type="text" title="Environment Name"
                                                                    placeholder="Environment Name"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="row">
                                                            <div className="col-md-6">
                                                                <InputGroup
                                                                    textarea
                                                                    ref={e => this.input = e}
                                                                    value={typeof this.state.description === 'string' ? this.state.description : env.description}
                                                                    inputProps={{ className: 'input--wide', style: { minHeight: 100 } }}
                                                                    onChange={e => this.setState({ description: Utils.safeParseEventValue(e) })}
                                                                    isValid={name && name.length}
                                                                    type="text" title="Environment Description"
                                                                    placeholder="Environment Description"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="row">
                                                            <div className="col-md-6 text-right">
                                                                <Button
                                                                    id="save-env-btn" className="float-right mb-4"
                                                                    disabled={this.saveDisabled()}
                                                                >
                                                                    {isSaving ? 'Updating' : 'Update'}
                                                                </Button>
                                                            </div>
                                                        </div>

                                                    </form>
                                                </div>
                                                <div>
                                                <Row space>
                                                    <div className="col-md-8 pl-0">
                                                        <h3 className="m-b-0">Environment Banner</h3>
                                                        <p className="mb-0">
                                                            This will show a banner whenever you view its pages, this is generally used to warn people that they are viewing and editing a sensitive environment.
                                                        </p>
                                                    </div>
                                                    <Switch
                                                        onChange={(value)=>this.setState({banner_text:value?env.name + " Environment":null}, this.saveEnv)}
                                                        checked={typeof this.state.banner_text === "string"}
                                                    />
                                                </Row>
                                                    {typeof this.state.banner_text === "string" && (
                                                        <Row className="mt-2">
                                                            <Input
                                                                style={{width:400}}
                                                                placeholder="Banner text"
                                                                value={this.state.banner_text}
                                                                onChange={(e)=>this.setState({banner_text:Utils.safeParseEventValue(e)})}
                                                            />
                                                            <div className="ml-2">
                                                                <ColourSelect value={this.state.banner_colour} onChange={(banner_colour)=>this.setState({banner_colour})}/>
                                                            </div>
                                                            <Button onClick={this.saveEnv} className="ml-2">
                                                                Save
                                                            </Button>
                                                        </Row>
                                                    )}
                                                </div>
                                                    <FormGroup className="mt-4">
                                                        <Row space>
                                                            <div className="col-md-8 pl-0">
                                                                <h3 className="m-b-0">Change Requests</h3>
                                                                {!has4EyesPermission ? (
                                                                    <p>
                                                                        View and manage your feature changes with a Change Request flow with our <a
                                                                        href="#" onClick={() => {
                                                                        openModal('Payment plans', <PaymentModal
                                                                            viewOnly={false}
                                                                        />, null, { large: true });
                                                                    }}
                                                                    >Scale-up plan
                                                                    </a>. Find out more <a href="https://docs.flagsmith.com/advanced-use/change-requests" target="_blank">here</a>.
                                                                    </p>
                                                                ) : (
                                                                    <p>
                                                                        Require a minimum number of people to approve changes to features.
                                                                        {' '}
                                                                        <ButtonLink
                                                                            href="https://docs.flagsmith.com/advanced-use/change-requests"
                                                                            target="_blank"
                                                                        >Learn about Change Requests.
                                                                        </ButtonLink>
                                                                    </p>
                                                                )}

                                                            </div>
                                                            <div className="col-md-4 pr-0 text-right">
                                                                <div>
                                                                    <Switch
                                                                        disabled={!has4EyesPermission} className="float-right" checked={has4EyesPermission && Utils.changeRequestsEnabled(this.state.minimum_change_request_approvals)}
                                                                        onChange={v => this.setState({ minimum_change_request_approvals: v ? 0 : null }, this.saveEnv)}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </Row>

                                                        {Utils.changeRequestsEnabled(this.state.minimum_change_request_approvals) && has4EyesPermission && (
                                                            <div>
                                                                <div className="mb-2">
                                                                    <strong>Minimum number of approvals</strong>
                                                                </div>
                                                                <Row>
                                                                    <Column className="m-l-0">
                                                                        <Input
                                                                            ref={e => this.input = e}
                                                                            value={`${this.state.minimum_change_request_approvals}`}
                                                                            inputClassName="input input--wide"
                                                                            name="env-name"
                                                                            min={0}
                                                                            style={{ minWidth: 50 }}
                                                                            onChange={(e) => {
                                                                                if (!Utils.safeParseEventValue(e)) return;
                                                                                this.setState({
                                                                                    minimum_change_request_approvals: parseInt(Utils.safeParseEventValue(e)),
                                                                                });
                                                                            }}
                                                                            isValid={name && name.length}
                                                                            type="number"
                                                                            placeholder="Minimum number of approvals"
                                                                        />
                                                                    </Column>
                                                                    <Button
                                                                        type="button"
                                                                        onClick={this.saveEnv}
                                                                        id="save-env-btn" className="float-right"
                                                                        disabled={this.saveDisabled() || isSaving || isLoading}
                                                                    >
                                                                        {isSaving || isLoading ? 'Saving' : 'Save'}
                                                                    </Button>
                                                                </Row>
                                                            </div>
                                                        )}
                                                            <Row className="mt-4" space>
                                                                <div className="col-md-8 pl-0">
                                                                    <h3 className="m-b-0">Allow client SDKs to set user traits</h3>
                                                                    <p>
                                                                        Disabling this option will prevent client SDKs from using the client key from setting traits.
                                                                    </p>
                                                                </div>
                                                                <div className="col-md-4 pr-0 text-right">
                                                                    <div>
                                                                        <Switch
                                                                            className="float-right" checked={allow_client_traits} onChange={(v) => {
                                                                            this.setState({ allow_client_traits: v }, this.saveEnv);
                                                                        }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </Row>
                                                    </FormGroup>
                                                <FormGroup className="mt-4">
                                                    <Row className="mt-4" space>
                                                        <div className="col-md-8 pl-0">
                                                            <h3>
                                                                Delete Environment
                                                            </h3>
                                                            <p>
                                                                This environment will be permanently deleted.
                                                            </p>
                                                        </div>
                                                        <Button
                                                            id="delete-env-btn"
                                                            onClick={() => this.confirmRemove(_.find(project.environments, { api_key: this.props.match.params.environmentId }), () => {
                                                                deleteEnv(_.find(project.environments, { api_key: this.props.match.params.environmentId }));
                                                            })}
                                                            className="btn btn--with-icon ml-auto btn--remove"
                                                        >
                                                            <RemoveIcon/>
                                                        </Button>
                                                    </Row>
                                                </FormGroup>
                                            </div>

                                        </TabItem>
                                        <TabItem tabLabel="Keys" tabIcon="ion-md-key" >
                                            <FormGroup className="mt-4">
                                                <h3>Client-side Environment Key</h3>
                                                <div className="row">
                                                    <div className="col-md-6">
                                                        <Row>
                                                            <Flex>
                                                                <Input
                                                                    value={this.props.match.params.environmentId}
                                                                    inputClassName="input input--wide"
                                                                    type="text" title={<h3>Client-side Environment Key</h3>}
                                                                    placeholder="Client-side Environment Key"
                                                                />
                                                            </Flex>
                                                            <Button
                                                                onClick={() => {
                                                                    navigator.clipboard.writeText(this.props.match.params.environmentId);
                                                                    toast('Copied');
                                                                }} className="ml-2"
                                                            >
                                                                Copy
                                                            </Button>
                                                        </Row>
                                                    </div>
                                                </div>
                                            </FormGroup>
                                            <ServerSideSDKKeys environmentId={this.props.match.params.environmentId}/>
                                        </TabItem>
                                        <TabItem tabLabel="Members" tabIcon="ion-md-people" >
                                            <FormGroup>
                                                <EditPermissions
                                                    tabClassName="flat-panel"
                                                    parentId={this.props.match.params.projectId}
                                                    parentLevel="project"
                                                    parentSettingsLink={`/project/${this.props.match.params.projectId}/settings`}
                                                    id={this.props.match.params.environmentId}
                                                    level="environment"
                                                />
                                            </FormGroup>
                                        </TabItem>
                                        <TabItem tabLabel="Webhooks" tabIcon="ion-md-cloud" >
                                            <FormGroup className="mt-4">
                                                <Row className="mb-3" space>
                                                    <div className="col-md-8 pl-0">
                                                        <h3 className="m-b-0">Feature Webhooks</h3>
                                                        <p>
                                                            Feature webhooks let you know when features have changed. You
                                                            can configure 1 or more Feature Webhooks per Environment.
                                                            {' '}
                                                            <ButtonLink
                                                                href="https://docs.flagsmith.com/advanced-use/system-administration#web-hooks"
                                                                target="_blank"
                                                            >Learn about Feature Webhooks.
                                                            </ButtonLink>
                                                        </p>
                                                    </div>
                                                    <div className="col-md-4 pr-0">
                                                        <Button className="float-right" onClick={this.createWebhook}>
                                                            Create feature webhook
                                                        </Button>
                                                    </div>
                                                </Row>
                                                {webhooksLoading && !webhooks ? (
                                                    <Loader/>
                                                ) : (
                                                    <PanelSearch
                                                        id="webhook-list"
                                                        title={(
                                                            <Tooltip
                                                                title={(
                                                                    <h6 className="mb-0">Webhooks <span
                                                                        className="icon ion-ios-information-circle"
                                                                    />
                                                                    </h6>
                                                                )}
                                                                place="right"
                                                            >
                                                                {Constants.strings.WEBHOOKS_DESCRIPTION}
                                                            </Tooltip>
                                                        )}
                                                        className="no-pad"
                                                        icon="ion-md-cloud"
                                                        items={webhooks}
                                                        renderRow={webhook => (
                                                            <Row
                                                                onClick={() => {
                                                                    this.editWebhook(webhook);
                                                                }} space className="list-item clickable cursor-pointer"
                                                                key={webhook.id}
                                                            >
                                                                <div>
                                                                    <ButtonLink>
                                                                        {webhook.url}
                                                                    </ButtonLink>
                                                                    <div className="list-item-footer faint">
                                                                        Created
                                                                        {' '}
                                                                        {moment(webhook.created_date).format('DD/MMM/YYYY')}
                                                                    </div>
                                                                </div>
                                                                <Row>
                                                                    <Switch checked={webhook.enabled}/>
                                                                    <button
                                                                        id="delete-invite"
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            e.preventDefault();
                                                                            this.deleteWebhook(webhook);
                                                                        }}
                                                                        className="btn btn--with-icon ml-auto btn--remove"
                                                                    >
                                                                        <RemoveIcon/>
                                                                    </button>
                                                                </Row>
                                                            </Row>
                                                        )}
                                                        renderNoResults={(
                                                            <Panel
                                                                id="users-list"
                                                                icon="ion-md-cloud"
                                                                title={(
                                                                    <Tooltip
                                                                        title={(
                                                                            <h6 className="mb-0">Webhooks <span
                                                                                className="icon ion-ios-information-circle"
                                                                            />
                                                                            </h6>
                                                                        )}
                                                                        place="right"
                                                                    >
                                                                        {Constants.strings.WEBHOOKS_DESCRIPTION}
                                                                    </Tooltip>
                                                                )}
                                                            >
                                                                You currently have no Feature Webhooks configured for this
                                                                Environment.
                                                            </Panel>
                                                        )}
                                                        isLoading={this.props.webhookLoading}
                                                    />
                                                )}
                                            </FormGroup>
                                        </TabItem>
                                    </Tabs>

                                )}
                            </div>
                        );
                    }}
                </ProjectProvider>
            </div>
        );
    }
};

EnvironmentSettingsPage.propTypes = {};

module.exports = ConfigProvider(withWebhooks(EnvironmentSettingsPage));
