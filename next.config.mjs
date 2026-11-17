/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "5mb" }, // comprovativos até 5 MB
  },
  images: { unoptimized: true }, // poupa custos de otimização de imagens na Vercel
};
export default nextConfig;
