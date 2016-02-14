module.exports = function(config) {
  config.set({
    basePath: '.',
    frameworks: ['mocha'],
    files: [
      'public/build/jsondiffpatch.js',
      'public/build/jsondiffpatch-formatters.js',
      'public/external/diff_match_patch_uncompressed.js',
      'public/build/test-bundle.js'
    ],
    reporters : ['spec', 'growler']
  });
};
