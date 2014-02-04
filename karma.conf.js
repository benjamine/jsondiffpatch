module.exports = function(config) {
  config.set({
    basePath: '.',
    frameworks: ['mocha'],
    files: ['dist/bundle.js', 'lib/diff_match_patch_uncompressed.js', 'test/test-bundle.js'],
	reporters : ['spec']
  });
};