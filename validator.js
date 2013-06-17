/*****************************************************************************/
/* Script   : JavaScript form validator (version 1.0)                        */
/* Author(s): Walter Horstman (WH)                                           */
/* Requires : Prototype 1.6.1 (http://www.prototypejs.org)                   */
/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - */
/* Revision history:                                                         */
/* 2009/12/31: Made final (version 1.0) (WH)                                 */
/* 2009/12/31: Bugfix for minValue() and maxValue() (WH)                     */
/* 2008/02/07: Bugfix for positioning message and/or image (WH)              */
/* 2008/02/06: First (beta) release (WH)                                     */
/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - */
/* Explanation:                                                              */
/* Add special class names on each field you want to have validated. Submit  */
/* the form using validator.submit(formElement) to make sure it's valid      */
/* before it gets submitted.                                                 */
/*                                                                           */
/* These special class names can be used to check if a field is:             */
/* - filled in: "required"                                                   */
/* - longer than a maximum length: "maxLength:<length>"                      */
/* - shorter than a minimum length: "minLength:<length>"                     */
/* - numeric: "numeric"                                                      */
/* - lower than a given value: "maxValue:<value>"                            */
/* - higher than a given value: "minValue:<value>"                           */
/* - a date: "date"                                                          */
/* - an email address: "email"                                               */
/* - a confirmation of another field: "confirmation:<other field's id>"      */
/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - */
/* TODO:                                                                     */
/* - figure out a (better) way of displaying errors for check boxes and      */
/*   radio buttons (if at all necessary)                                     */
/* - replace isNumeric() with numberToString() and stringToNumber()          */
/*****************************************************************************/

