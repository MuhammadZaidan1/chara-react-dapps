import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
// import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // resolve: {
  //   alias: {
  //     'viem': path.resolve(__dirname, 'node_modules/viem/index.ts'),
  //   },
  // },
  // optimizeDeps: {
  //   exclude: [
  //     '@privy-io/react-auth',
  //     'viem',
  //     'bn.js',
  //     'js-sha3',
  //     'elliptic',
  //     'secp256k1',
  //     'keccak',
  //     'rlp',
  //     'ethjs-util',
  //     'browserify-aes',
  //     'cipher-base',
  //     'create-hash',
  //     'create-hmac',
  //     'hash.js',
  //   ],
  // },
})