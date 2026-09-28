import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.linkup.app',
  appName: 'LinkUpApp',
  webDir: 'dist',
  plugins: { PushNotifications: { presentationOptions: [] } },
  server: {
    androidScheme: 'https'
  }
};

export default config;
