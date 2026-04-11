import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/TwCu/', // GitHub Pages'te düzgün çalışması için deponun adını yazıyoruz
})