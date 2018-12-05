'use strict'

var gulp = require('gulp');

var postcss = require('gulp-postcss');
var autoprefixer = require('autoprefixer');
var cssnano = require('cssnano');
var sass = require('gulp-sass');
 
sass.compiler = require('node-sass');

var ts = require("gulp-typescript");
var tsProject = ts.createProject("tsconfig.json");

gulp.task("typescript", function () {
    return tsProject.src()
      .pipe(tsProject())
      .js.pipe(gulp.dest('./dist/js'));
});

gulp.task('sass', function () {
    var plugins = [
      autoprefixer({browsers: ['last 1 version']}),
      cssnano()
    ];

    return gulp.src('./src/stylesheets/*.scss')
      .pipe(sass().on('error', sass.logError))
      .pipe(postcss(plugins))
      .pipe(gulp.dest('./dist/css'));
});

gulp.task('default', function() {
  gulp.watch('./src/scripts/*.ts', ['typescript']);
  gulp.watch('./src/stylesheets/*.scss', ['sass']);
});
