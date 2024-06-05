const path = require('path');

module.exports = {
  entry: './src/extension.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2'
  },
  target: 'node',
  mode: 'development',
  watch: true,
  devtool: 'source-map', // 确保启用 source map
  externals: {
    vscode: 'commonjs vscode'
  },
  resolve: {
    extensions: ['.js'],
    alias: {
      babylon: '@babel/parser'
    }
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader'
        }
      }
    ]
  }
};