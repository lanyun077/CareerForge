/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf-parse 仅在服务端使用，保持外部依赖避免打包问题
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse'],
  },
};

export default nextConfig;
