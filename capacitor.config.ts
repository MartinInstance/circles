import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'dev.circles.app',
  appName: 'Circles',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: '#03071e'
    },
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#00000000',
      overlaysWebView: true
    }
  }
}

export default config
