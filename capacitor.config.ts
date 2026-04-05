import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.backbone.quickpos',
  appName: 'quick-pos',
  webDir: 'dist',
  // Lets the WebView load http:// API URLs from capacitor:// (needed for HTTP SaaS API).
  android: {
    allowMixedContent: true,
  },
};

export default config;
