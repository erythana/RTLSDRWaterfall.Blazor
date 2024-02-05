const path = require('path');
module.exports = {
    entry: './src/index.js',
    devtool: 'source-map',
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: [ '.tsx', '.ts', '.js' ],
    },
    output: {
        filename: 'index.bundle.js',
        path: path.resolve(__dirname, '../wwwroot'),
        library: 'Waterfall',
        libraryTarget:'umd',
    },
};