module.exports = function(config) {
    config.set({
        basePath: '.',
        frameworks: ['mocha'],
        files: [
            'build/bundle.js',
            'external/diff_match_patch_uncompressed.js',
            'node_modules/expect.js/expect.js',
            'build/test-bundle.js'
        ],
        reporters : ['spec', 'growler']
    });
};