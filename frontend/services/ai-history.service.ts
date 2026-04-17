import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { AiMessage } from '@/types'

const USERS_COLLECTION = 'users'
const MAX_SESSIONS = 50

export interface StoredAiSession {
  sessionId: string
  title: string
  createdAt: number
}

export const aiHistoryService = {
  // ── Session list ──────────────────────────────────────────────────────────

  async getSessions(userId: string): Promise<StoredAiSession[]> {
    const ref = doc(db, USERS_COLLECTION, userId)
    const snap = await getDoc(ref)
    if (!snap.exists()) return []
    const raw = snap.data().aiSessions
    return Array.isArray(raw) ? (raw as StoredAiSession[]) : []
  },

  async saveSession(userId: string, session: StoredAiSession): Promise<void> {
    const ref = doc(db, USERS_COLLECTION, userId)
    const snap = await getDoc(ref)
    const existing: StoredAiSession[] = snap.exists() && Array.isArray(snap.data().aiSessions)
      ? snap.data().aiSessions
      : []
    // Prepend; dedupe; cap at MAX_SESSIONS
    const updated = [session, ...existing.filter((s) => s.sessionId !== session.sessionId)].slice(
      0,
      MAX_SESSIONS
    )
    await setDoc(ref, { aiSessions: updated }, { merge: true })
  },

  async deleteSession(userId: string, sessionId: string): Promise<void> {
    const ref = doc(db, USERS_COLLECTION, userId)
    const snap = await getDoc(ref)
    if (!snap.exists()) return
    const existing: StoredAiSession[] = Array.isArray(snap.data().aiSessions)
      ? snap.data().aiSessions
      : []
    await setDoc(ref, { aiSessions: existing.filter((s) => s.sessionId !== sessionId) }, { merge: true })
    // Also clear messages
    const msgRef = doc(db, USERS_COLLECTION, userId, 'aiMessages', sessionId)
    await setDoc(msgRef, { messages: [] })
  },

  async updateSessionTitle(userId: string, sessionId: string, title: string): Promise<void> {
    const ref = doc(db, USERS_COLLECTION, userId)
    const snap = await getDoc(ref)
    if (!snap.exists()) return
    const existing: StoredAiSession[] = Array.isArray(snap.data().aiSessions)
      ? snap.data().aiSessions
      : []
    const updated = existing.map((s) => (s.sessionId === sessionId ? { ...s, title } : s))
    await setDoc(ref, { aiSessions: updated }, { merge: true })
  },

  // ── Messages ──────────────────────────────────────────────────────────────

  async getMessages(userId: string, sessionId: string): Promise<AiMessage[]> {
    const ref = doc(db, USERS_COLLECTION, userId, 'aiMessages', sessionId)
    const snap = await getDoc(ref)
    if (!snap.exists()) return []
    const raw = snap.data().messages
    return Array.isArray(raw) ? (raw as AiMessage[]) : []
  },

  async appendMessages(userId: string, sessionId: string, messages: AiMessage[]): Promise<void> {
    const ref = doc(db, USERS_COLLECTION, userId, 'aiMessages', sessionId)
    const snap = await getDoc(ref)
    const existing: AiMessage[] = snap.exists() && Array.isArray(snap.data().messages)
      ? snap.data().messages
      : []
    await setDoc(ref, { messages: [...existing, ...messages] })
  },
}
