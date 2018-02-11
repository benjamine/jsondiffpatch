build: node_modules
	npm run build

test: node_modules
	npm run test
node_modules:
	npm install

.PHONY: test build