var Validator = Class.create({

    /**
     * Initializes a validator object by adding observers to each field of
     * forms with a certain class name (by default "validateable"). The
     * validator can be configured via the config parameter, which should be a
     * hash that can contain the following keys:
     * - validators: hash with validators (like Validator.defaultValidators)
     * - options   : hash with options (like Validator.defaultOptions)
     * - country   : 2 character uppercased country code (eg. "GB", "NL", "US")
     * - language  : 2 character lowercased language code (eg. "en", "nl")
     */
    initialize: function (config) {
        this.fields = [];
        this.validators = Validator.defaultValidators;
        this.options = Validator.defaultOptions;

        config = $H(config || {});

        // merge given validators, options, country specific options and
        // language specific options
        this.setValidators(config.get("validators"));
        this.setCountryOptions(config.get("country"));
        this.setLanguageOptions(config.get("language"));
        this.setOptions(config.get("options"));

        this.cssPrefix = this.options.get("cssPrefix");

        // each form is checked for the trigger class (which can be set via an
        // option, but defaults to "validateable"); if this class is set, the
        // method addObserversToField will be called (with the field as argument)
        $$("form").each(function (frm) {
            if (!this.options.get("triggerClass") || frm.hasClassName(this.options.get("triggerClass"))) {
                frm.getElements().each(this.addObserversToField.bind(this));

            }
        }.bind(this));
    },

    /**
     * Three event types can be observed for a field: one that occurs when an
     * error should be hidden, one that occurs when an error should be shown
     * and one that occurs when a field should be validated.
     *
     * This method adds the observers for each event type to the field, but
     * only if the field is a select box, a text area or an input field that is
     * a check box, radio button, text field or password field.
     *
     * Which events should be observed, is defined by the options "hidesOn",
     * "showsOn", "validatesOn". The behavior (what should happen) is defined
     * by the options "hideObserver", "showObserver" and "validateObserver".
     */
    addObserversToField: function (field) {
        if ($w("SELECT TEXTAREA").indexOf(field.tagName) !== -1 || (field.tagName === "INPUT" && $w("checkbox radio text password").indexOf(field.type) !== -1)) {
            this.fields.push(field);
            $w("hide show validate").each(function (observerType) {
                var observers = this.options.get(observerType + "sOn");
                if (observers) {
                    observers.each(function (observer) { 
                        field.observe(observer, this.options.get(observerType + "Observer").bindAsEventListener(this));
                        // server side errors should be validated immediately
                        if (this.options.get("useTitles") && !field.title.empty()) {
                            this.validateField(field, true);
                        }
                    }.bind(this));
                }
            }.bind(this));
        }
    },

    /**
     * Creates a container below the field (or its label when the field is a
     * check box or radio button) with the error message(s). The container will
     * not be displayed (yet).
     */
    createError: function (field, errors) {
        // add an error class to the error object
        var errorObject = this.getErrorObject(field) || field;
        errorObject.addClassName(this.cssPrefix + "-error-field");

        if (this.options.get("messagePosition")) {
            errorObject.insert({
                after: new Element("div", {
                    id: errorObject.id + "ErrorMessage",
                    className: this.cssPrefix + "-error-message-left",
                    style: "display: none; position: absolute;"
                }).update("<div class=\"" + this.cssPrefix + "-error-message-right" + "\">" +
                  "<div class=\"" + this.cssPrefix + "-error-message-center" + "\">" +
                  errors.join(this.options.get("errorSeparator")) + "</div></div>")
            });
        }

        if (this.options.get("imagePosition")) {
            errorObject.insert({
                after: new Element("div", {
                    id: errorObject.id + "ErrorImage",
                    className: this.cssPrefix + "-error-image",
                    style: "display: none; position: absolute;"
                })
            });
        }
    },

    /**
     * Converts a date to a string, using the given date format.
     */
    dateToString: function (date, format) {
        var result = format;

        // replace the format specifiers with real values
        format.match(/(d+|m+|y+)/gi).uniq().each(function (match) {
            switch (match) {
                case "d":
                    result = result.gsub(match, date.getDate());
                    break;
                case "dd":
                    result = result.gsub(match, date.getDate().toPaddedString(2));
                    break;
                case "m":
                    result = result.gsub(match, date.getMonth() + 1);
                    break;
                case "mm":
                    result = result.gsub(match, (date.getMonth() + 1).toPaddedString(2));
                    break;
                case "mmm":
                    result = result.gsub(match, this.options.get("monthsAbbreviated")[date.getMonth()].toLowerCase());
                    break;
                case "MMM":
                    result = result.gsub(match, this.options.get("monthsAbbreviated")[date.getMonth()].toUpperCase());
                    break;
                case "Mmm":
                    result = result.gsub(match, this.options.get("monthsAbbreviated")[date.getMonth()]);
                    break;
                case "mmmmm":
                    result = result.gsub(match, this.options.get("months")[date.getMonth()].toLowerCase());
                    break;
                case "MMMMM":
                    result = result.gsub(match, this.options.get("months")[date.getMonth()].toUpperCase());
                    break;
                case "Mmmmm":
                    result = result.gsub(match, this.options.get("months")[date.getMonth()]);
                    break;
                case "y":
                    result = result.gsub(match, date.getFullYear());
                    break;
                case "yy":
                    result = result.gsub(match, date.getFullYear().toPaddedString(4).substr(-2));
                    break;
                case "yyyy":
                    result = result.gsub(match, date.getFullYear().toPaddedString(4));
                    break;
            }
        }.bind(this));
        return result;
    },

    /**
     * Returns the object (the given field or its label) to which the error
     * message and/or icon should be positioned to.
     */
    getErrorObject: function (field) {
        return ($w("checkbox radio").indexOf(field.type) !== -1) ? this.getLabel(field) : field;
    },

    /**
     * Returns the label for the given field (or null if it can't be found).
     */
    getLabel: function (field) {
        var labels = $$("label[for=" + field.id + "]");
        return labels ? labels.first() : null;
    },

    /**
     * Checks if a value is a number.
     */
    isNumeric: function (value) {
        // if there's a group separator in the value, check more strict
        var decimalPart = (value.indexOf(this.options.get("groupSeparator")) !== -1) ? "\\d{1,3}(" + this.options.get("groupSeparator").replace(".", "\\.") + "\\d{3})*" : "\\d+";
        var re = new RegExp("^[-+]?" + decimalPart + "(" + this.options.get("decimalSeparator").replace(".", "\\.") + "\\d+)?$");
        return re.test(value);
    },

    /**
     * Validates all fields of a form and returns whether they are all valid.
     */
    isValid: function (frm, showMarkup) {
        return this.fields.all(function (field) {
            return (frm !== field.form) || this.validateField(field, showMarkup);
        }.bind(this));
    },

    /**
     * Removes the error message and/or image.
     */
    removeError: function (field) {
        var errorObject = this.getErrorObject(field) || field;
        errorObject.removeClassName(this.cssPrefix + "-error-field");
        this.removeErrorObject($(errorObject.id + "ErrorMessage"));
        this.removeErrorObject($(errorObject.id + "ErrorImage"));
    },

    /**
     * Helper method for removeError().
     */
    removeErrorObject: function (element) {
        if (element) {
            element.remove();
        }
    },

    /**
     * Sets default options for given country, which defaults to Great Britain.
     */
    setCountryOptions: function (country) {
        this.options.update(Validator.defaultCountryOptions.get(country || "GB"));
    },

    /**
     * Sets default options for given language, which defaults to English.
     */
    setLanguageOptions: function (language) {
        this.options.update(Validator.defaultLanguageOptions.get(language || "en"));
    },

    /**
     * Sets the options specified by the given options hash. It can override
     * any option of the Validator.defaultOptions hash.
     */
    setOptions: function (options) {
        this.options.update(options);
    },

    /**
     * Sets the validators specified by the given validators hash. It can add
     * validators or override any validator of the Validator.defaultValidators
     * hash.
     */
    setValidators: function (validators) {
        this.validators.update(validators);
    },

    /**
     * Shows the error message and/or image.
     */
    showError: function (field) {
        var errorObject = this.getErrorObject(field) || field;
        if (this.options.get("messagePosition")) {
            this.showErrorObject($(errorObject.id + "ErrorMessage"), errorObject, this.options.get("messagePosition"));
        }
        if (this.options.get("imagePosition")) {
            this.showErrorObject($(errorObject.id + "ErrorImage"), errorObject, this.options.get("imagePosition"));
        }
    },

    /**
     * Helper method for showError().
     */
    showErrorObject: function (element, errorObject, position) {
        if (element && !element.visible()) {
            var p = errorObject.cumulativeOffset();
            var q = element.getOffsetParent().cumulativeOffset();
            element.setStyle({
                left: (p[0] - q[0] + ((position === "right") ? errorObject.getWidth() : ((position === "left") ? -element.getWidth() : 0))) + "px",
                top: (p[1] - q[1] + ((position === "bottom") ? errorObject.getHeight() : ((position === "top") ? -element.getHeight() : 0))) + "px"
            });
            element.show();
        }
    },

    /**
     * Converts a string to a date, using the given date formats; if the string
     * can't be parsed, it returns null (so this means an invalid date).
     */
    stringToDate: function (string, formats) {
        var result = null;
        formats.each(function (format) {
            var date = new Date();
            var day = date.getDate();
            var month = date.getMonth();
            var year = date.getFullYear();

            // names of months are parsed case insensitive
            var formatMatches = format.toLowerCase().match(/(d+|m+|y+|[\W]+)/g);
            var stringMatches = string.toLowerCase().match(/(\w+|\W+)/g);

            // only parse when value and format have equal number of parts
            if (formatMatches.length === stringMatches.length) {
                var okay = formatMatches.all(function (fm, i) {
                    var sm = stringMatches[i];
                    switch (fm) {
                        case "d":
                        case "dd":
                            day = sm.match(/^\d{1,2}$/) ? parseInt(sm, 10) : -1;
                            break;
                        case "m":
                        case "mm":
                            month = sm.match(/^\d{1,2}$/) ? parseInt(sm, 10) - 1 : - 1;
                            break;
                        case "mmm":
                            // the iterator returns an array with abbreviated
                            // month names lower cased
                            month = this.options.get("monthsAbbreviated").collect(function (m) {
                                return m.toLowerCase();
                            }).indexOf(sm);
                            break;
                        case "mmmmm":
                            // the iterator returns an array with month names
                            // lower cased
                            month = this.options.get("months").collect(function (m) {
                                return m.toLowerCase();
                            }).indexOf(sm);
                            break;
                        // add current century to given year
                        case "yy":
                            year = sm.match(/^\d{2}$/) ? 100 * Math.floor(year / 100) + parseInt(sm, 10) : -1;
                            break;
                        case "y":
                        case "yyyy":
                            year = sm.match(/^\d{1,4}$/) ? parseInt(sm, 10) : -1;
                            break;

                        // field separators should be equal
                        default:
                            if (fm !== sm) {
                                return false;
                            }
                    }
                    return (day !== -1 && month !== -1 && year !== -1);
                }.bind(this));

                if (okay) {
                    // if a too large day (or month) is given, Javascript
                    // automatically adds months (or years) to the date; we
                    // don't want to allow this, therefore we check each date
                    // component once more
                    // TODO: there is an issue when a year is given as 1 digit;
                    //       in this case it should be a year before 10 AD, but
                    //       it is not (it is most likely something like 19xx)
                    date = new Date(year, month, day);
                    if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
                        result = date;
                        throw $break;
                    }
                }
            }
        }.bind(this));
        return result;
    },

    stringToNumber: function (string) {
        return null;
    },
    
    /**
     * Submits the given form if all its fields are valid. It returns whether
     * all fields are valid.
     */
    submit: function (frm) {
        if (this.isValid(frm, true) && !this.alreadySubmitted) {
            this.alreadySubmitted = true;
            frm.submit();
            return true;
        }
        return false;
    },

    /**
     * Validates given field. It checks the classes on the field to see which
     * validations should be done. It returns if the field is valid or not.
     *
     * Set showMarkup to true to make the error visible (setting it to false
     * only checks for errors).
     */
    validateField: function (field, showMarkup) {
        var container;
        var errors = [];

        // when a title is defined on the field, it will be used as error(s),
        // unless otherwise configured; this is useful for server side
        // validation (eg. unique values); multiple errors can be separated by
        // a configurable separator)
        if (!field.disabled) {
            if (!field.title.empty() && this.options.get("useTitles")) {
                errors = field.title.split(this.options.get("titleSeparator"));
            }

            // remove whitespace (unless otherwise specified via options)
            if (field.tagName === "INPUT" && $w("text password").indexOf(field.type) !== -1 && this.options.get("stripFields") && !field.hasClassName(this.options.get("stripFieldsSkipClass"))) {
                field.value = $F(field).strip();
            }

            // check if one of the validators should be triggered (based on the
            // current classes on the field)
            this.validators.each(function (validator) {
                // stop validating after first error (unless otherwise
                // specified)
                if (errors.length > 0 && this.options.get("firstMessageOnly")) {
                    throw $break;
                }

                // don't use hasClassName, because some class names include
                // values (eg. maxLength); also make sure that these values are
                // not interpreted as a special class name (by checking if an
                // colon is in front of it)
                var position = field.className.indexOf(validator.key);
                if (position !== -1 && (position === 0 || field.className.charAt(position - 1) !== ":")) {
                    var message = validator.value.bind(this)(field);
                    if (!message.empty()) {
                        errors.push(message);
                    }
                }
            }.bind(this));

            // if showMarkup is true, add error class and message(s)
            if (showMarkup) {
                // always remove an existing error class and error container
                this.removeError(field);

                // if any errors, show error class name and create error container
                if (errors.length > 0) {
                    this.createError(field, errors);
                }
            }
        }

        // empty errors array means valid field
        return (errors.length === 0);
    }
});

