/*
Pure Javascript implementation of Uniforum message translation.
Copyright (C) 2008 Joshua I. Miller <unrtst@cpan.org>, all rights reserved

Adaption for node.js and minor improvements
Copyright (C) 2011 Daniel Baulig <daniel.Baulig@gmx.de>, all rights reserved

This program is free software; you can redistribute it and/or modify it
under the terms of the GNU Library General Public License as published
by the Free Software Foundation; either version 2, or (at your option)
any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
Library General Public License for more details.

You should have received a copy of the GNU Library General Public
License along with this program; if not, write to the Free Software
Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307,
USA.
*/

var fs = require('fs');
var path = require('path');
var async = require('async');
var po = require('node-po');

var __bind = function(me, fn) {
    return function () {
        return fn.apply(me, arguments);
    };
};


// This takes the bin/po2json'd data, and moves it into an internal form
// for use in our lib, and puts it in our object as:
//  this.data = {
//      domain : {
//          head : { headfield : headvalue },
//          msgs : {
//              msgid : { msgid_plural, msgstr, msgstr_plural },
//          },
var parse_locale_data = function(locale_data, l) {
    if (typeof(this.data) == 'undefined') {
        this.data = { };
    }

    if (!l) {
        l = this.lang;
    }

    if (typeof this.data[l] == 'undefined') {
        this.data[l] = {};
    }

    var domain;

    // suck in every domain defined in the supplied data
    for (domain in locale_data) {
        // skip empty specs (flexibly)
        if ((! locale_data.hasOwnProperty(domain)) || !locale_data[domain]) {
            continue;
        }
        // skip if it has no msgid's
        var has_msgids = false;
        for (var msgid in locale_data[domain]) {
            has_msgids = true;
            break;
        }
        if (! has_msgids) {
            continue;
        }


        // grab shortcut to data
        var data = locale_data[domain];

        // if they specifcy a blank domain, default to "messages"
        if (domain === "") {
            domain = "messages";
        }
        // init the data structure
        this.data[l][domain]      = this.data[l][domain]      || { };
        this.data[l][domain].head = this.data[l][domain].head || { };
        this.data[l][domain].msgs = this.data[l][domain].msgs || { };

        for (var head in data.headers) {
            var h = head.toLowerCase();
            this.data[l][domain].head[h] = data.headers[head];
        }

        for (var key in data.items) {
            var item = data.items[key];
            this.data[l][domain].msgs[item.msgid] = item;
        }
    }

    // build the plural forms function
    for (domain in this.data[l]) {
        if (this.data[l][domain].head['plural-forms'] &&
            this.data[l][domain].head['plural-forms'].length > 0 &&
            typeof(this.data[l][domain].head.plural_func) == 'undefined') {
            // untaint data
            var plural_forms = this.data[l][domain].head['plural-forms'];
            var pf_re = new RegExp('^(\\s*nplurals\\s*=\\s*[0-9]+\\s*;\\s*plural\\s*=\\s*(?:\\s|[-\\?\\|&=!<>+*/%:;a-zA-Z0-9_\\(\\)])+)', 'm');
            if (pf_re.test(plural_forms)) {
                //ex english: "Plural-Forms: nplurals=2; plural=(n != 1);\n"
                //pf = "nplurals=2; plural=(n != 1);";
                //ex russian: nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10< =4 && (n%100<10 or n%100>=20) ? 1 : 2)
                //pf = "nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2)";

                var pf = this.data[l][domain].head['plural-forms'];
                if (! /;\s*$/.test(pf)) {
                    pf = pf.concat(';');
                }
                /* We used to use eval, but it seems IE has issues with it.
                 * We now use "new Function", though it carries a slightly
                 * bigger performance hit.
                var code = 'function (n) { var plural; var nplurals; '+pf+' return { "nplural" : nplurals, "plural" : (plural === true ? 1 : plural ? plural : 0) }; };';
                this.data[l][domain].head.plural_func = eval("("+code+")");
                */
                var code = 'var plural; var nplurals; '+pf+' return { "nplural" : nplurals, "plural" : (plural === true ? 1 : plural ? plural : 0) };';
                this.data[l][domain].head.plural_func = new Function("n", code);
            } else {
                throw new Error("Syntax error in language file. Plural-Forms header is invalid ["+plural_forms+"]");
            }

        // default to english plural form
        } else if (typeof(this.data[l][domain].head.plural_func) == 'undefined') {
            this.data[l][domain].head.plural_func = function (n) {
                var p = (n != 1) ? 1 : 0;
                return { 'nplural' : 2, 'plural' : p };
            };
        } // else, plural_func already created
    }

    return;
};


