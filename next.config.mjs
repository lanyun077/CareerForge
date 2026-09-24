/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdfjs-dist / pg 仅在服务端使用，保持外部依赖避免打包问题
  serverExternalPackages: ['pdfjs-dist', 'pg', 'mammoth'],
};

export default nextConfig;
