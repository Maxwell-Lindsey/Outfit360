/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Fixes npm packages that depend on `fs` module
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        child_process: false,
        net: false,
        tls: false,
      };
    }

    // Add rule to handle .node files
    config.module.rules.push({
      test: /\.node$/,
      use: 'node-loader',
    });

    // Exclude problematic files from webpack processing
    config.module.rules.push({
      test: /\.html$/,
      issuer: /node_modules\/@mapbox\/node-pre-gyp/,
      use: 'null-loader',
    });

    // Exclude specific modules from webpack processing
    config.externals = [
      ...(config.externals || []),
      { '@mapbox/node-pre-gyp': 'commonjs @mapbox/node-pre-gyp' },
    ];

    return config;
  },
}

export default nextConfig; 