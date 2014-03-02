module.exports = function(config) {
    config.set({
        basePath: '.',
        frameworks: ['mocha'],
        files: [
            'build/bundle.js',
            'external/diff_match_patch_uncompressed.js',
            'test-external/expect.js',
            'build/test-bundle.js'
        ],
        reporters : ['spec', 'growler']
    });
};