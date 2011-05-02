var gt = require('../lib/gettext'),
    testCase = require('../deps/nodeunit').testCase;



module.exports = testCase({
    setUp: function (done) {
        gt.loadLanguageFile(__dirname + '/fixture/test.po', function (err) {
            if (!err) {
                gt.loadLanguageFile(__dirname + '/fixture/01gettext_messages.po', function (err) {
                    if (!err) {
                        gt.loadLanguageFile(__dirname + '/fixture/domain_inferred.po', function (err) {
                            done();
                        });
                    }
                });
            }
        });
    },
    tearDown: function (done) {
        gt.textdomain('messages');
        gt.setlocale('LC_ALL', '');
        done();
    },
    "gettext": function (t) {
        t.expect(6);
        t.equals(gt.gettext('not present'), 'not present');
        t.equals(gt.gettext('test'), 'XXmessages-testXX');
        t.equals(gt.gettext('test with "embedded" quotes'), 'XXtest with "embedded" quotesXX');
        gt.textdomain('domain_inferred');
        t.equals(gt.gettext('test'), 'XXtestXX');
        t.equals(gt.gettext('test with "embedded" quotes'), 'test with "embedded" quotes');
        gt.textdomain('wrong domain');
        t.equals(gt.gettext('test with "embedded" quotes'), 'XXtest with "embedded" quotesXX');
        t.done();
    },
    "dgettext": function (t) {
        t.expect(6);
        t.equals(gt.dgettext('messages', 'not present'), 'not present');
        t.equals(gt.dgettext('messages', 'test'), 'XXmessages-testXX');
        t.equals(gt.dgettext('messages', 'test with "embedded" quotes'), 'XXtest with "embedded" quotesXX');
        t.equals(gt.dgettext('domain_inferred', 'test'), 'XXtestXX');
        t.equals(gt.dgettext('domain_inferred', 'test with "embedded" quotes'), 'test with "embedded" quotes');
        t.equals(gt.dgettext('wrong domain', 'test with "embedded" quotes'), 'XXtest with "embedded" quotesXX');
        t.done();
    },
    "ngettext": function (t) {
        t.expect(6);
        gt.textdomain('test');
        /* The Plural-Forms header is wrong on purpose.  It is in fact the correct
           setting for Slovenian, but we abuse it here for testing ngettext and
           friends. */
        t.equals(gt.gettext('Singular'), 'Numerus 0');
        t.equals(gt.ngettext('Singular', 'Plural', 0), 'Numerus 3');
        t.equals(gt.ngettext('Singular', 'Plural', 1), 'Numerus 0');
        t.equals(gt.ngettext('Singular', 'Plural', 2), 'Numerus 1');
        t.equals(gt.ngettext('Singular', 'Plural', 3), 'Numerus 2');
        gt.textdomain('wrong domain');
        t.equals(gt.ngettext('Singular', 'Plural', 0), 'Numerus 3');
        t.done();
    },
    "multi-lang": function (t) {
        t.expect(4);
        gt.loadLocaleDirectory(__dirname + '/fixture/locale', function () {
            t.equals(gt.gettext('language'), 'language');
            gt.setlocale('LC_ALL', 'en');
            t.equals(gt.gettext('language'), 'english');
            gt.setlocale('LC_ALL', 'de');
            t.equals(gt.gettext('language'), 'german');
            gt.setlocale('LC_ALL', '');
            t.equals(gt.gettext('language'), 'language');
            t.done();
        });
    }
});
