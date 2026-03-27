import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configurações de segurança (CORS é tratado no middleware.ts)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          // HSTS: força HTTPS por 1 ano (Vercel já gerencia, mas explicitamos para defesa em profundidade)
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          // Impede que a API seja carregada como script cross-origin
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
        ],
      },
    ];
  },
  
  // Permitir imagens externas (Unsplash, etc)
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
};

export default nextConfig;

