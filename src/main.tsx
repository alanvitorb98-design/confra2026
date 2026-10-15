import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { DarkHint } from './components/DarkHint.tsx'
import { UpdateGate } from './components/UpdateGate.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <DarkHint />
    <UpdateGate />
  </StrictMode>,
)
