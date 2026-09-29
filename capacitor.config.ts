import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.linkup.app",
  appName: "LinkUpApp",
  webDir: "dist",
  plugins: {
    PushNotifications: {
      presentationOptions: [],
    },
  },
  server: {
    // The deployed backend currently uses HTTP. Using https here makes the
    // packaged WebView an HTTPS origin, which can block HTTP API/WebSocket
    // calls as mixed content. Switch this back to "https" after the backend
    // is served over HTTPS.
    androidScheme: "http",
  },
};

export default config;
