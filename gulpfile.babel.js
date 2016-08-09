'use strict';

import gulp from 'gulp';
import gutil from 'gulp-util';
import babel from 'gulp-babel';
import webpack from 'webpack';
import webpackConfig from './webpack.config.babel'

gulp.task("default", ['webpack']);

gulp.task("babel", () => {
	return gulp.src('src/*.js')
		.pipe(babel())
		.pipe(gulp.dest('lib'));
});

gulp.task('webpack', ['babel'], (callback) => {
	var config = Object.create(webpackConfig);
	config.plugins = [
		new webpack.optimize.DedupePlugin(),
		new webpack.optimize.UglifyJsPlugin()
	];
	webpack(config, function(err, stats){
		if(err) throw new gutil.PluginError('webpack', err);
		gutil.log("[webpack]", stats.toString({
			colors: true,
			progress: true
		}));
		callback();
	});
});