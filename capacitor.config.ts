import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.transcoreai',
  appName: 'TransCore AI',
  webDir: 'dist/client',
  server: {
    androidScheme: 'https',
    // For live-reload against the Lovable preview, uncomment and set the URL:
    // url: 'https://transcoreai.lovable.app',
    // cleartext: false,
  },
  android: {
    backgroundColor: '#0B0D10',
  },
};

export default config;