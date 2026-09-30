/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    return {
      // a raiz serve directamente o simulador estático em public/index.html;
      // /comercial serve a mesma página com os pressupostos editáveis
      beforeFiles: [
        { source: '/', destination: '/index.html' },
        { source: '/comercial', destination: '/index.html' },
      ],
    };
  },
  async headers() {
    // a versão comercial é para uso interno: fora dos motores de busca
    return [
      { source: '/comercial', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
    ];
  },
};

export default nextConfig;
