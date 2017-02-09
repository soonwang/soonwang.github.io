var gulp = require('gulp'),
    minifyCss = require('gulp-minify-css'),
    minifyHtml = require('gulp-minify-html'),
    uglify = require('gulp-uglify'),
    rename = require('gulp-rename'),
    clean = require('gulp-clean'),
    shell = require('gulp-shell');

    gulp.task('clean',function() {
        return gulp.src("dest/")
        .pipe(clean());
    });

    gulp.task('css', function() {
      return gulp.src(['public/**/*.css', '!public/**/*.min.css'])
        .pipe(minifyCss({compatibility: 'ie8'}))
        .pipe(gulp.dest('./dest/'));
    });

    gulp.task('js', function() {
      return gulp.src(['public/**/*.js', '!public/**/*.min.js'])
        .pipe(uglify())
        .pipe(gulp.dest('./dest/'));
    });

    gulp.task('html', function() {
      return gulp.src('public/**/*.html')
        .pipe(minifyHtml())
        .pipe(gulp.dest('./dest/'));
    });

    gulp.task('mv', ['css', 'html', 'js'], function() {
      return gulp.src('./dest/*')
        .pipe(shell(['cp -r ./dest/* ./public/']));
    });

    gulp.task('default', ['mv'], function() {
      console.log('gulp task finished')
    });

    gulp.task('watch', function() {
      gulp.watch('public/*', ['default'])
    });
