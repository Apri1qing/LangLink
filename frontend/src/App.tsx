import { useState } from 'react'
import { isSupabaseConfigured } from './services/supabase'
import VoiceTranslate from './components/VoiceTranslate/VoiceTranslate'
import ImageTranslate from './components/ImageTranslate/ImageTranslate'
import Phrases from './components/Phrases/Phrases'

type Tab = 'voice' | 'image' | 'phrases'

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('voice')

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
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="py-6 border-b border-[var(--color-border)]">
        <h1 className="text-2xl font-bold text-[var(--color-text-heading)]">
          TravelTalk
        </h1>
        <p className="text-sm text-[var(--color-text)] mt-1">
          语音 + 图片 + 常用语，跨语言沟通无障碍
        </p>
      </header>

      {/* Tab Navigation */}
      <nav className="flex gap-2 py-4 border-b border-[var(--color-border)]">
        <button
          onClick={() => setActiveTab('voice')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'voice'
              ? 'bg-[var(--color-primary)] text-white'
              : 'bg-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-primary-bg)]'
          }`}
        >
          🎤 语音翻译
        </button>
        <button
          onClick={() => setActiveTab('image')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'image'
              ? 'bg-[var(--color-primary)] text-white'
              : 'bg-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-primary-bg)]'
          }`}
        >
          🖼️ 图片翻译
        </button>
        <button
          onClick={() => setActiveTab('phrases')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'phrases'
              ? 'bg-[var(--color-primary)] text-white'
              : 'bg-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-primary-bg)]'
          }`}
        >
          🧠 常用语
        </button>
      </nav>

      {/* Main Content */}
      <main className="flex-1 py-6">
        {activeTab === 'voice' && <VoiceTranslate />}
        {activeTab === 'image' && <ImageTranslate />}
        {activeTab === 'phrases' && <Phrases />}
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-sm text-[var(--color-text)] border-t border-[var(--color-border)]">
        TravelTalk © 2024
      </footer>
    </div>
  )
}

export default App
