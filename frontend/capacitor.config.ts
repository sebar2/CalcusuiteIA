import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.calcu.logistics3pl',
  appName: 'Calcu 3PL Logistica',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
    cleartext: true,
    allowNavigation: ['100.*', '192.168.*', '*.ts.net', 'localhost']
  }
};

export default config;
