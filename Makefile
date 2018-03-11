build: node_modules
	npm run build
dist: node_modules
	npm run build && npm run build-dist
clean:
	rm -rf build
	rm -rf dist
	rm -rf coverage
test: node_modules
	npm run test
node_modules:
	npm install

.PHONY: test build dist
