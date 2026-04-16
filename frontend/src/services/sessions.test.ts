import { describe, it, expect, beforeEach } from 'vitest'
import { getSessions, addSession, deleteSession, clearSessions } from './sessions'

const STORAGE_KEY = 'traveltalk_sessions'

describe('sessions service', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY)
  })

  it('should return empty array when no sessions', () => {
    expect(getSessions()).toEqual([])
  })

  it('should add a session', () => {
    addSession({
      type: 'voice',
      sourceLang: 'zh',
      targetLang: 'ja',
      lastMessage: '你好',
    })
    const sessions = getSessions()
    expect(sessions).toHaveLength(1)
    expect(sessions[0].lastMessage).toBe('你好')
    expect(sessions[0].type).toBe('voice')
  })

  it('should generate id and timestamp for new session', () => {
    const session = addSession({
      type: 'photo',
      sourceLang: 'ja',
      targetLang: 'zh',
      lastMessage: 'メニュー',
    })
    expect(session.id).toBeTruthy()
    expect(session.timestamp).toBeTruthy()
  })

  it('should delete a session by id', () => {
    const session = addSession({
      type: 'phrase',
      sourceLang: 'zh',
      targetLang: 'ja',
      lastMessage: '谢谢',
    })
    deleteSession(session.id)
    expect(getSessions()).toHaveLength(0)
  })

  it('should clear all sessions', () => {
    addSession({ type: 'voice', sourceLang: 'zh', targetLang: 'ja', lastMessage: '1' })
    addSession({ type: 'voice', sourceLang: 'zh', targetLang: 'ja', lastMessage: '2' })
    clearSessions()
    expect(getSessions()).toHaveLength(0)
  })

  it('should persist sessions in localStorage', () => {
    addSession({ type: 'voice', sourceLang: 'zh', targetLang: 'ja', lastMessage: 'persisted' })
    // Simulate page reload
    const sessions = getSessions()
    expect(sessions).toHaveLength(1)
    expect(sessions[0].lastMessage).toBe('persisted')
  })
})
