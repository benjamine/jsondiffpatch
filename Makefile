
build: node_modules
	@./node_modules/.bin/gulp build
node_modules:
	npm install
test: node_modules
	@./node_modules/.bin/gulp test
test-browser: node_modules
	@./node_modules/.bin/gulp test-browser
watch: node_modules
	@./node_modules/.bin/gulp watch
.PHONY: build test test-browser watch