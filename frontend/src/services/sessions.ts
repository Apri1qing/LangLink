// Session storage service for history management
import { generateUUID } from '../utils/uuid'
import { useAppStore, type ConversationMessage } from '../stores/appStore'
import type { LanguageCode } from '../types'

export type SessionMessageType = 'voice' | 'photo' | 'phrase'

export interface SessionMessage {
  id: string
  type: SessionMessageType
  originalText: string
  translatedText: string
  sourceLang: LanguageCode
  targetLang: LanguageCode
  audioUrl?: string | null
  imageDataUrl?: string
  timestamp: number
}

export interface Session {
  id: string
  messages: SessionMessage[]
  createdAt: number
  updatedAt: number
  lastMessage: string
}

const STORAGE_KEY = 'traveltalk_sessions'

interface LegacySession {
  id: string
  type?: string
  sourceLang?: string
  targetLang?: string
  lastMessage?: string
  timestamp?: number
}

function isLegacy(s: unknown): s is LegacySession {
  return (
    !!s &&
    typeof s === 'object' &&
    !('messages' in (s as Record<string, unknown>)) &&
    'timestamp' in (s as Record<string, unknown>)
  )
}

function migrateLegacySession(s: LegacySession): Session {
  const ts = s.timestamp ?? Date.now()
  return {
    id: s.id,
    messages: [],
    lastMessage: s.lastMessage ?? '',
    createdAt: ts,
    updatedAt: ts,
  }
}

function getStoredSessions(): Session[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as unknown[]
      const needsMigration = parsed.some(isLegacy)
      if (!needsMigration) return parsed as Session[]
      const migrated = parsed.map((s) => (isLegacy(s) ? migrateLegacySession(s) : (s as Session)))
      saveSessions(migrated)
      return migrated
    }
  } catch {
    console.error('Failed to load sessions from storage')
  }
  return []
}

function saveSessions(sessions: Session[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
  } catch {
    console.error('Failed to save sessions to storage')
  }
}

export function getSessions(): Session[] {
  return getStoredSessions()
}

export function getSession(id: string): Session | null {
  return getStoredSessions().find((s) => s.id === id) ?? null
}

export function createSession(firstMessage: SessionMessage): Session {
  const sessions = getStoredSessions()
  const session: Session = {
    id: generateUUID(),
    messages: [firstMessage],
    createdAt: firstMessage.timestamp,
    updatedAt: firstMessage.timestamp,
    lastMessage: firstMessage.translatedText.slice(0, 50),
  }
  sessions.unshift(session)
  saveSessions(sessions)
  return session
}

export function appendMessage(sessionId: string, message: SessionMessage): Session | null {
  const sessions = getStoredSessions()
  const idx = sessions.findIndex((s) => s.id === sessionId)
  if (idx < 0) return null
  const updated: Session = {
    ...sessions[idx],
    messages: [...sessions[idx].messages, message],
    updatedAt: message.timestamp,
    lastMessage: message.translatedText.slice(0, 50),
  }
  // Move to top of list on update
  sessions.splice(idx, 1)
  sessions.unshift(updated)
  saveSessions(sessions)
  return updated
}

export function deleteSession(id: string): void {
  const sessions = getStoredSessions()
  const filtered = sessions.filter((s) => s.id !== id)
  saveSessions(filtered)
}

export function clearSessions(): void {
  saveSessions([])
}

/**
 * 15 minutes of idle in Home mode triggers a new session.
 * In VoiceMode, sessions only break on explicit "new conversation" button.
 */
export const IDLE_WINDOW_MS = 15 * 60 * 1000

interface RecordTranslationInput {
  type: SessionMessageType
  originalText: string
  translatedText: string
  sourceLang: LanguageCode
  targetLang: LanguageCode
  audioUrl?: string | null
  imageDataUrl?: string
}

/**
 * Append a translation as a message to the current session, creating a new
 * session when appropriate (no active session, or Home-mode 15min idle).
 * Writes to both sessions storage and appStore.messages (render source).
 */
export function recordTranslation(input: RecordTranslationInput): Session {
  const store = useAppStore.getState()
  const now = Date.now()
  const message: SessionMessage = {
    ...input,
    id: generateUUID(),
    timestamp: now,
  }

  const current = store.currentSessionId ? getSession(store.currentSessionId) : null
  const lastTs = current?.messages.at(-1)?.timestamp ?? current?.updatedAt ?? 0
  const shouldCreateNew =
    !current ||
    (store.displayMode === 'photo' && now - lastTs > IDLE_WINDOW_MS)

  let session: Session
  if (shouldCreateNew) {
    session = createSession(message)
    store.setCurrentSessionId(session.id)
    store.setMessages(toConversationMessages(session.messages))
  } else {
    const updated = appendMessage(current!.id, message)
    if (!updated) {
      session = createSession(message)
      store.setCurrentSessionId(session.id)
      store.setMessages(toConversationMessages(session.messages))
    } else {
      session = updated
      store.addMessage(toConversationMessage(message))
    }
  }
  return session
}

/** Load a historical session as the active session in the store. */
export function enterSession(id: string): Session | null {
  const session = getSession(id)
  if (!session) return null
  const store = useAppStore.getState()
  store.setCurrentSessionId(session.id)
  store.setMessages(toConversationMessages(session.messages))
  return session
}

/** Archive current session (it is already persisted) and start fresh on next translation. */
export function newSession(): void {
  const store = useAppStore.getState()
  store.setCurrentSessionId(null)
  store.clearMessages()
}

function toConversationMessage(m: SessionMessage): ConversationMessage {
  return {
    id: m.id,
    type: m.type,
    originalText: m.originalText,
    translatedText: m.translatedText,
    sourceLang: m.sourceLang,
    targetLang: m.targetLang,
    audioUrl: m.audioUrl,
    imageDataUrl: m.imageDataUrl,
    timestamp: m.timestamp,
  }
}

function toConversationMessages(msgs: SessionMessage[]): ConversationMessage[] {
  return msgs.map(toConversationMessage)
}
