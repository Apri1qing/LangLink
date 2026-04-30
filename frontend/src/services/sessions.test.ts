import { describe, it, expect, beforeEach } from 'vitest'
import {
  getSessions,
  getSession,
  createSession,
  appendMessage,
  deleteSession,
  clearSessions,
  recordTranslation,
  IDLE_WINDOW_MS,
  type SessionMessage,
} from './sessions'
import { useAppStore } from '../stores/appStore'

const STORAGE_KEY = 'traveltalk_sessions'

function makeMessage(overrides: Partial<SessionMessage> = {}): SessionMessage {
  return {
    id: 'm' + Math.random().toString(36).slice(2),
    type: 'voice',
    originalText: 'hi',
    translatedText: 'hola',
    sourceLang: 'zh',
    targetLang: 'ja',
    timestamp: Date.now(),
    ...overrides,
  }
}

describe('sessions service', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY)
    useAppStore.setState({
      currentSessionId: null,
      displayMode: 'photo',
      messages: [],
    })
  })

  it('returns empty array when no sessions', () => {
    expect(getSessions()).toEqual([])
  })

  it('creates session with a first message', () => {
    const s = createSession(makeMessage({ translatedText: 'こんにちは' }))
    expect(s.messages).toHaveLength(1)
    expect(s.lastMessage).toBe('こんにちは')
    expect(getSessions()).toHaveLength(1)
  })

  it('appends a message and bumps updatedAt + lastMessage', () => {
    const created = createSession(makeMessage({ translatedText: 'A', timestamp: 1 }))
    const updated = appendMessage(created.id, makeMessage({ translatedText: 'B', timestamp: 100 }))
    expect(updated?.messages).toHaveLength(2)
    expect(updated?.lastMessage).toBe('B')
    expect(updated?.updatedAt).toBe(100)
  })

  it('deletes a session', () => {
    const s = createSession(makeMessage())
    deleteSession(s.id)
    expect(getSession(s.id)).toBeNull()
  })

  it('clears all sessions', () => {
    createSession(makeMessage())
    createSession(makeMessage())
    clearSessions()
    expect(getSessions()).toHaveLength(0)
  })

  it('recordTranslation creates first session when none active', () => {
    const session = recordTranslation({
      type: 'voice',
      originalText: '你好',
      translatedText: 'こんにちは',
      sourceLang: 'zh',
      targetLang: 'ja',
    })
    expect(session.messages).toHaveLength(1)
    expect(useAppStore.getState().currentSessionId).toBe(session.id)
    expect(useAppStore.getState().messages).toHaveLength(1)
  })

  it('recordTranslation appends to current session within idle window (Home)', () => {
    useAppStore.setState({ displayMode: 'photo' })
    const first = recordTranslation({
      type: 'voice', originalText: 'a', translatedText: 'A', sourceLang: 'zh', targetLang: 'ja',
    })
    const second = recordTranslation({
      type: 'voice', originalText: 'b', translatedText: 'B', sourceLang: 'zh', targetLang: 'ja',
    })
    expect(first.id).toBe(second.id)
    expect(second.messages).toHaveLength(2)
  })

  it('recordTranslation starts new session in Home after 15min idle', () => {
    useAppStore.setState({ displayMode: 'photo' })
    const first = recordTranslation({
      type: 'voice', originalText: 'a', translatedText: 'A', sourceLang: 'zh', targetLang: 'ja',
    })
    // Backdate the first session's message
    const all = getSessions()
    const stale = all.find((s) => s.id === first.id)!
    stale.messages[0].timestamp = Date.now() - IDLE_WINDOW_MS - 1000
    stale.updatedAt = stale.messages[0].timestamp
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))

    const second = recordTranslation({
      type: 'voice', originalText: 'b', translatedText: 'B', sourceLang: 'zh', targetLang: 'ja',
    })
    expect(second.id).not.toBe(first.id)
  })

  it('recordTranslation in VoiceMode ignores idle window', () => {
    useAppStore.setState({ displayMode: 'voice' })
    const first = recordTranslation({
      type: 'voice', originalText: 'a', translatedText: 'A', sourceLang: 'zh', targetLang: 'ja',
    })
    const all = getSessions()
    const stale = all.find((s) => s.id === first.id)!
    stale.messages[0].timestamp = Date.now() - IDLE_WINDOW_MS - 1000
    stale.updatedAt = stale.messages[0].timestamp
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))

    const second = recordTranslation({
      type: 'voice', originalText: 'b', translatedText: 'B', sourceLang: 'zh', targetLang: 'ja',
    })
    expect(second.id).toBe(first.id)
    expect(second.messages).toHaveLength(2)
  })
})