Validator.defaultOptions = $H({
    cssPrefix: "validator",          // css prefix for all CSS classes used by the validator
    errorSeparator: "<br />",        // separator between each displayed error (only when firstMessageOnly is false)
    firstMessageOnly: true,          // should only the first message be shown?
    hideObserver: function (e) {      // is invoked for each event defined by hidesOn
        this.removeError(Event.element(e));
    },
    hidesOn: $w("keypress"),         // array of events that should hide errors; set to null to prevent firing
    imagePosition: "right",          // position of error image (in relation to the field): left, right, top or bottom
    messagePosition: "bottom",       // position of error message box (in relation to the field): left, right, top or bottom
    showObserver: function (e) {      // is invoked for each event defined by showsOn
        this.showError(Event.element(e));
    },
    showsOn: $w("focus"),            // array of events that should show errors; set to null to prevent firing
    stripFields: true,               // should leading and trailing white spaces be removed before validation?
    stripFieldsSkipClass: "noStrip", // class name to avoid removing leading and trailing white spaces on an individual field (only when stripFields is true)
    stripNonDigits: true,            // should non digits be removed before validation? (used for validation of phone numbers)
    titleSeparator: "|",             // if useTitles is true, the separator is used to specify multiple server side generated errors
    triggerClass: "validateable",    // each form that is to be validated, needs to have this class name (so only fields on these forms will be validated); set to null to always validate all forms
    useTitles: true,                 // should field's title be used to server side generated errors
    validateObserver: function (e) {  // is invoked for each event defined by validatesOn
        this.validateField(Event.element(e), true);
    },
    validatesOn: $w("blur")          // array of events that should validate fields; set to null to prevent firing
});

