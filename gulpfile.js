var fs = require('fs');
var gulp = require('gulp');
var gutil = require('gulp-util');
var plugins = require('gulp-load-plugins')();

var packageInfo = JSON.parse(fs.readFileSync('./package.json'));
var browsers = process.env.BROWSERS || process.env.BROWSER || 'PhantomJS';
browsers = browsers ? browsers.split(' ') : undefined;

gulp.task('default', ['build', 'test']);

gulp.task('clean', function() {
    return gulp.src(['./build', './test-external'], {read: false})
        .pipe(plugins.clean());
});

var watching = false;
var plumber = function() {
    return watching ? plugins.plumber() : gutil.noop();
};

gulp.task('lint', function() {
    var jshintOptions = fs.readFileSync('./.jshintrc').toString().replace(/\/\/.*/g, '');
    jshintOptions = JSON.parse(jshintOptions);
    return gulp.src([
            'gulpfile.js',
            './src/**/*.js',
            './test/**/*.js',
            '!./src/jsondiffpatch*.js',
            '!**/*_old.js'
        ])
        .pipe(plumber())
        .pipe(plugins.jshint(jshintOptions))
        .pipe(plugins.jshint.reporter('jshint-stylish'))
        .pipe(plugins.jshint.reporter('fail'))
        .pipe(plumber());
});

var buildDependencies = ['lint'];
var bundle = function(options) {
    var name = options.name || 'bundle';
    var src = options.src || './src/main.js';
    var minify = options.minify !== false;
    gulp.task(name, ['clean'], function() {
        if (fs.existsSync('./build/'+name+'.js') && (!minify || fs.existsSync('./build/'+name+'.min.js'))) {
            console.log(name + ' already exists');
            return;
        }

        var stream = gulp.src(src)
            .pipe(plugins.replace('{{package-version}}', packageInfo.version))
            .pipe(plugins.replace('{{package-homepage}}', packageInfo.homepage))
            .pipe(plugins.browserify(options.browserifyOptions || {}))
            .pipe(plugins.rename(name+'.js'))
            .pipe(gulp.dest('./build'));
        if (!minify) { return stream; }
        return stream.pipe(plugins.uglify())
            .pipe(plugins.rename(name+'.min.js'))
            .pipe(gulp.dest('./build'));
    });
    buildDependencies.push(name);
};

bundle({
    browserifyOptions: {
        standalone: packageInfo.name,
        exclude: '../../external/diff_match_patch_uncompressed'
    }
});
bundle({
    name: 'bundle-full',
    browserifyOptions: {
        standalone: packageInfo.name
    }
});

bundle({
    name: 'formatters',
    src: './src/formatters/index.js',
    browserifyOptions: {
        standalone: packageInfo.name + '.formatters'
    }
});

bundle({
    name: 'test-bundle',
    src: './test/test.js',
    minify: false
});

gulp.task('copy-test-res', ['clean'], function() {
    gulp.src('./node_modules/expect.js/index.js')
      .pipe(plugins.rename('expect.js'))
      .pipe(gulp.dest('./test-external'));
    gulp.src('./node_modules/mocha/mocha.js')
      .pipe(gulp.dest('./test-external'));
    gulp.src('./node_modules/mocha/mocha.css')
      .pipe(gulp.dest('./test-external'));
});

buildDependencies.push('copy-test-res');

gulp.task('build', buildDependencies, function() {
});

gulp.task('test', ['lint'], function () {
    return gulp.src('./test/**.js')
        .pipe(plumber())
        .pipe(plugins.mocha({
            grep: process.env.FILTER || undefined,
            reporter: 'spec',
            growl: true
        }))
        .pipe(plumber());
});

gulp.task('test-browser', ['build'], function() {
    return gulp.src('./file-list-at-karma-conf-file')
        .pipe(plugins.karma({
            configFile: 'karma.conf.js',
            browsers: browsers,
            action: 'run'
        }));
});

gulp.task('watch', ['test'], function() {
    watching = true;
    return gulp.watch(['external/**', 'src/**', 'test/**'], ['test'])
    .on('error', gutil.log);
});