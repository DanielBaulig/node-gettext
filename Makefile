PACKAGE = node-gettext.js
NODEJS = $(if $(shell test -f /usr/bin/nodejs && echo "true"),nodejs,node)

test:
	$(NODEJS) ./deps/nodeunit/bin/nodeunit test


.PHONY: test
