import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@vexera/types", "@vexera/utils"],
};

export default nextConfig;