Validator.defaultCountryOptions = $H({
    GB: $H({
        dateFormat: "yyyy/mm/dd", // format of date fields (parsed values will be converted to this)
                                  // valid date formats for parsing of date fields
        validDateFormats: ["yy/m/d", "y/m/d", "yy-m-d", "y-m-d", "m/d", "m-d", "d", "d-mmm-yy", "d-mmm-y", "d mmmmm yy", "d mmmmm y", "d mmm yy", "d mmm y"],
        decimalSeparator: ".",    // separator between decimal and fractial part of numbers
        groupSeparator: ","       // separator between thousand factors of numbers
    }),
    NL: $H({
        dateFormat: "dd-mm-yyyy",
        validDateFormats: ["d-m-yy", "d-m-y", "d/m/yy", "d/m/y", "d-m", "d/m", "d", "d-mmm-yy", "d-mmm-y", "d mmmmm yy", "d mmmmm y", "d mmm yy", "d mmm y"],
        decimalSeparator: ",",
        groupSeparator: "."
    })
});

Validator.defaultLanguageOptions = $H({
    en: $H({
        // month names
        months: $w("January February March April May June July August September October November December"),

        // abbreviated month names
        monthsAbbreviated: $w("Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec"),

        // message to display when a field isn't a confirmation of an other
        // field; define an optional message part between "[" and "]", that
        // gets displayed when the field that needs to be confirmed has a
        // label; all occurances of "#{label}" in this optional message
        // part are substituted by the label's content
        msgConfirmation: "Field should be a confirmation[ of &quot;#{label}&quot;]",

        // message to display when date validation fails
        msgDate: "Field should be a date (YYYY/MM/DD)",

        // message to display when a field isn't an e-mail address
        msgEmail: "Field should be an e-mail address",

        // message to display when a field has too many characters; all
        // occurances of "#{maxLength}" and "#{length}" in this message
        // will be substituted by the maximum length and the field's length
        msgMaxLength: "Value is too long (maximum length is #{maxLength}, length is #{length})",

        // message to display when a field has a value that is too high;
        // all occurances of "#{maxValue}" and "#{value}" in this message
        // will be substituted by the maximum value and the field's value
        msgMaxValue: "Value is too high (maximum value is #{maxValue}, value is #{value})",

        // message to display when a field has too little characters;
        // all occurances of "#{minLength}" and "#{length}" in this message
        // will be substituted by the minimum length and the field's length
        msgMinLength: "Value is too short (minimum length is #{minLength}, length is #{length})",

        // message to display when a field has a value that is too low;
        // all occurances of "#{minValue}" and "#{value}" in this message
        // will be substituted by the minimum value and the field's value
        msgMinInteger: "Value is too low (minimum value is #{minValue}, value is #{value})",

        // message to display when numeric validation fails
        msgNumeric: "Field is not numeric",
        // message to display when required validation fails
        msgRequired: "Field is required"
    }),
    nl: $H({
        months: $w("Januari Februari Maart April Mei Juni Juli Augustus September Oktober November December"),
        monthsAbbreviated: $w("Jan Feb Mar Apr Mei Jun Jul Aug Sep Okt Nov Dec"),
        msgConfirmation: "Veld moet een bevestiging zijn[ van &quot;#{label}&quot;]",
        msgDate: "Veld moet een datum zijn (DD-MM-JJJJ)",
        msgEmail: "Veld moet een e-mail adres zijn",
        msgMaxLength: "Waarde is te lang (maximale lengte is #{maxLength}, lengte is #{length})",
        msgMaxValue: "Waarde is te hoog (maximale waarde is #{maxValue}, waarde is #{value})",
        msgMinLength: "Waarde is te kort (minimale lengte is #{minLength}, lengte is #{length})",
        msgMinValue: "Waarde is te laag (minimale waarde is #{minValue}, waarde is #{value})",
        msgNumeric: "Veld is niet numeriek",
        msgRequired: "Veld is verplicht"
    })
});

