'use strict';

const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const { DefinePlugin, NormalModuleReplacementPlugin, HashedModuleIdsPlugin } = require('webpack');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const NodemonPlugin = require('nodemon-webpack-plugin');
const packageJson = require('./package.json');
const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = (env = {}) => {
  const config = {
    entry: ['./src/main.ts'],
    mode: env.development ? 'development' : 'production',
    target: 'node',
    // devtool alternatives: cheap-module-eval-source-map (faster, less details) or cheap-eval-source-map (fastest, even less details)
    devtool: env.development ? 'inline-source-map' : false,
    node: {
      __dirname: false, // Fix for native node __dirname
      __filename: false, // Fix for native node __filename
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      // // filename: `[name].[contenthash:8].js`
      // filename: `[name].js`
      filename: `${packageJson.name}.js`,
    },
    resolve: {
      extensions: ['.ts', '.js'],
      modules: ['node_modules', 'src'],
    },
    stats: {
      modules: false, // We don't need to see this
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
      ],
    },
    plugins: [
      // new HashedModuleIdsPlugin(), // so that file hashes don't change unexpectedly
      new CleanWebpackPlugin(),
      new DefinePlugin({
        VERSION: JSON.stringify(packageJson.version),
        DEVELOP: env.development,
      }),
      // Use module replacement to use different configs for dev and prod
      new NormalModuleReplacementPlugin(
        /[\\/]src[\\/]config[\\/]config.ts$/, // [\\/] works on all operating systems.
        env.development ? 'config.dev.ts' : 'config.ts'
      ),
    ],
    // https://stackoverflow.com/questions/48985780/webpack-4-create-vendor-chunk
    // optimization: {
    //   splitChunks: {
    //     cacheGroups: {
    //       vendor: {
    //         chunks: 'initial',
    //         name: 'vendor',
    //         test: 'vendor',
    //         enforce: true
    //       },
    //     }
    //   },
    //   runtimeChunk: true
    // }
    externals: [nodeExternals()]
    // https://stackoverflow.com/questions/57131221/how-to-bundle-each-node-module-as-separate-bundle-in-webpack
  // optimization: {
  //   runtimeChunk: 'single',
  //   splitChunks: {
  //     chunks: 'all',
  //     maxInitialRequests: Infinity,
  //     minSize: 0,
  //     cacheGroups: {
  //       vendor: {
  //         test: /[\\/]node_modules[\\/]/,
  //         name(module) {
  //           // get the name. E.g. node_modules/packageName/not/this/part.js
  //           // or node_modules/packageName
  //           const packageName = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/)[1];

  //           // npm package names are URL-safe, but some servers don't like @ symbols
  //           return `npm.${packageName.replace('@', '')}`;
  //         },
  //       },
  //     },
  //   },
  // },
    // https://webpack.js.org/configuration/externals/#string
    // externals:  {
    //   express: 'commonjs express',
    //   require_optional: 'commonjs require_optional'
    // }
  };

  if (env.nodemon) {
    config.watch = true;
    config.plugins.push(new NodemonPlugin());
  }

  if (env.analyse) {
    config.plugins.push(
      new BundleAnalyzerPlugin({
        analyzerMode: 'static', // Generates file instead of starting a web server
      })
    );
  }

  return config;
};
