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

var fs = require('fs'), path = require('path');

/* verify that an object exists and is valid */
var isValidObject = function (thisObject) {
    if (null === thisObject) {
        return false;
    } else if ('undefined' == typeof(thisObject) ) {
        return false;
    } else {
        return true;
    }
};

/* verify that something is an array */
var isArray = function (thisObject) {
    return isValidObject(thisObject) && thisObject.constructor == Array;
};

var parse_po_dequote = function(str) {
    var match;
    if ((match = str.match(/^"(.*)"/))) {
        str = match[1];
    }
    // unescale all embedded quotes (fixes bug #17504)
    str = str.replace(/\\"/g, "\"");
    return str;
};


var domain = 'messages';
var lang = process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANGUAGES || process.env.LANG || '';
var context_glue = "\004";
var _locale_data = {};


// This takes the bin/po2json'd data, and moves it into an internal form
// for use in our lib, and puts it in our object as:
//  _locale_data = {
//      domain : {
//          head : { headfield : headvalue },
//          msgs : {
//              msgid : [ msgid_plural, msgstr, msgstr_plural ],
//          },
var parse_locale_data = function(locale_data, l) {
    if (typeof(_locale_data) == 'undefined') {
        _locale_data = { };
    }

    if (!l) {
        l = lang;
    }

    if (typeof _locale_data[l] == 'undefined') {
        _locale_data[l] = {};
    }

    var domain;

    // suck in every domain defined in the supplied data
    for (domain in locale_data) {
        // skip empty specs (flexibly)
        if ((! locale_data.hasOwnProperty(domain)) || (! isValidObject(locale_data[domain]))) {
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
        if (! isValidObject(_locale_data[l][domain]) ) {
            _locale_data[l][domain] = { };
        }
        if (! isValidObject(_locale_data[l][domain].head) ) {
            _locale_data[l][domain].head = { };
        }
        if (! isValidObject(_locale_data[l][domain].msgs) ) {
            _locale_data[l][domain].msgs = { };
        }

        for (var key in data) {
            if (key === "") {
                var header = data[key];
                for (var head in header) {
                    var h = head.toLowerCase();
                    _locale_data[l][domain].head[h] = header[head];
                }
            } else {
                _locale_data[l][domain].msgs[key] = data[key];
            }
        }
    }

    // build the plural forms function
    for (domain in _locale_data[l]) {
        if (isValidObject(_locale_data[l][domain].head['plural-forms']) &&
            typeof(_locale_data[l][domain].head.plural_func) == 'undefined') {
            // untaint data
            var plural_forms = _locale_data[l][domain].head['plural-forms'];
            var pf_re = new RegExp('^(\\s*nplurals\\s*=\\s*[0-9]+\\s*;\\s*plural\\s*=\\s*(?:\\s|[-\\?\\|&=!<>+*/%:;a-zA-Z0-9_\\(\\)])+)', 'm');
            if (pf_re.test(plural_forms)) {
                //ex english: "Plural-Forms: nplurals=2; plural=(n != 1);\n"
                //pf = "nplurals=2; plural=(n != 1);";
                //ex russian: nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10< =4 && (n%100<10 or n%100>=20) ? 1 : 2)
                //pf = "nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2)";

                var pf = _locale_data[l][domain].head['plural-forms'];
                if (! /;\s*$/.test(pf)) {
                    pf = pf.concat(';');
                }
                /* We used to use eval, but it seems IE has issues with it.
                 * We now use "new Function", though it carries a slightly
                 * bigger performance hit.
                var code = 'function (n) { var plural; var nplurals; '+pf+' return { "nplural" : nplurals, "plural" : (plural === true ? 1 : plural ? plural : 0) }; };';
                _locale_data[l][domain].head.plural_func = eval("("+code+")");
                */
                var code = 'var plural; var nplurals; '+pf+' return { "nplural" : nplurals, "plural" : (plural === true ? 1 : plural ? plural : 0) };';
                _locale_data[l][domain].head.plural_func = new Function("n", code);
            } else {
                throw new Error("Syntax error in language file. Plural-Forms header is invalid ["+plural_forms+"]");
            }   

        // default to english plural form
        } else if (typeof(_locale_data[l][domain].head.plural_func) == 'undefined') {
            _locale_data[l][domain].head.plural_func = function (n) {
                var p = (n != 1) ? 1 : 0;
                return { 'nplural' : 2, 'plural' : p };
            };
        } // else, plural_func already created
    }

    return;
};
    

var parse_po = function(data) {
    var rv = {};
    var buffer = {};
    var lastbuffer = "";
    var errors = [];
    var lines = data.split("\n");
    var msg_ctxt_id, msgid_plural, trans, match;

    for (var i=0; i<lines.length; i++) {
        // chomp
        lines[i] = lines[i].replace(/(\n|\r)+$/, '');

        // Empty line / End of an entry.
        if (/^$/.test(lines[i])) {
            if (typeof(buffer.msgid) != 'undefined') {
                msg_ctxt_id = (typeof(buffer.msgctxt) != 'undefined' &&
                                   buffer.msgctxt.length) ?
                                  buffer.msgctxt+context_glue+buffer.msgid :
                                  buffer.msgid;
                msgid_plural = (typeof(buffer.msgid_plural) != 'undefined' &&
                                    buffer.msgid_plural.length) ?
                                   buffer.msgid_plural :
                                   null;

                // find msgstr_* translations and push them on
                trans = [];
                for (var str in buffer) {
                    if ((match = str.match(/^msgstr_(\d+)/))) {
                        trans[parseInt(match[1], 10)] = buffer[str];
                    }
                }
                trans.unshift(msgid_plural);

                // only add it if we've got a translation
                // NOTE: this doesn't conform to msgfmt specs
                if (trans.length > 1) {
                    rv[msg_ctxt_id] = trans;
                }

                buffer = {};
                lastbuffer = "";
            }

        // comments
        } else if (/^#/.test(lines[i])) {
            continue;
        // msgctxt
        } else if ((match = lines[i].match(/^msgctxt\s+(.*)/))) {
            lastbuffer = 'msgctxt';
            buffer[lastbuffer] = parse_po_dequote(match[1]);
        // msgid
        } else if ((match = lines[i].match(/^msgid\s+(.*)/))) {
            lastbuffer = 'msgid';
            buffer[lastbuffer] = parse_po_dequote(match[1]);
        // msgid_plural
        } else if ((match = lines[i].match(/^msgid_plural\s+(.*)/))) {
            lastbuffer = 'msgid_plural';
            buffer[lastbuffer] = parse_po_dequote(match[1]);
        // msgstr
        } else if ((match = lines[i].match(/^msgstr\s+(.*)/))) {
            lastbuffer = 'msgstr_0';
            buffer[lastbuffer] = parse_po_dequote(match[1]);
        // msgstr[0] (treak like msgstr)
        } else if ((match = lines[i].match(/^msgstr\[0\]\s+(.*)/))) {
            lastbuffer = 'msgstr_0';
            buffer[lastbuffer] = parse_po_dequote(match[1]);
        // msgstr[n]
        } else if ((match = lines[i].match(/^msgstr\[(\d+)\]\s+(.*)/))) {
            lastbuffer = 'msgstr_'+match[1];
            buffer[lastbuffer] = parse_po_dequote(match[2]);
        // continued string
        } else if (/^"/.test(lines[i])) {
            buffer[lastbuffer] += parse_po_dequote(lines[i]);
        // something strange
        } else {
            errors.push("Strange line ["+i+"] : "+lines[i]);
        }
    }


    // handle the final entry
    if (typeof(buffer.msgid) != 'undefined') {
        msg_ctxt_id = (typeof(buffer.msgctxt) != 'undefined' &&
                           buffer.msgctxt.length) ?
                          buffer.msgctxt+context_glue+buffer.msgid :
                          buffer.msgid;
        msgid_plural = (typeof(buffer.msgid_plural) != 'undefined' &&
                            buffer.msgid_plural.length) ?
                           buffer.msgid_plural :
                           null;

        // find msgstr_* translations and push them on
        trans = [];
        for (var str in buffer) {
            if ((match = str.match(/^msgstr_(\d+)/))) {
                trans[parseInt(match[1], 10)] = buffer[str];
            }
        }
        trans.unshift(msgid_plural);

        // only add it if we've got a translation
        // NOTE: this doesn't conform to msgfmt specs
        if (trans.length > 1) {
            rv[msg_ctxt_id] = trans;
        }

        buffer = {};
        lastbuffer = "";
    }


    // parse out the header
    if (rv[""] && rv[""][1]) {
        var cur = {};
        var hlines = rv[""][1].split(/\\n/);
        for (i=0; i<hlines.length; i++) {
            if (! hlines.length) {
                continue;
            }

            var pos = hlines[i].indexOf(':', 0);
            if (pos != -1) {
                var key = hlines[i].substring(0, pos);
                var val = hlines[i].substring(pos +1);
                var keylow = key.toLowerCase();

                if (cur[keylow] && cur[keylow].length) {
                    errors.push("SKIPPING DUPLICATE HEADER LINE: "+hlines[i]);
                } else if (/#-#-#-#-#/.test(keylow)) {
                    errors.push("SKIPPING ERROR MARKER IN HEADER: "+hlines[i]);
                } else {
                    // remove begining spaces if any
                    val = val.replace(/^\s+/, '');
                    cur[keylow] = val;
                }

            } else {
                errors.push("PROBLEM LINE IN HEADER: "+hlines[i]);
                cur[hlines[i]] = '';
            }
        }

        // replace header string with assoc array
        rv[""] = cur;
    } else {
        rv[""] = {};
    }

    // GNU Gettext silently ignores errors. So will we.

    return rv;
};

var Gettext = module.exports = {
    loadLanguageFile: function(file, l, callback) {
        if (! file) {
            return;
        }

        if (!callback) {
            callback = l;
            l = lang;
        }
        var domain = path.basename(file, '.po');

        fs.readFile(file, 'utf8', function(err, data) {
            if (err) {
                return callback(err);
            }
            var parsed = parse_po(data);

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

                parse_locale_data(rv, l);
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
            var pendingDirectories = files.length;
            if (!pendingDirectories) {
                return callback && callback();
            }
            files.forEach(function (file) {
                file = directory + '/' + file;
                fs.stat(file, function (err, stats) {
                    if (!err && stats.isDirectory()) {
                        var l = file.match(/[^\/]+$/)[0];
                        fs.readdir(file, function (err, files) {
                            var pendingFiles = files.length;
                            if (!pendingFiles) {
                                if (!--pendingDirectories) {
                                    return callback && callback();
                                }
                            }
                            files.forEach(function (file) {
                                file = directory + '/' + l + '/' + file;
                                if (path.extname(file) == '.po') {
                                    fs.stat(file, function (err, stats) {
                                        if (!err && stats.isFile()) {
                                            that.loadLanguageFile(file, l, function () {
                                                if (!--pendingFiles) {
                                                    if (!--pendingDirectories) {
                                                        return callback && callback();
                                                    }
                                                }
                                            });
                                        } else {
                                            if (!--pendingFiles) {
                                                if (!--pendingDirectories) {
                                                    return callback && callback();
                                                }
                                            }
                                        }
                                    });
                                } else {
                                    if (!--pendingFiles) {
                                        if (!--pendingDirectories) {
                                            return callback && callback();
                                        }
                                    }
                                }
                            });
                        });
                    } else {
                        console.log(file);
                        if (!--pendingDirectories) {
                            return callback && callback();
                        }
                    }
                });
            });
        });
    },
    setlocale: function (category, locale) {
        // ignore category for now
        category = 'LC_ALL';
        lang = locale;
    },
    textdomain: function (d) {
        if (d && d.length)  {
            domain = d;
        }
        return domain;
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
        if (! isValidObject(msgid)) {
            return '';
        }

        var plural = isValidObject(msgid_plural);
        var msg_ctxt_id = isValidObject(msgctxt) ? msgctxt+context_glue+msgid : msgid;

        var domainname = isValidObject(d)      ? d :
                         isValidObject(domain) ? domain :
                                                'messages';

        // category is always LC_MESSAGES. We ignore all else
        var category_name = 'LC_MESSAGES';
        category = 5;

        var locale_data = []; 
        if (typeof(_locale_data[lang]) != 'undefined' &&
            isValidObject(_locale_data[lang][domainname])) {
                locale_data.push( _locale_data[lang][domainname] );

        } else if (typeof(_locale_data[lang]) != 'undefined') {
            // didn't find domain we're looking for. Search all of them.
            for (var dom in _locale_data[lang]) {
                locale_data.push( _locale_data[lang][dom] );
            }
        }

        var trans = [];
        var found = false;
        var domain_used; // so we can find plural-forms if needed
        if (locale_data.length) {
            for (var i=0; i<locale_data.length; i++) {
                var locale = locale_data[i];
                if (isValidObject(locale.msgs[msg_ctxt_id])) {
                    // make copy of that array (cause we'll be destructive)
                    for (var j=0; j<locale.msgs[msg_ctxt_id].length; j++) {
                        trans[j] = locale.msgs[msg_ctxt_id][j];
                    }
                    trans.shift(); // throw away the msgid_plural
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
        if (plural) {
            var p;
            if (found && isValidObject(domain_used.head.plural_func) ) {
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
            if (isValidObject(trans[p])) {
                translation = trans[p];
            }
        }

        return translation;
    },
    /* utility method, since javascript lacks a printf */
    strargs: function (str, args) {
        // make sure args is an array
        if ( null === args ||
             'undefined' == typeof(args) ) {
            args = [];
        } else if (args.constructor != Array) {
            args = [args];
        }

        // NOTE: javascript lacks support for zero length negative look-behind
        // in regex, so we must step through w/ index.
        // The perl equiv would simply be:
        //    $string =~ s/(?<!\%)\%([0-9]+)/$args[$1]/g;
        //    $string =~ s/\%\%/\%/g; # restore escaped percent signs

        var newstr = "";
        while (true) {
            var i = str.indexOf('%');
            var match_n;

            // no more found. Append whatever remains
            if (i == -1) {
                newstr += str;
                break;
            }

            // we found it, append everything up to that
            newstr += str.substr(0, i);

            // check for escpaed %%
            if (str.substr(i, 2) == '%%') {
                newstr += '%';
                str = str.substr((i+2));

            // % followed by number
            } else if ((match_n = str.substr(i).match(/^%(\d+)/))) {
                var arg_n = parseInt(match_n[1], 10);
                var length_n = match_n[1].length;
                if ( arg_n > 0 && args[arg_n -1] !== null && typeof(args[arg_n -1]) != 'undefined' ) {
                    newstr += args[arg_n -1];
                }
                str = str.substr( (i + 1 + length_n) );

            // % followed by some other garbage - just remove the %
            } else {
                newstr += '%';
                str = str.substr((i+1));
            }
        }

        return newstr;
    }
};


