const { composePlugins, withNx } = require('@nx/webpack');
const { join } = require('path');

module.exports = composePlugins(withNx(), (config, { options, context }) => {
  // Ensure proper entry point
  if (!config.entry) {
    config.entry = options.main || join(context.root, 'api/src/main.ts');
  }
  
  // Ensure proper output
  if (!config.output) {
    config.output = {
      path: join(context.root, options.outputPath || 'dist/api'),
      filename: 'main.js',
    };
  }

  // Node.js externals
  config.externals = config.externals || [];
  config.externals.push({
    '@nestjs/microservices': 'commonjs @nestjs/microservices',
    '@nestjs/websockets/socket-module': 'commonjs @nestjs/websockets/socket-module',
  });

  // Resolve configuration
  config.resolve = config.resolve || {};
  config.resolve.extensions = ['.ts', '.js', '.json'];
  config.resolve.alias = config.resolve.alias || {};

  return config;
});
