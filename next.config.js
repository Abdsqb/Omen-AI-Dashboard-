/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  webpack: (config, { isServer }) => {
    if (isServer) {
      /**
       * Tell webpack NOT to bundle node:sqlite — let Node resolve it at runtime.
       * config.externals can be an array, object, function, or undefined.
       * We must handle all cases safely instead of blindly spreading.
       */
      const existing = config.externals
      if (Array.isArray(existing)) {
        config.externals = [...existing, 'node:sqlite']
      } else if (existing !== undefined) {
        // Could be a function or object — wrap both in an array with our addition
        config.externals = [existing, 'node:sqlite']
      } else {
        config.externals = ['node:sqlite']
      }
    }
    return config
  },
}

module.exports = nextConfig
