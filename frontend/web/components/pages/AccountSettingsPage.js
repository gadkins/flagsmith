// import propTypes from 'prop-types';
import React, { Component } from 'react';
import Button from '../base/forms/Button';
import ErrorMessage from '../ErrorMessage';
import _data from '../../../common/data/base/_data';
import ConfigProvider from '../../../common/providers/ConfigProvider';
import TwoFactor from '../TwoFactor';
import PaymentModal from '../modals/Payment';
import Token from '../Token';
import Tabs from '../base/forms/Tabs'
import TabItem from '../base/forms/TabItem'
import JSONReference from "../JSONReference";
class TheComponent extends Component {
    static displayName = 'TheComponent';

    static propTypes = {};

    constructor(props) {
        super(props);
        this.state = {
            ...AccountStore.getUser(),
        };
    }

    componentDidMount() {

    }

    save = (e) => {
        Utils.preventDefault(e);
        const { state: {
            first_name,
            last_name,
            error,
            isSaving,
            email,
        } } = this;
        if (isSaving || !first_name || !last_name) {
            return;
        }
        // _data.patch(`${Project.api}auth/users/me/`, {
        _data.put(`${Project.api}auth/users/me/`, {
            first_name,
            last_name,
            email,
            id: AccountStore.model.id,
        }).then(() => {
            toast('Your account has been updated');
        }).catch(error => this.setState({ error: 'There was an error setting your account, please check your details' }));
    }

    invalidateToken = ()=> {
            openConfirm("Invalidate Token", (
                <div>
                    Invalidating your token will generate a new token to use with our API, <strong>your current token will no longer work</strong>. Performing this action will also log you out, are you sure you wish to do this?
                </div>
            ),()=>{
                _data.delete(`${Project.api}auth/token/`).then(()=>{
                    AppActions.logout()
                })
            })
    }

    savePassword = (e) => {
        Utils.preventDefault(e);
        const { state: {
            current_password,
            new_password1,
            new_password2,
        } } = this;
        if (!current_password || !new_password1 || !new_password2 || (new_password2 !== new_password1)) {
            return;
        }
        // _data.post(`${Project.api}auth/users/set_password/`, {
        _data.post(`${Project.api}auth/users/set_password/`, {
            current_password,
            new_password: new_password1,
            re_new_password: new_password2,
        }).then(() => {
            toast('Your password has been updated');
        }).catch(passwordError => this.setState({ passwordError: 'There was an error setting your password, please check your details.' }));
    }

