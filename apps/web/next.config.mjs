/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@cfo-ai/db", "@cfo-ai/integrations", "@cfo-ai/shared"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb", // pra import de CSVs/OFX maiores
    },
  },
  // Os pacotes locais usam imports estilo NodeNext (".js" em fontes ".ts").
  // Webpack precisa saber resolver isso.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
