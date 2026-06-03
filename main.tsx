import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { Toaster } from 'react-hot-toast'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Toaster 
      position="bottom-right"
      toastOptions={{
        style: { borderRadius: '12px', fontWeight: 600, fontSize: '13px' },
        duration: 4000,
      }}
    />
    <App />
  </React.StrictMode>,
)