/**
 * Created by kylejohnson on 30/07/2016.
 */
import MaskedInput from 'react-maskedinput';
import cn from 'classnames';

const maskedCharacters = {
    'a': {
        validate(char) {
            return /[ap]/.test(char);
        },
    },
    'm': {
        validate(char) {
            return /\w/.test(char);
        },
        transform() {
            return 'm';
        },
    },
};
const Input = class extends React.Component {
    static displayName = 'Input'

    constructor(props, context) {
        super(props, context);
        this.state = { shouldValidate: !!this.props.value || this.props.autoValidate, type: this.props.type };
    }

    onFocus = (e) => {
        this.setState({
            isFocused: true,
        });
        this.props.onFocus && this.props.onFocus(e);
    }

    focus = () => {
        if (E2E) return;
        this.input.focus();
    }

    onKeyDown = (e) => {
        if (Utils.keys.isEscape(e)) {
            this.input.blur();
        }
        this.props.onKeyDown && this.props.onKeyDown(e);
    }

    validate = () => {
        this.setState({
            shouldValidate: true,
        });
    }

    onBlur = (e) => {
        this.setState({
            shouldValidate: true,
            isFocused: false,
        });
        this.props.onBlur && this.props.onBlur(e);
    }

    render() {
        const { isValid, showSuccess, onSearchChange, mask, placeholderChar, inputClassName, ...rest } = this.props;

        const invalid = this.state.shouldValidate && !isValid;
        const success = isValid && showSuccess;
        const className = cn({
            'input-container': true,
            success,
            'password': this.props.type === 'password',
            'focused': this.state.isFocused,
            invalid,
        }, this.props.className);

        const innerClassName = cn({
            input: true,
        }, inputClassName);

        return (
            <div
              className={className}
            >
                {mask ? (
                    <MaskedInput
                      ref={c => this.input = c}
                      {...rest}
                      mask={this.props.mask}
                      type={this.state.type}
                      formatCharacters={maskedCharacters}
                      onKeyDown={this.onKeyDown}
                      onFocus={this.onFocus}
                      onBlur={this.onBlur}
                      className={innerClassName}
                      placeholderChar={placeholderChar}
                    />
                ) : (
                    <input
                      ref={c => this.input = c}
                      {...rest} onFocus={this.onFocus}
                      onKeyDown={this.onKeyDown}
                      type={this.state.type}
                      onBlur={this.onBlur}
                      value={this.props.value}
                      className={innerClassName}
                    />
                )}
                {invalid && (
                    <span className={`input-icon-right text-danger icon ion ion-ios-close-circle-outline`}/>
                )}
                {success && (
                    <span className={`input-icon-right text-success icon ion ion-ios-checkmark-circle-outline`}/>
                )}
                {this.props.type === 'password' && (
                    <span onClick={() => this.setState({ type: this.state.type === 'password' ? 'text' : 'password' })} className={`input-icon-right icon ion ${this.state.type === 'text' ? 'ion-ios-eye-off' : 'ion-ios-eye'}`}/>
                )}
            </div>
        );
    }
};

Input.defaultProps = {
    className: '',
    placeholderChar: ' ',
    isValid: true,
};

Input.propTypes = {
    isValid: propTypes.any,
    onKeyDown: OptionalFunc,
    onFocus: OptionalFunc,
    onBlur: OptionalFunc,
    placeholderChar: OptionalString,
    mask: OptionalString,
    className: propTypes.any,
    inputClassName: OptionalString,
    onSearchChange: OptionalFunc,
};

module.exports = Input;
