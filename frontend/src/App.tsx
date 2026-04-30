import { useEffect } from 'react'
import { useAppStore } from './stores/appStore'
import { Home } from './components/Home/Home'
import { Settings } from './components/Settings/Settings'
import { History } from './components/History/History'
import { VoiceMode } from './components/VoiceMode/VoiceMode'
import { isSupabaseConfigured } from './services/supabase'
import { precachePhrasesFor } from './services/phrases'

function App() {
  const { currentPage, displayMode, languagePair } = useAppStore()

  // 启动时为当前外语预缓存常用语的译文 + TTS 音频
  useEffect(() => {
    void precachePhrasesFor(languagePair.B)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // 仅在挂载时运行一次

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
    <div
      className="bg-[#F2EDE8] flex flex-col"
      style={{
        width: '100dvw',
        maxWidth: '100%',
        margin: '0 auto',
        height: '100dvh',
        overflow: 'hidden',
        boxSizing: 'border-box',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      <div className="flex-1 flex flex-col min-h-0">
        {currentPage === 'home' && displayMode === 'photo' && <Home />}
        {currentPage === 'home' && displayMode === 'voice' && <VoiceMode />}
        {currentPage === 'settings' && <Settings />}
        {currentPage === 'history' && <History />}
      </div>
    </div>
  )
}

export default App
