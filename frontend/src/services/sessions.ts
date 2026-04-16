// Session storage service for history management

export interface Session {
  id: string
  type: 'voice' | 'photo' | 'phrase'
  sourceLang: string
  targetLang: string
  lastMessage: string
  timestamp: number
}

const STORAGE_KEY = 'traveltalk_sessions'

function getStoredSessions(): Session[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
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

export function addSession(
  data: Omit<Session, 'id' | 'timestamp'>
): Session {
  const sessions = getStoredSessions()
  const newSession: Session = {
    ...data,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  }
  sessions.unshift(newSession) // newest first
  saveSessions(sessions)
  return newSession
}

export function deleteSession(id: string): void {
  const sessions = getStoredSessions()
  const filtered = sessions.filter((s) => s.id !== id)
  saveSessions(filtered)
}

export function clearSessions(): void {
  saveSessions([])
}
