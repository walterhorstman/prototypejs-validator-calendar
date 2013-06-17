/*****************************************************************************/
/* Script   : Javascript calendar v1.0                                       */
/* Author(s): Walter Horstman (WH)                                           */
/* Requires : Prototype 1.6.1 (http://www.prototypejs.org)                   */
/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - */
/* Revision history:                                                         */
/* 2009/12/31: Made final (version 1.0) (WH)                                 */
/* 2008/02/06: First (beta) release (WH)                                     */
/*****************************************************************************/

var Calendar = Class.create({
  /**
   * Initializes the calendar. In dynamic mode, it adds observers to each DOM
   * element with the trigger class. It static mode, it creates the calendar
   * in an existing container.
   */
  initialize: function (config, date) {
    this.options = Calendar.defaultOptions;
    config = $H(config || {});

    // merge given options, country specific options and language specific
    // options
    this.setCountryOptions(config.get('country'));
    this.setLanguageOptions(config.get('language'));
    this.setOptions(config.get('options'));

    // because this one is used so often, create a separate variable for it
    this.cssPrefix = this.options.get('cssPrefix');

    // in dynamic mode, add an observer to all text fields with the trigger
    // class
    if (this.options.get('mode') === Calendar.MODE_POPUP) {
      $$('input[type=text].' + this.options.get('triggerClass')).each(function (field) {
        var triggerElement = $(field.id + (this.options.get('triggerObject') ? this.options.get('triggerObject') : ''));
        triggerElement.observe(this.options.get('triggerEvent'), function () {
          this.field = field;
          // only one container can be active (removeContainer
          // checks this)
          this.removeContainer();
          // create a calendar container for the field at a
          // position right below the field (CSS can be used for
          // additional positioning)
          this.field.insert({
            after: new Element('div', {
              id: this.cssPrefix + 'Calendar',
              className: this.cssPrefix + '-container',
              style: 'position: absolute;'
            })
          });
          this.container = $(this.cssPrefix + 'Calendar');
          var p = this.field.cumulativeOffset();
          var q = this.container.getOffsetParent().cumulativeOffset();
          this.container.setStyle({
            left: (p[0] - q[0]) + 'px',
            top: (p[1] - q[1] + field.getHeight()) + 'px'
          });
          this.show($F(field));
        }.bind(this));
      }.bind(this));
    // in static mode, the calendar is shown in the given container
    } else {
      this.field = null;
      this.container = config.get('container');
      this.container.addClassName(this.cssPrefix + '-container');
      this.show(date);
    }
  },

  createButton: function (name, title, caption, onClick) {
    var className = this.cssPrefix + '-' + name.underscore().dasherize() + '-';
    var center = new Element('div', {
      'className': className + 'center ' + this.cssPrefix + '-button-center',
      'style': 'float: left;'
    }).update(caption);
    var right = new Element('div', {
      'className': className + 'right ' + this.cssPrefix + '-button-right',
      'style': 'float: left;'
    });
    right.appendChild(center);
    var left = new Element('div', {
      'id': this.cssPrefix + name,
      'className': className + 'left ' + this.cssPrefix + '-button-left',
      'style': 'float: left;',
      'title': title
    });
    left.appendChild(right);
    left.observe('mouseover', function (e) {
      $(this.cssPrefix + name).addClassName(className + 'hover');
      $(this.cssPrefix + name).addClassName(this.cssPrefix + '-button-hover');
    }.bind(this));
    left.observe('mouseout', function (e) {
      $(this.cssPrefix + name).removeClassName(className + 'hover');
      $(this.cssPrefix + name).removeClassName(this.cssPrefix + '-button-hover');
    }.bind(this));
    left.observe('click', onClick);
    return left;
  },

  /**
   * Converts a date to a string, using the given date format.
   */
  dateToString: function (date, format) {
    var result = format;

    // replace the format specifiers with real values
    format.match(/(d+|m+|y+)/gi).uniq().each(function (match) {
      switch (match) {
        case 'd':
          result = result.gsub(match, date.getDate());
          break;
        case 'dd':
          result = result.gsub(match, date.getDate().toPaddedString(2));
          break;
        case 'm':
          result = result.gsub(match, date.getMonth() + 1);
          break;
        case 'mm':
          result = result.gsub(match, (date.getMonth() + 1).toPaddedString(2));
          break;
        case 'mmm':
          result = result.gsub(match, this.options.get('monthsAbbreviated')[date.getMonth()].toLowerCase());
          break;
        case 'MMM':
          result = result.gsub(match, this.options.get('monthsAbbreviated')[date.getMonth()].toUpperCase());
          break;
        case 'Mmm':
          result = result.gsub(match, this.options.get('monthsAbbreviated')[date.getMonth()]);
          break;
        case 'mmmmm':
          result = result.gsub(match, this.options.get('months')[date.getMonth()].toLowerCase());
          break;
        case 'MMMMM':
          result = result.gsub(match, this.options.get('months')[date.getMonth()].toUpperCase());
          break;
        case 'Mmmmm':
          result = result.gsub(match, this.options.get('months')[date.getMonth()]);
          break;
        case 'y':
          result = result.gsub(match, date.getFullYear());
          break;
        case 'yy':
          result = result.gsub(match, date.getFullYear().toPaddedString(4).substr(-2));
          break;
        case 'yyyy':
          result = result.gsub(match, date.getFullYear().toPaddedString(4));
          break;
      }
    }.bind(this));
    return result;
  },

  /**
   * Returns the DOM element belonging to the given date (so this should be a
   * date that is shown in the calendar, if not, it returns null).
   */
  get: function (date) {
    var result = null;
    // loop over week cells only
    this.container.getElementsBySelector('.' + this.cssPrefix + '-week').each(function (week) {
      var cells = week.getElementsBySelector('[title="' + this.dateToString(date, this.options.get('dateFormat')) + '"]');
      if (cells && cells.size() === 1) {
        result = cells[0];
        throw $break;
      }
    }.bind(this));
    return result;
  },

  /**
   * Before a date is clicked, it returns the date for which the calendar is
   * shown. After a date is clicked, it returns the clicked date.
   */
  getDate: function () {
    return this.date;
  },

  /**
   * Returns the end date of the populated calendar. This could be a date of
   * the next month.
   */
  getEndDate: function () {
    return this.endDate;
  },

  /**
   * Returns the field to which the calendar is linked.
   */
  getField: function () {
    return this.field;
  },

  /**
   * Returns the options.
   */
  getOptions: function () {
    return this.options;
  },

  /**
   * Returns the start date of the populated calendar. This could be a date of
   * the previous month.
   */
  getStartDate: function () {
    return this.startDate;
  },

  /**
   * Removes the calendar container (if it exists).
   */
  removeContainer: function () {
    if (this.container) {
      this.container.innerHTML = '';
      this.container.remove();
      this.container = null;
    }
  },

  /**
   * Sets default options for given country, which defaults to Great Britain.
   */
  setCountryOptions: function (country) {
    this.options.update(Calendar.defaultCountryOptions.get(country || 'GB'));
  },

  /**
   * Sets default options for given language, which defaults to English.
   */
  setLanguageOptions: function (language) {
    this.options.update(Calendar.defaultLanguageOptions.get(language || 'en'));
  },

  /**
   * Sets the options specified by the given options hash. It can override any
   * option of the Calendar.defaultOptions hash.
   */
  setOptions: function (options) {
    this.options.update(options);
  },

  /**
   * Shows the calendar starting at the month for the given date.
   */
  show: function (date) {
    // use default date if no (correct) date is given
    this.date = (date ? this.stringToDate(date, this.options.get('validDateFormats')) : null) || this.options.get('defaultDate');
    this.populate(this.date);
    // if onShow handler is defined, use it, else default to showing container
    if (this.options.get('onShow')) {
      this.options.get('onShow').bind(this)();
    } else {
      this.container.show();
    }
  },

  /**
   * Populates a calendar with dates for the given month.
   */
  populate: function (date) {
    var button;
    var week;
    var month = date.getMonth();
    var year = date.getFullYear();

    // remove all elements from container
    this.container.innerHTML = '';

    // add row with navigation buttons
    if (this.options.get('showNavigation')) {
      var navigation = new Element('div', {className: this.cssPrefix + '-navigation', style: 'clear: both;'});
      navigation.appendChild(this.createButton('PreviousMonth', this.options.get('titlePreviousMonth'), this.options.get('captionPreviousMonth'), function () {
        this.populate(new Date(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1, 1));
      }.bind(this)));
      navigation.appendChild(this.createButton('PreviousYear', this.options.get('titlePreviousYear'), this.options.get('captionPreviousYear'), function () {
        this.populate(new Date(year - 1, month, 1));
      }.bind(this)));
      navigation.appendChild(this.createButton('Title', this.dateToString(date, this.options.get('titleFormat')), this.dateToString(date, this.options.get('titleFormat')), function () {
        // TODO: create a month selector
      }.bind(this)));
      navigation.appendChild(this.createButton('NextYear', this.options.get('titleNextYear'), this.options.get('captionNextYear'), function () {
        this.populate(new Date(year + 1, month, 1));
      }.bindAsEventListener(this)));
      navigation.appendChild(this.createButton('NextMonth', this.options.get('titleNextMonth'), this.options.get('captionNextMonth'), function () {
        console.log(this);
        console.log(month);
        this.populate(new Date(month === 11 ? year + 1 : year, month === 11 ? 0 : month + 1, 1));
      }.bind(this)));
      this.container.appendChild(navigation);
    }

    // if week numbers should be shown, add extra column
    var columnOffset = this.options.get('showWeekNumbers') ? 1 : 0;

    // add row with names of days
    var labels = new Element('div', {className: this.cssPrefix + '-labels', style: 'clear: both;'});
    if (this.options.get('showWeekNumbers')) {
      labels.appendChild(new Element('div', {className: this.cssPrefix + '-week-number', style: 'float: left;', title: this.options.get('titleWeek')}).update(this.options.get('captionWeek')));
    }
    (7).times(function (i) {
      labels.appendChild(new Element('div', {className: (i === 0) ? this.cssPrefix + '-first' : '', style: 'float: left;', title: this.options.get('days')[(i + this.options.get('firstDayOfWeek')) % 7]}).update(this.options.get('daysAbbreviated')[(i + this.options.get('firstDayOfWeek')) % 7]));
    }.bind(this));
    this.container.appendChild(labels);

    this.startDate = new Date(year, month, 1);
    // determine if calendar should start in previous month
    var cellOffset = (this.startDate.getDay() + 7 - this.options.get('firstDayOfWeek')) % 7;
    this.startDate.setDate(-cellOffset + 1);
    // last date will be incremented until it is the last date in the calendar
    this.endDate = new Date(this.startDate.getFullYear(), this.startDate.getMonth(), this.startDate.getDate());
    var daysInMonth = this.getDaysInMonth(date);
    var today = new Date();

    // total number of day cells is number of days in month + offset for first
    // day of month rounded off to closest multiplication of 7
    var numberOfCells = Math.ceil((cellOffset + daysInMonth) / 7) * 7;
    (numberOfCells).times(function (i) {
      if (i % 7 === 0) {
        week = new Element('div', {
          className: this.cssPrefix + '-week',
          style: 'clear: both;'
        });
        if (this.options.get('showWeekNumbers')) {
          var weekNumber = this.getWeekNumber(this.endDate);
          week.appendChild(new Element('div', {
            className: this.cssPrefix + '-week-number',
            style: 'float: left;',
            title: this.options.get('titleWeek') + ' ' + weekNumber
          }).update(weekNumber));
        }
      }

      var cell = new Element('div', {
        style: 'float: left;',
        title: this.dateToString(this.endDate, this.options.get('dateFormat'))
      }).update(this.endDate.getDate());
      // is date in month we're viewing? (there could also be days of the
      // previous and next month in the calendar)
      if (this.endDate.getMonth() === month) {
        cell.addClassName(this.cssPrefix + '-current-month');
      }
      // first day of week?
      if (i % 7 === 0) {
        cell.addClassName(this.cssPrefix + '-first');
      }
      // today?
      if (this.datesEqual(this.endDate, today)) {
        cell.addClassName(this.cssPrefix + '-today');
      }
      // same date as given value?
      if (this.datesEqual(this.endDate, this.date)) {
        cell.addClassName(this.cssPrefix + '-field-date');
      }

      cell.observe('mouseover', function (e) {
        Event.element(e).addClassName(this.cssPrefix + '-hover');
      }.bindAsEventListener(this));
      cell.observe('mouseout', function (e) {
        Event.element(e).removeClassName(this.cssPrefix + '-hover');
      }.bindAsEventListener(this));
      cell.observe('click', function (e) {
        this.date = this.stringToDate(Event.element(e).title, this.options.get('validDateFormats'));
        // in dynamic mode this by default sets the field value and removes the
        // calendar; this behaviour can be overridden by specifying a call back
        // function (onClick) to the options hash of the calendar
        if (this.options.get('mode') === Calendar.MODE_POPUP && !this.options.get('onClick')) {
          this.field.value = Event.element(e).title;
          this.removeContainer();
        }
        // in static mode, a call back function (onClick) should be specified
        // to the options hash of the calendar (else nothing happens)
        if (this.options.get('onClick')) {
          this.options.get('onClick').bind(this)();
        }
      }.bindAsEventListener(this));

      week.appendChild(cell);
      if (i % 7 === 6) {
        this.container.appendChild(week);
      }
      this.endDate.setDate(this.endDate.getDate() + 1);
    }.bind(this));
    this.endDate.setDate(this.endDate.getDate() - 1);

    // add row with footer buttons
    if (this.options.get('showFooter')) {
      var footer = new Element('div', {
        className: this.cssPrefix + '-footer',
        style: 'clear: both;'
      });
      // today button
      footer.appendChild(this.createButton('today', this.dateToString(today, this.options.get('titleFormat')), this.options.get('captionToday'), function () {
        this.populate(today);
      }.bindAsEventListener(this)));

      // close button
      footer.appendChild(this.createButton('close', this.options.get('titleClose'), this.options.get('captionClose'), function () {
        if (this.options.get('mode') === Calendar.MODE_POPUP && !this.options.get('onClose')) {
          this.removeContainer();
        }
        if (this.options.get('onClose')) {
          this.options.get('onClose').bind(this)();
        }
      }.bindAsEventListener(this)));
      this.container.appendChild(footer);
    }

    if (this.options.get('onPopulate')) {
      this.options.get('onPopulate').bind(this)();
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
            case 'd':
            case 'dd':
              day = sm.match(/^\d{1,2}$/) ? parseInt(sm, 10) : -1;
              break;
            case 'm':
            case 'mm':
              month = sm.match(/^\d{1,2}$/) ? parseInt(sm, 10) - 1 : - 1;
              break;
            case 'mmm':
              // the iterator returns an array with abbreviated month names
              // lower cased
              month = this.options.get('monthsAbbreviated').collect(function (m) {
                return m.toLowerCase();
              }).indexOf(sm);
              break;
            case 'mmmmm':
              // the iterator returns an array with month names lower cased
              month = this.options.get('months').collect(function (m) {
                return m.toLowerCase();
              }).indexOf(sm);
              break;
            // add current century to given year
            case 'yy':
              year = sm.match(/^\d{2}$/) ? 100 * Math.floor(year / 100) + parseInt(sm, 10) : -1;
              break;
            case 'y':
            case 'yyyy':
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
          // if a too large day (or month) is given, Javascript automatically
          // adds months (or years) to the date; we don't want to allow this,
          // therefore we check each date component once more
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

  /**
   * Returns whether the given dates are equal (it only checks the date part).
   */
    datesEqual: function (date1, date2) {
      try {
        return (date1.getFullYear() === date2.getFullYear()) && (date1.getMonth() === date2.getMonth()) && (date1.getDate() === date2.getDate());
      } catch (e) {
      }
      return false;
    },

  /**
   * Returns the week number of the given date.
   */
  getWeekNumber: function (date) {
    var newDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    newDate.setDate(newDate.getDate() - (newDate.getDay() + 6) % 7 + 3);
    var ms = newDate.valueOf();
    newDate.setMonth(0);
    newDate.setDate(4); // Thursday should be in first week
    return Math.round((ms - newDate.valueOf()) / (7 * 864e5)) + 1;
  },

  /**
   * Returns the number of days in the month of the given date.
   */
  getDaysInMonth: function (date) {
    var days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    var month = date.getMonth();
    var year = date.getYear();

    // February is special, because it has an extra day in a leap year, which
    // is every 4th year, but not every 100th year (unless it is a 400th year)
    return days[month] + ((month === 1 && year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 1 : 0);
  }
});

// constants for days of week
Calendar.SUNDAY = 0;
Calendar.MONDAY = 1;
Calendar.TUESDAY = 2;
Calendar.WEDNESDAY = 3;
Calendar.THURSDAY = 4;
Calendar.FRIDAY = 5;
Calendar.SATURDAY = 6;

// constants for mode
Calendar.MODE_POPUP = 0;  // calendar is a new container linked to an input field
Calendar.MODE_INLINE = 1; // calendar is linked to an existing container

Calendar.defaultOptions = $H({
  'cssPrefix': 'calendar',       // css prefix for all CSS classes used by the calendar
  'defaultDate': new Date(),     // default date to use when field contains no date
  'mode': Calendar.MODE_POPUP,   // MODE_POPUP (default) or MODE_INLINE
  'onClick': null,               // function to use when a day is clicked (especially useful in static mode); it gets called with calendar instance
  'onClose': null,               // function to use when calendar is closed (null to use default); it gets called with calendar instance
  'onPopulate': null,            // function to use after the calendar is populated; it gets called with calendar instance
  'onShow': null,                // function to use when calendar is shown (null to use default); it gets called with calendar instance
  'showFooter': true,            // should the footer (today and close button) be shown?
  'showNavigation': true,        // should the navigation buttons be shown?
  'showWeekNumbers': true,       // should week numbers be shown?
  'triggerClass': 'date',        // fields with this class will get the calendar (dynamic mode)
  'triggerEvent': 'focus',       // event that will trigger showing of calendar (dynamic mode)
  'triggerObject': null          // if set, the trigger event is not set on the field, but on an other element with id '<field id><triggerObject>' (popup mode)
});

Calendar.defaultCountryOptions = $H({
  'GB': $H({
    'dateFormat': 'yyyy/mm/dd',        // format of date fields (parsed values will be converted to this)
    'firstDayOfWeek': Calendar.MONDAY, // first day of week
                                       // valid date formats for parsing of date fields
    'titleFormat': 'Mmmmm yyyy',
    'validDateFormats': ['yy/m/d', 'y/m/d', 'yy-m-d', 'y-m-d', 'm/d', 'm-d', 'd', 'd-mmm-yy', 'd-mmm-y', 'd mmmmm yy', 'd mmmmm y', 'd mmm yy', 'd mmm y']
  }),
  'NL': $H({
    'dateFormat': 'dd-mm-yyyy',
    'firstDayOfWeek': Calendar.MONDAY,
    'titleFormat': 'Mmmmm yyyy',
    'validDateFormats': ['d-m-yy', 'd-m-y', 'd/m/yy', 'd/m/y', 'd-m', 'd/m', 'd', 'd-mmm-yy', 'd-mmm-y', 'd mmmmm yy', 'd mmmmm y', 'd mmm yy', 'd mmm y']
  })
});

Calendar.defaultLanguageOptions = $H({
  'en': $H({
    'days': ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    'daysAbbreviated': ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
    'months': ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    'monthsAbbreviated': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    'captionClose': 'Close',
    'captionNextMonth': '>',
    'captionNextYear': '>>',
    'captionPreviousYear': '<<',
    'captionPreviousMonth': '<',
    'captionToday': 'Today',
    'captionWeek': 'Wk',
    'titleClose': 'Close calendar',
    'titleNextMonth': 'Next month',
    'titleNextYear': 'Next year',
    'titlePreviousMonth': 'Previous month',
    'titlePreviousYear': 'Previous year',
    'titleToday': 'Today\'s date',
    'titleWeek': 'Week'
  }),
  'nl': $H({
    'days': ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'],
    'daysAbbreviated': ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'],
    'months': ['Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni', 'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'],
    'monthsAbbreviated': ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'],
    'captionClose': 'Sluiten',
    'captionNextMonth': '>',
    'captionNextYear': '>>',
    'captionPreviousYear': '<<',
    'captionPreviousMonth': '<',
    'captionToday': 'Vandaag',
    'captionWeek': 'Wk',
    'titleClose': 'Sluit kalender',
    'titleNextMonth': 'Volgende maand',
    'titleNextYear': 'Vorig jaar',
    'titlePreviousMonth': 'Vorige maand',
    'titlePreviousYear': 'Vorig jaar',
    'titleToday': 'Vandaag'
  })
});