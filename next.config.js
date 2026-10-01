/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // the site is a static page in public/ (index.html, map.html, css/, js/, img/).
  // serve it at the root before the old next pages get a look in.
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/", destination: "/index.html" },
        { source: "/map", destination: "/map.html" },
        // nda media lives under /nda so the access cookie (Path=/nda) rides
        // along; the handler is an api route. see docs/nda.md "media".
        { source: "/nda/media/:section/:file", destination: "/api/nda/media/:section/:file" },
      ],
    };
  },
  // the nda pages and api are private: never cached, never indexed (the pages
  // set these too; this covers anything that slips past them)
  async headers() {
    const priv = [
      { key: "Cache-Control", value: "private, no-store" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
      { key: "Referrer-Policy", value: "no-referrer" },
    ];
    return [
      { source: "/nda", headers: priv },
      { source: "/nda/:path*", headers: priv },
      { source: "/api/nda/:path*", headers: priv },
    ];
  },
  webpack: (config, options) => {
    config.module.rules.push({
      test: /\.(glsl|vs|fs|vert|frag)$/,
      exclude: /node_modules/,
      use: ["raw-loader", "glslify-loader"],
    });
    return config;
  },
};

module.exports = nextConfig;
