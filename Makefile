install:
	yarn
	yarn run flow-typed install

build:
	rm -rf dist
	yarn run build

test:
	yarn test

lint:
	yarn run eslint -- src test

publish:
	yarn publish

.PHONY: test
