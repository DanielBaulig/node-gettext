node-gettext
============

An adaption of Joshua I. Miller's Javascript Gettext library for node.js.

* Easy to use
* Loading from \*.po files.
* Plural, context and multi-language support
* Batch loading of entire translation directory trees
* LGPL licensed

node-gettext brings the power of the GNU gettext API to your node.js application.

Usage
-----

Simply require the library, load a few \*.po files and start using any of the gettext interfaces to translate your strings:

    var gettext = require('gettext'),
        _ = gettext.gettext;

    gettext.loadLanguageFile('./locale/de/messages.po', 'de');
    gettext.loadLanguageFile('./locale/fr/messages.po', 'fr');

    gettext.setlocale('LC_ALL', 'de');

    console.log(_('Hello, World!'));

    gettext.setlocale('LC_ALL', 'fr');

    console.log(_('Hello, World!'));


Install
-------

Install via npm

        npm install node-gettext

Documentation
-------------

* `setlocale(category, locale)` - Sets the locale application wide. If `locale` is the empty string, locale will be set to the default value, which is one of the following:

    1. `process.env.LC_ALL`
    2. `process.env.LC_MESSAGES`
    3. `process.env.LANGUAGES`
    4. `process.env.LANG`
    5. `''` *(empty string)*

    `category` is not used. Set to any value. All subsequent calls to any gettext function will now try to translate to the specified locale.

* `textdomain([domain])` - Returns the currently active domain. If `domain` was specified, sets the currently active domain to `domain`before returning it. 

* `loadLanguageFile(file, [locale], [callback])` - Loads the specified \*.po `file`. The translation table of the specified `locale` will be populated with the data found in the `file`. The textdomain will be set according to the filename. If `locale` was not specified, the data will be stored in the currently active translation table set by `setlocale`. If `callback` was specified it will be called after the translation data was loaded. Since all calls to gettext translation functions will fallback gracefully and return the given string if no applicable translation data was found, waiting for the translation data to be fully loaded before continueing is not required.

* `loadLocaleDirectory(directory, [callback])` - Loads translation data from the given `directory` tree. The function will look for subdirectories in the given `directory`. Those directories' names will be mapped to language/locale identifiers. Then each \*.po file in each of those subdirectories will be loaded, using the filename as the textdomain. If `callback` is given, it will be called after all files and directories where loaded. Again, due to gracefull fallback it is not necceseraly required to wait for the loading function to finish. An example directory structure could look like follows:

        Directory
            |
            |- en
            |    \
            |    |- messages.po
            |    |- other.po
            |    o
            |
            |- de
            |    \
            |    |- messages.po
            |    |- other.po
            |    o
            |
            |- fr
            o    \
                 |- messages.po
                 |- other.po
                 o

    This `directory` "Directory" contains 4 subdirectories "en", "de" and "fr" which represent languages and can be selected using `setlocale`. Each subdirectory itself contains 2 \*.po files "messages.po" and "other.po" which can be selected using the `textdomain` function.

* `gettext(string)` - Returns the translation for the given `string`. The translation is determined by evaluating the currently active locale and domain. If no valid translation is found, the given `string` is returned instead.

* `ngettext(singular, plural, n)` - Returns the translation for the given `singular` or `plural` form. Which translation is returned is determined by the amount `n` and the plural forms header. 

For a more detailed documentation please have a look at the [original Javascript Gettext library documentation](http://jsgettext.berlios.de/doc/html/Gettext.html).

Attribution
-----------

This library is based in wide parts on [Joshua I. Miller's Javascript Gettext library](http://jsgettext.berlios.de/).

License
-------

    node-gettext, an Javascript Gettext adaption for node.js

    Copyright (C) 2008 Joshua I. Miller <unrtst@cpan.org>
    Copyright (C) 2011 Daniel Baulig <daniel.baulig@gmx.de>

    This library is free software; you can redistribute it and/or
    modify it under the terms of the GNU Lesser General Public
    License as published by the Free Software Foundation; either
    version 2 of the License, or (at your option) any later version.

    This library is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
    Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public
    License along with this library; if not, write to the Free Software
    Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA 02111-1307  USA
