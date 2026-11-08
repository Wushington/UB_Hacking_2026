import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  logging: {
    // Forward only browser *errors* to the dev terminal/log. Forwarding routine warnings (Clerk
    // dev keys, image hints) on every render caused a rebuild → refetch → aborted-render loop
    // ("The server could not finish this Suspense boundary") on /explain.
    browserToTerminal: "error",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
