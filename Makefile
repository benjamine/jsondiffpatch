filter = ""
browser="Firefox"
libname="jsondiffpatch"

build: dist/bundle.min.js dist/bundle-full.min.js test/test-bundle.js
node_modules:
	npm install
dist/bundle.js: node_modules
	@./node_modules/.bin/browserify ./src/main.js --exclude "../../lib/diff_match_patch_uncompressed" --standalone $(libname) --outfile dist/bundle.js
	@echo dist/bundle.js built
dist/bundle.min.js: dist/bundle.js
	@./node_modules/.bin/uglifyjs ./dist/bundle.js > ./dist/bundle.min.js
	@echo dist/bundle.min.js built
dist/bundle-full.js: node_modules
	@./node_modules/.bin/browserify ./src/main.js --standalone $(libname) --outfile dist/bundle-full.js
	@echo dist/bundle-full.js built
dist/bundle-full.min.js: dist/bundle-full.js
	@./node_modules/.bin/uglifyjs ./dist/bundle-full.js > ./dist/bundle-full.min.js
	@echo dist/bundle-full.min.js built
test/test-bundle.js:
	@./node_modules/.bin/browserify ./test/test.js --outfile ./test/test-bundle.js
	@echo test/test-bundle.js built
clean:
	@rm -f dist/*.js
	@rm -f test/test-bundle.js
	@echo cleaned
clean-dependencies: clean
	@rm -Rf node_modules
	@echo cleaned dependencies
test: build
	@./node_modules/.bin/mocha --reporter spec --recursive ./test --grep $(filter)
watch: build
	@./node_modules/.bin/mocha --reporter spec --recursive ./test --grep $(filter) --watch --growl
test-browser: build test/test-bundle.js
	@./node_modules/.bin/karma start --single-run --browsers $(browser)
.PHONY: build clean test test-browser watch