var fs = require('fs');
var gulp = require('gulp');
var gutil = require('gulp-util');
var plugins = require("gulp-load-plugins")();

var packageInfo = JSON.parse(fs.readFileSync('./package.json'));

gulp.task('build', function() {
    gulp.src('./src/main.js')
        .pipe(plugins.browserify({
            standalone: packageInfo.name,
            exclude: "../../lib/diff_match_patch_uncompressed"
        }))
        .pipe(plugins.rename('bundle.js'))
        .pipe(gulp.dest('./build'))
        .pipe(plugins.uglify())
        .pipe(plugins.rename('bundle.min.js'))
        .pipe(gulp.dest('./build'))
});

gulp.task('build-full', function() {
    gulp.src('./src/main.js')
        .pipe(plugins.browserify({
            standalone: "jsondiffpatch"
        }))
        .pipe(plugins.rename('bundle-full.js'))
        .pipe(gulp.dest('./build'))
        .pipe(plugins.uglify())
        .pipe(plugins.rename('bundle-full.min.js'))
        .pipe(gulp.dest('./build'))
});

gulp.task('build-test', ['build'], function() {
    gulp.src('./test/test.js')
        .pipe(plugins.browserify({
        }))
        .pipe(plugins.rename('test-bundle.js'))
        .pipe(gulp.dest('./build'))
});

gulp.task('test', ['build-test'], function () {
    gulp.src('./test/**.js')
        .pipe(plugins.mocha({
            grep: process.env.FILTER || undefined,
            reporter: 'spec',
            growl: true
        }));
});

var browsers = process.env.BROWSERS || process.env.BROWSER || 'Firefox';

gulp.task('test-browser', ['build-test'], function() {
    return gulp.src('./file-list-at-karma-conf-file')
        .pipe(plugins.karma({
            configFile: 'karma.conf.js',
            browsers: browsers.split(' '),
            action: 'run'
        }))
});

gulp.task('watch-browser', ['build-test'], function() {
    return gulp.src('./file-list-at-karma-conf-file')
        .pipe(plugins.karma({
            configFile: 'karma.conf.js',
            browsers: browsers.split(' '),
            action: 'watch'
        }))
});

gulp.task('watch', function() {

    gulp.watch(['./lib/**', './src/**', './test/**'], ['test']);
});

gulp.task('default', ['test']);