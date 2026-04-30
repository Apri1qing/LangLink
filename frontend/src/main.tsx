import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { VoiceTranslateProvider } from './contexts/VoiceTranslateContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <VoiceTranslateProvider>
      <App />
    </VoiceTranslateProvider>
  </StrictMode>,
)
