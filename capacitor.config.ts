import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'de.vico.app',
  appName: 'ArioVan',
  webDir: 'dist',
  // Optional: Live-Reload im Emulator (npm run dev, dann server.url auf z.B. http://192.168.x.x:5173)
  // server: { url: 'http://192.168.1.100:5173', cleartext: true },
};

export default config;
