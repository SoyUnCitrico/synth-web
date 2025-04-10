import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: 'https://github.com/SoyUnCitrico/synth-web',
  server: {
    port: 3000,       
    host: '0.0.0.0',  
    strictPort: true,
    // Para testeo de vistas en otros dispositivos con: npx localtunnel --port 3000  
    // allowedHosts: ['eager-groups-see.loca.lt'] 
  },
})
