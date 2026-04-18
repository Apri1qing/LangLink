import { useEffect, useState, useRef } from 'react'
import { useAppStore } from './stores/appStore'
import { Home } from './components/Home/Home'
import { Home_Result } from './components/Home/Home_Result'
import { Menu } from './components/Menu/Menu'
import { VoiceMode } from './components/VoiceMode/VoiceMode'
import { isSupabaseConfigured } from './services/supabase'
import { getPhrases, addPhrase, deletePhrase } from './services/phrases'
import { getSessions, addSession, deleteSession } from './services/sessions'
import type { Phrase } from './types'
import type { Session } from './services/sessions'
import type { AppPageState } from './stores/appStore'

function App() {
  const { currentPage, displayMode, setPage, sourceLang, targetLang, originalText } = useAppStore()
  const [phrases, setPhrases] = useState<Phrase[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const prevPageRef = useRef<AppPageState>('home')

  useEffect(() => {
    setPhrases(getPhrases())
    setSessions(getSessions())
  }, [])

  // Record session when entering result page with translation
  useEffect(() => {
    if (currentPage === 'result' && originalText && prevPageRef.current !== 'result') {
      addSession({
        type: 'voice',
        sourceLang,
        targetLang,
        lastMessage: originalText.slice(0, 50),
      })
      setSessions(getSessions())
    }
    prevPageRef.current = currentPage
  }, [currentPage, originalText, sourceLang, targetLang])

  const handleAddPhrase = (text: string, translation: string) => {
    addPhrase(text, translation)
    setPhrases(getPhrases())
  }

  const handleDeletePhrase = (id: number) => {
    deletePhrase(id)
    setPhrases(getPhrases())
  }

  const handleSessionClick = (session: Session) => {
    // TODO: navigate to result view with this session's data
    console.log('Session clicked:', session)
  }

  const handleDeleteSession = (id: string) => {
    deleteSession(id)
    setSessions(getSessions())
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center p-8 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h2 className="text-xl font-semibold text-yellow-800 mb-2">
            Configuration Required
          </h2>
          <p className="text-yellow-700 mb-4">
            Please configure your Supabase credentials in the .env file.
          </p>
          <code className="block bg-yellow-100 p-2 rounded text-sm">
            VITE_SUPABASE_URL=...<br />
            VITE_SUPABASE_ANON_KEY=...
          </code>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F2EDE8] flex flex-col" style={{ maxWidth: 390, margin: '0 auto' }}>
      {/* Page Content */}
      <div className="flex-1 flex flex-col">
        {currentPage === 'home' && displayMode === 'photo' && (
          <Home onManagePhrases={() => setPage('menu')} />
        )}
        {currentPage === 'home' && displayMode === 'voice' && (
          <VoiceMode onManagePhrases={() => setPage('menu')} />
        )}
        {currentPage === 'result' && (
          <Home_Result />
        )}
        {currentPage === 'menu' && (
          <Menu
            sessions={sessions}
            phrases={phrases}
            onSessionClick={handleSessionClick}
            onSessionDelete={handleDeleteSession}
            onAddPhrase={handleAddPhrase}
            onPhraseDelete={handleDeletePhrase}
          />
        )}
      </div>
    </div>
  )
}

export default App