// a hash of default validators; the key is the trigger class, the value is
// the validation function; each validation function will be called with
// the field to be validated as argument
Validator.defaultValidators = $H({
    // validation of confirmation fields
    confirmation: function (field) {
        if ($w("text password").indexOf(field.type) !== -1) {
            var message = this.options.get("msgConfirmation");
            var matcher = new RegExp("confirmation:(\\w+)", "g").exec(field.className);
            var originalField = (matcher !== null) ? $(matcher[1]) : null;
            var label = originalField ? this.getLabel(originalField) : null;

            if (!originalField || $F(field) !== $F(originalField)) {
                // check if the validation message contains "[<text>]"; if this
                // is the case and a label for the original field (the field
                // that needs to be confirmed) exists, use the extra text and
                // replace any occurance of "#{label}" in it with the label
                // content
                var optionalMatcher = new RegExp("(\\[([^\\[]*)\\])", "g").exec(message);
                // optionalMatcher[1] = "[text]", optionalMatcher[2] = "text";
                // each occurance of #{label} in text will be replaced
                return optionalMatcher ? message.replace(optionalMatcher[1], label ? optionalMatcher[2].replace(new RegExp("#{label}", "g"), label.innerHTML) : "") : message;
            }
        }
        return "";
    },

    // validation of date fields
    date: function (field) {
        if ($w("text password").indexOf(field.type) !== -1 && !$F(field).empty()) {
            var result = this.stringToDate($F(field), this.options.get("validDateFormats"));
            if (result === null) {
                return this.options.get("msgDate");
            } else {
                field.value = this.dateToString(result, this.options.get("dateFormat"));
            }
        }
        return "";
    },

    // validation of e-mail fields (only if field is not empty)
    email: function (field) {
        return ($w("text password").indexOf(field.type) !== -1 && !$F(field).empty() && !/^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/.test($F(field))) ? this.options.get("msgEmail") : "";
    },

    // validation of maximum length
    maxLength: function (field) {
        if ($w("text password").indexOf(field.type) !== -1) {
            var matcher = new RegExp("maxLength\\:(\\d+)", "g").exec(field.className);
            if (matcher === null || $F(field).length > matcher[1]) {
                return this.options.get("msgMaxLength").replace(new RegExp("#{maxLength}", "g"), matcher[1]).replace(new RegExp("#{length}", "g"), $F(field).length);
            }
        }
        return "";
    },

    // validation of maximum value
    maxValue: function (field) {
        if ($w("text password").indexOf(field.type) !== -1 && !$F(field).empty()) {
            var matcher = new RegExp("maxValue\\:(\\d+)", "g").exec(field.className);
            if (matcher === null || !this.isNumeric($F(field)) || parseInt($F(field), 10) > matcher[1]) {
                return this.options.get("msgMaxValue").replace(new RegExp("#{maxValue}", "g"), matcher[1]).replace(new RegExp("#{value}", "g"), !this.isNumeric($F(field)) ? '?' : parseInt($F(field), 10));
            }
        }
        return "";
    },

    // validation of minimum length
    minLength: function (field) {
        if ($w("text password").indexOf(field.type) !== -1) {
            var matcher = new RegExp("minLength\\:(\\d+)", "g").exec(field.className);
            if (matcher === null || $F(field).length < matcher[1]) {
                return this.options.get("msgMinLength").replace(new RegExp("#{minLength}", "g"), matcher[1]).replace(new RegExp("#{length}", "g"), $F(field).length);
            }
        }
        return "";
    },

    // validation of minimum value
    minValue: function (field) {
        if ($w("text password").indexOf(field.type) !== -1 && !$F(field).empty()) {
            var matcher = new RegExp("minValue\\:(\\d+)", "g").exec(field.className);
            if (matcher === null || !this.isNumeric($F(field)) || parseInt($F(field), 10) < matcher[1]) {
                return this.options.get("msgMinValue").replace(new RegExp("#{minValue}", "g"), matcher[1]).replace(new RegExp("#{value}", "g"), !this.isNumeric($F(field)) ? '?' : parseInt($F(field), 10));
            }
        }
        return "";
    },

    // validation of numeric fields (only if field is not empty)
    numeric: function (field) {
        return ($w("text password").indexOf(field.type) !== -1 && !$F(field).empty() && !this.isNumeric($F(field))) ? this.options.get("msgNumeric") : "";
    },

    // validation of required fields
    required: function (field) {
        var error = false;
        // a check box should be checked
        if (field.type === "checkbox") {
            error = !field.checked;
        // TODO: is this the right way for radio buttons?
        } else if (field.type === "radio") {
            error = $(field.form).getElementsBySelector("input[type=radio][name=" + field.name + "]").all(function (f) {
                return !f.checked;
            });
        // for other types, a value should be given
        } else {
            error = $F(field).empty();
        }
        return error ? this.options.get("msgRequired") : "";
    }
});