    render() {
        const { state: {
            first_name,
            last_name,
            error,
            isSaving,
            current_password,
            new_password1,
            new_password2,
            passwordError,
            email,
        } } = this;

        return (
            <AccountProvider>
                {({ isSaving, user }, { enableTwoFactor, disableTwoFactor, confirmTwoFactor }) => {
                    const forced2Factor = AccountStore.forced2Factor();
                    const has2fPermission = Utils.getPlansPermission('2FA');

                    return forced2Factor ? (
                        <div className="app-container container">
                            <h3>
                                Two-Factor Authentication
                            </h3>
                            <p>
                                One of your organisations has enfoced Two-Factor Authentication, please enable it to continue.
                            </p>
                            <TwoFactor/>
                        </div>
                    ) : (
                        <div className="app-container container">
                            <Tabs inline transparent uncontrolled>
                                <TabItem tabLabel="General" tabIcon="ion-md-settings" >
                                    <div className="mt-4">
                                        <JSONReference showNamesButton title={"User"} json={AccountStore.getUser()}/>
                                        <div className="col-md-8">
                                            <form className="mb-4" onSubmit={this.save}>
                                                <InputGroup
                                                    className="mt-2"
                                                    title="Email Address"
                                                    data-test="firstName"
                                                    inputProps={{
                                                        className: 'full-width',
                                                        name: 'groupName',
                                                        readOnly: true,
                                                    }}
                                                    value={email}
                                                    onChange={e => this.setState({ first_name: Utils.safeParseEventValue(e) })}
                                                    type="text"
                                                    name="Email Address"
                                                />
                                                <InputGroup
                                                    className="mt-2"
                                                    title="First Name"
                                                    data-test="firstName"
                                                    inputProps={{
                                                        className: 'full-width',
                                                        name: 'groupName',
                                                    }}
                                                    value={first_name}
                                                    onChange={e => this.setState({ first_name: Utils.safeParseEventValue(e) })}
                                                    isValid={first_name && first_name.length}
                                                    type="text"
                                                    name="First Name*"
                                                />
                                                <InputGroup
                                                    className="mt-2"
                                                    title="Last Name"
                                                    data-test="lastName"
                                                    inputProps={{
                                                        className: 'full-width',
                                                        name: 'groupName',
                                                    }}
                                                    value={last_name}
                                                    onChange={e => this.setState({ last_name: Utils.safeParseEventValue(e) })}
                                                    isValid={last_name && last_name.length}
                                                    type="text"
                                                    name="Last Name*"
                                                />
                                                {error && (
                                                    <ErrorMessage>
                                                        {error}
                                                    </ErrorMessage>
                                                )}
                                                <div className="text-right mt-2">
                                                    <Button type="submit" disabled={isSaving || !first_name || !last_name}>
                                                        Save Details
                                                    </Button>
                                                </div>

                                            </form>
                                            <Row>
                                                <Flex>
                                                    <h5>Show JSON References</h5>
                                                    <p>
                                                        Enabling this will allow you to inspect the JSON of entities such as features within the platform.
                                                    </p>
                                                </Flex>
                                                <Switch
                                                    onChange={(v)=>{
                                                        flagsmith.setTrait("json_inspect", v).then(()=>{
                                                            toast("Updated")
                                                        })
                                                    }}
                                                    checked={flagsmith.getTrait("json_inspect")}/>
                                            </Row>
                                        </div>
                                    </div>
                                </TabItem>
                                <TabItem tabLabel="Keys" tabIcon="ion-md-key" >
                                    <div className="mt-4">
                                        <div className="col-md-12">
                                            <h5>API Token</h5>
                                            <p>
                                                You can use this token to integrate with our RESTful API, the documentation can be found <a href="https://api.flagsmith.com/api/v1/docs/">here</a>.
                                            </p>
                                        </div>
                                        <div className="col-md-12">
                                            <Row>
                                                <Token style={{ width: 400 }} token={_data.token}/>
                                                <Button onClick={this.invalidateToken}
                                                        className="btn btn-danger">
                                                    Invalidate
                                                </Button>
                                            </Row>
                                        </div>
                                    </div>
                                </TabItem>
                                <TabItem tabLabel="Security" tabIcon="ion-md-shield" >
                                    <div className="mt-4">
                                        {AccountStore.model.auth_type === 'EMAIL' && (
                                            <div className="row">
                                                <div className="col-md-12">
                                                    <h5>Change password</h5>
                                                </div>
                                                <div className="col-md-8">
                                                    <form className="mb-4" onSubmit={this.savePassword}>
                                                        <InputGroup
                                                            className="mt-2"
                                                            title="Current Password"
                                                            data-test="currentPassword"
                                                            inputProps={{
                                                                className: 'full-width',
                                                                name: 'groupName',
                                                            }}
                                                            value={current_password}
                                                            onChange={e => this.setState({ current_password: Utils.safeParseEventValue(e) })}
                                                            isValid={current_password && current_password.length}
                                                            type="password"
                                                            name="Current Password*"
                                                        />
                                                        <InputGroup
                                                            className="mt-2"
                                                            title="New Password"
                                                            data-test="newPassword"
                                                            inputProps={{
                                                                className: 'full-width',
                                                                name: 'groupName',
                                                            }}
                                                            value={new_password1}
                                                            onChange={e => this.setState({ new_password1: Utils.safeParseEventValue(e) })}
                                                            isValid={new_password1 && new_password1.length}
                                                            type="password"
                                                            name="New Password*"
                                                        />
                                                        <InputGroup
                                                            className="mt-2"
                                                            title="Confirm New Password"
                                                            data-test="newPassword"
                                                            inputProps={{
                                                                className: 'full-width',
                                                                name: 'groupName',
                                                            }}
                                                            value={new_password2}
                                                            onChange={e => this.setState({ new_password2: Utils.safeParseEventValue(e) })}
                                                            isValid={new_password2 && new_password2.length}
                                                            type="password"
                                                            name="Confirm New Password*"
                                                        />
                                                        {passwordError && (
                                                            <ErrorMessage>
                                                                {passwordError}
                                                            </ErrorMessage>
                                                        )}
                                                        <div className="text-right mt-2">
                                                            <Button type="submit" disabled={isSaving || !new_password2 || !new_password1 || !current_password || (new_password1 !== new_password2)}>
                                                                Save Password
                                                            </Button>
                                                        </div>
                                                    </form>
                                                </div>
                                            </div>
                                        )}
                                        <div>
                                            <h5>Two-Factor Authentication</h5>
                                            <p>
                                                Increase your account's security by enabling Two-Factor Authentication (2FA).
                                            </p>
                                        </div>
                                        <div className="col-md-6 col-sm-12">
                                            {has2fPermission ? <TwoFactor/> : (
                                                <div className="text-right">
                                                    <button
                                                        type="button" className="btn btn-primary text-center ml-auto mt-2 mb-2"
                                                        onClick={() => {
                                                            openModal('Payment plans', <PaymentModal
                                                                viewOnly={false}
                                                            />, null, { large: true });
                                                        }}
                                                    >
                                                        Manage payment plan
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </TabItem>
                            </Tabs>
                        </div>
                    );
                }}

            </AccountProvider>
        );
    }
}

export default ConfigProvider(TheComponent);
