import path from 'path';

module.exports = {
	entry: {
		preload: './lib/embed.js'
	},
	output: {
		path: path.join(__dirname, 'dist'),
		filename: '[name].bundle.js',
		chunkFilename: '[id].bundle.js'
	}
}