function Gettext (opts) {
    opts = opts || {};

    this.domain = opts.domain || 'messages';
    this.lang = opts.lang
             || process.env.LC_ALL
             || process.env.LC_MESSAGES
             || process.env.LANGUAGES
             || process.env.LANG
             || '';
    this.context_glue = opts.glue || "\004";
    this.data = {};

    // bind all methods to this instance so `_ = gt.gettext works` again
    for (var key in Gettext.prototype) {
        this[key] = __bind(this, this[key]);
    }
}
Gettext.prototype = {
    loadLanguageFile: function(file, l, callback) {
        if (! file) {
            return;
        }

        if (!callback) {
            callback = l;
            l = this.lang;
        }
        var domain = path.basename(file, '.po');

        var that = this;
        fs.readFile(file, 'utf8', function(err, data) {
            if (err) {
                return callback(err);
            }
            var parsed = po.parse(data);

            var rv = {};
            // munge domain into/outof header
            if (parsed) {
                if (! parsed[""]) {
                    parsed[""] = {};
                }
                if (! parsed[""].domain) {
                    parsed[""].domain = domain;
                }
                domain = parsed[""].domain;
                rv[domain] = parsed;

                parse_locale_data.call(that, rv, l);
            }

            return callback && callback();
        });
    },
    // loads all po files from a flat locale directory tree.
    // -> LANGUAGE_NAME/domain.po
    // eg. en/jsgettext.po de/jsgettext.po etc.
    loadLocaleDirectory: function (directory, callback) {
        var that = this;
        fs.readdir(directory, function (err, files) {
            async.map(files, function langdir_iterator(file, next) {
                file = path.join(directory, file);
                fs.stat(file, function (err, stats) {
                    if (err || !stats.isDirectory()) return next(err);
                    var l = path.basename(file);
                    fs.readdir(file, function (err, files) {
                        if (err) return next(err);
                        async.map(files, function podir_iterator(file, next) {
                            file = path.join(directory, l, file);
                            fs.stat(file, function (err, stats) {
                                if (err || !stats.isFile()) return next(err);
                                that.loadLanguageFile(file, l, next);
                            });
                        }, next);
                    });
                });
            }, function langdir_done(err, results) {
                callback && callback(err);
            });
        });
    },
    setlocale: function (category, locale) {
        // ignore category for now
        category = 'LC_ALL';
        this.lang = locale;
    },
    textdomain: function (d) {
        if (d && d.length)  {
            this.domain = d;
        }
        return this.domain;
    },

    // gettext
    gettext: function (msgid) {
        var msgctxt;
        var msgid_plural;
        var n;
        var category;
        return this.dcnpgettext(null, msgctxt, msgid, msgid_plural, n, category);
    },

    dgettext: function (domain, msgid) {
        var msgctxt;
        var msgid_plural;
        var n;
        var category;
        return this.dcnpgettext(domain, msgctxt, msgid, msgid_plural, n, category);
    },

    dcgettext: function (domain, msgid, category) {
        var msgctxt;
        var msgid_plural;
        var n;
        return this.dcnpgettext(domain, msgctxt, msgid, msgid_plural, n, category);
    },

    // ngettext
    ngettext: function (msgid, msgid_plural, n) {
        var msgctxt;
        var category;
        return this.dcnpgettext(null, msgctxt, msgid, msgid_plural, n, category);
    },

    dngettext: function (domain, msgid, msgid_plural, n) {
        var msgctxt;
        var category;
        return this.dcnpgettext(domain, msgctxt, msgid, msgid_plural, n, category);
    },

    dcngettext: function (domain, msgid, msgid_plural, n, category) {
        var msgctxt;
        return this.dcnpgettext(domain, msgctxt, msgid, msgid_plural, n, category, category);
    },

    // pgettext
    pgettext: function (msgctxt, msgid) {
        var msgid_plural;
        var n;
        var category;
        return this.dcnpgettext(null, msgctxt, msgid, msgid_plural, n, category);
    },

    dpgettext: function (domain, msgctxt, msgid) {
        var msgid_plural;
        var n;
        var category;
        return this.dcnpgettext(domain, msgctxt, msgid, msgid_plural, n, category);
    },

    dcpgettext: function (domain, msgctxt, msgid, category) {
        var msgid_plural;
        var n;
        return this.dcnpgettext(domain, msgctxt, msgid, msgid_plural, n, category);
    },

    // npgettext
    npgettext: function (msgctxt, msgid, msgid_plural, n) {
        var category;
        return this.dcnpgettext(null, msgctxt, msgid, msgid_plural, n, category);
    },

    dnpgettext: function (domain, msgctxt, msgid, msgid_plural, n) {
        var category;
        return this.dcnpgettext(domain, msgctxt, msgid, msgid_plural, n, category);
    },

    // this has all the options, so we use it for all of them.
    dcnpgettext: function (d, msgctxt, msgid, msgid_plural, n, category) {
        if (! msgid) {
            return '';
        }

        var msg_ctxt_id = msgctxt ? msgctxt + this.context_glue + msgid : msgid;

        var domainname = d || this.domain || 'messages';
        var lang = this.lang;

        // category is always LC_MESSAGES. We ignore all else
        var category_name = 'LC_MESSAGES';
        category = 5;

        var locale_data = [];
        if (typeof(this.data[lang]) != 'undefined' &&
            this.data[lang][domainname]) {
                locale_data.push(this.data[lang][domainname] );

        } else if (typeof(this.data[lang]) != 'undefined') {
            // didn't find domain we're looking for. Search all of them.
            for (var dom in this.data[lang]) {
                locale_data.push(this.data[lang][dom] );
            }
        }

        var trans = [];
        var found = false;
        var domain_used; // so we can find plural-forms if needed
        if (locale_data.length) {
            for (var i=0; i<locale_data.length; i++) {
                var locale = locale_data[i];
                if (locale.msgs[msg_ctxt_id]) {
                    var msg_ctxt_str = locale.msgs[msg_ctxt_id].msgstr;
                    trans = msg_ctxt_str.concat(trans.slice(msg_ctxt_str.length));
                    domain_used = locale;
                    found = true;
                    // only break if found translation actually has a translation.
                    if ( trans.length > 0 && trans[0].length !== 0 ) {
                        break;
                    }
                }
            }
        }

        // default to english if we lack a match, or match has zero length
        if ( trans.length === 0 || trans[0].length === 0 ) {
            trans = [ msgid, msgid_plural ];
        }

        var translation = trans[0];
        if (msgid_plural) {
            var p;
            if (found && domain_used.head.plural_func) {
                var rv = domain_used.head.plural_func(n);
                if (! rv.plural) {
                    rv.plural = 0;
                }
                if (! rv.nplural) {
                    rv.nplural = 0;
                }
                // if plurals returned is out of bound for total plural forms
                if (rv.nplural <= rv.plural) {
                    rv.plural = 0;
                }
                p = rv.plural;
            } else {
                p = (n != 1) ? 1 : 0;
            }
            if (trans[p]) {
                translation = trans[p];
            }
        }

        return translation;
    }
};


module.exports = new Gettext();
module.exports.Gettext = Gettext;

