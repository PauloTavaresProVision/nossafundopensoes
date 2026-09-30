/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    return {
      // todas as versões são a mesma página estática (public/index.html);
      // a versão é escolhida no browser pelo caminho
      beforeFiles: [
        { source: '/', destination: '/index.html' },
        { source: '/comercial', destination: '/index.html' },
        { source: '/particulares', destination: '/index.html' },
        { source: '/particulares/comercial', destination: '/index.html' },
      ],
    };
  },
  async headers() {
    // a versão comercial é para uso interno: fora dos motores de busca
    return [
      { source: '/comercial', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
      { source: '/particulares/comercial', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
    ];
  },
};

export default nextConfig;
