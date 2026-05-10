/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@cfo-ai/db", "@cfo-ai/shared"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb", // pra import de CSVs/OFX maiores
    },
  },
};

export default nextConfig;
