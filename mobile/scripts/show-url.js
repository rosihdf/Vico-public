#!/usr/bin/env node
/**
 * Zeigt die Expo Dev-URL und einen Link zum QR-Code-Generator.
 * Nützlich, wenn der QR-Code im Terminal nicht angezeigt wird.
 */

const os = require('os')

const PORT = process.env.EXPO_DEVTOOLS_LISTEN_ADDRESS?.split(':')[1] || 8081

const getLocalIP = () => {
  try {
    const nets = os.networkInterfaces()
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        const family = typeof net.family === 'string' ? net.family : net.family === 4 ? 'IPv4' : null
        if (family === 'IPv4' && !net.internal) {
          return net.address
        }
      }
    }
  } catch {
    // Fallback bei Sandbox oder Netzwerk-Fehler
  }
  return '192.168.x.x'
}

const ip = getLocalIP()
const expUrl = `exp://${ip}:${PORT}`

console.log('')
console.log('📱 Expo Dev-URL (für Expo Go auf dem Handy):')
console.log('')
console.log('   ' + expUrl)
console.log('')
console.log('   In Expo Go: "Enter URL manually" → obige URL eingeben')
if (ip === '192.168.x.x') {
  console.log('')
  console.log('   ⚠️  IP konnte nicht ermittelt werden. Terminal außerhalb')
  console.log('       der IDE in Terminal.app öffnen und erneut ausführen.')
  console.log('')
}
console.log('')
console.log('   Oder QR-Code erstellen: https://qr.expo.dev')
console.log('   → URL dort einfügen und scannen')
console.log('')
console.log('────────────────────────────────────────────────────────')
console.log('')
