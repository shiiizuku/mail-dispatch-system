import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // These read files next to their own code (fonts, the letterhead, migrations) or are native
  // database drivers, so they must load from node_modules as-is rather than be bundled.
  serverExternalPackages: ['pg', 'pdfkit', '@mds/envelope', '@mds/mail', '@mds/reports'],
};

export default nextConfig;
