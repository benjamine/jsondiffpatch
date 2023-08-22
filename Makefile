build: node_modules
	npm run build
clean:
	rm -rf dist
	rm -rf coverage
test: node_modules
	npm run test
node_modules:
	npm install

.PHONY: test build dist
