
bundle: node_modules
	@./node_modules/.bin/gulp bundle

test: node_modules
	@./node_modules/.bin/gulp test
node_modules:
	npm install
watch: node_modules
	@./node_modules/.bin/gulp watch

test-browser: node_modules
	@./node_modules/.bin/gulp test-browser
watch-browser: node_modules
	@./node_modules/.bin/gulp watch-browser

.PHONY: test watch bundle test-browser watch-browser
