import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import type { ChatUser, GlobalMessage, PrivateMessage, Conversation, WSMessagePayload } from '../types';

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

interface WebSocketContextType {
  isConnected: boolean;
  currentUser: ChatUser | null;
  onlineCount: number;
  onlineUsers: ChatUser[];
  globalMessages: GlobalMessage[];
  conversations: Conversation[];
  activeRecipient: ChatUser | null;
  activeChatHistory: PrivateMessage[];
  typingUsers: { [key: string]: string };
  totalUnreadCount: number;
  isSoundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  setActiveRecipient: (user: ChatUser | null) => void;
  sendGlobalMessage: (text: string) => void;
  sendPrivateMessage: (recipientId: number, text: string) => void;
  sendTypingStatus: (recipientId: number, isTyping: boolean) => void;
  markConversationAsRead: (partnerId: number) => void;
  refreshConversations: () => Promise<void>;
  refreshGlobalHistory: () => Promise<void>;
  fetchPrivateHistory: (partnerId: number) => Promise<void>;
  uploadFile: (file: File) => Promise<{ url: string; filename: string; is_image: boolean; size: number }>;
  // Pagination
  oldestLoadedMessageId: number | null;
  hasMoreOlderMessages: boolean;
  isLoadingOlderMessages: boolean;
  loadOlderMessages: (partnerId: number) => Promise<void>;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

// Mirrors the backend's sanitize_text() so the optimistic message body and the
// pending-reconciliation key exactly match what the server echoes back.
// (html.escape + strip + 4000 char cap). If these differ — whitespace, & < > "
// — the echo can't be matched and the message renders twice for the sender.
function sanitizeMessageText(text: string): string {
  if (!text) return '';
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
  return escaped.trim().slice(0, 4000);
}

function playNotificationChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  } catch (e) {
    console.debug('Chime muted:', e);
  }
}


export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [currentUser, setCurrentUser] = useState<ChatUser | null>(null);
  const [onlineCount, setOnlineCount] = useState(1);
  const [onlineUsers, setOnlineUsers] = useState<ChatUser[]>([]);
  const [globalMessages, setGlobalMessages] = useState<GlobalMessage[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeRecipient, setActiveRecipientState] = useState<ChatUser | null>(null);
  const [activeChatHistory, setActiveChatHistory] = useState<PrivateMessage[]>([]);
  // Pagination state for private messages
  const [oldestLoadedMessageId, setOldestLoadedMessageId] = useState<number | null>(null);
  const [hasMoreOlderMessages, setHasMoreOlderMessages] = useState(true);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const [typingUsers, setTypingUsers] = useState<{ [key: string]: string }>({});
  const [isSoundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('lumora_chat_sound') !== 'false';
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const backoffRef = useRef(1000);
  const typingTimeoutsRef = useRef<{ [key: string]: any }>({});
  const activeRecipientRef = useRef<ChatUser | null>(null);
  const currentUserRef = useRef<ChatUser | null>(null);
  const isSoundEnabledRef = useRef<boolean>(isSoundEnabled);
  const heartbeatRef = useRef<any>(null);
  const heartbeatWatchdogRef = useRef<any>(null);
  const lastPongRef = useRef<number>(Date.now());
  const reconnectInProgressRef = useRef(false);
  // Guard against double-click duplicate sends: maps "recipientId:text" → timestamp
  const lastSendKeyRef = useRef<Map<string, number>>(new Map());
  // Tracks optimistic messages that have been sent but not yet acknowledged by the
  // server echo.  Maps "senderId:recipientId:text" → temp message ID.  When the
  // server echo arrives we replace the optimistic entry, which is more reliable than
  // matching by text+timestamp (which breaks if client/server clocks drift).
  const pendingOptimisticsRef = useRef<Map<string, number>>(new Map());
  // Monotonic counter for unique NEGATIVE temp IDs.  A timestamp alone
  // (`-Date.now()`) collides when two messages go out in the same millisecond
  // (image + follow-up text), and two list items sharing an ID breaks both the
  // React key and the `findIndex`-by-id reconciliation.
  const tempIdSeqRef = useRef(0);

  // Keep refs in sync with the latest state so the long-lived WebSocket
  // message handler never reads stale values from a captured closure.
  currentUserRef.current = currentUser;
  isSoundEnabledRef.current = isSoundEnabled;

  activeRecipientRef.current = activeRecipient;

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (heartbeatWatchdogRef.current) {
      clearTimeout(heartbeatWatchdogRef.current);
      heartbeatWatchdogRef.current = null;
    }
  }, []);

  const setSoundEnabledSafe = (val: boolean) => {
    setSoundEnabled(val);
    localStorage.setItem('lumora_chat_sound', String(val));
  };

  const totalUnreadCount = conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0);

  const refreshGlobalHistory = useCallback(async () => {
    try {
      const res = await fetch('/chat/global/history?limit=50', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setGlobalMessages(data);
      }
    } catch (err) {
      console.error('Error fetching global history:', err);
    }
  }, []);

  // Helper to get auth headers for REST API calls
  const getAuthHeaders = (): HeadersInit => {
    const token = localStorage.getItem('token') || getCookie('access_token') || getCookie('token');
    return token
      ? {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      : { 'Content-Type': 'application/json' };
  };

  const refreshConversations = useCallback(async () => {
    try {
      const res = await fetch('/chat/conversations', {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data: Conversation[] = await res.json();
        setConversations(data);
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
    }
  }, []);

  const fetchPrivateHistory = useCallback(async (partnerId: number) => {
    try {
      const res = await fetch(`/chat/private/${partnerId}/history?limit=30`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveChatHistory(data);
        // Track the oldest message ID for pagination
        if (data.length > 0) {
          setOldestLoadedMessageId(data[0].id);
          setHasMoreOlderMessages(data.length === 30);
        } else {
          setOldestLoadedMessageId(null);
          setHasMoreOlderMessages(false);
        }
      }
    } catch (err) {
      console.error('Error fetching private history:', err);
    }
  }, []);

  // Load older messages for pagination
  const loadOlderMessages = useCallback(async (partnerId: number) => {
    if (isLoadingOlderMessages || !hasMoreOlderMessages || oldestLoadedMessageId === null) return;

    setIsLoadingOlderMessages(true);
    try {
      const res = await fetch(`/chat/private/${partnerId}/history?limit=30&before_id=${oldestLoadedMessageId}`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.length > 0) {
          // Prepend older messages, deduplicating by ID
          setActiveChatHistory((prev) => {
            const filteredOlder = data.filter((m: PrivateMessage) => !prev.some((p) => p.id === m.id));
            return [...filteredOlder, ...prev];
          });
          setOldestLoadedMessageId(data[0].id);
          setHasMoreOlderMessages(data.length === 30);
        } else {
          setHasMoreOlderMessages(false);
        }
      }
    } catch (err) {
      console.error('Error loading older messages:', err);
    } finally {
      setIsLoadingOlderMessages(false);
    }
  }, [isLoadingOlderMessages, hasMoreOlderMessages, oldestLoadedMessageId]);

  // Reset pagination state when switching conversations
  const resetPaginationState = useCallback(() => {
    setOldestLoadedMessageId(null);
    setHasMoreOlderMessages(true);
    setIsLoadingOlderMessages(false);
  }, []);

  const markConversationAsRead = useCallback(async (partnerId: number) => {
    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'read_receipt',
            data: { user_id: partnerId },
          })
        );
      }
      setConversations((prev) =>
        prev.map((c) => (c.user.id === partnerId ? { ...c, unread_count: 0 } : c))
      );
      await fetch(`/chat/private/${partnerId}/read`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
      });
    } catch (err) {
      console.error('Error marking conversation read:', err);
    }
  }, []);

  const setActiveRecipient = useCallback((user: ChatUser | null) => {
    setActiveRecipientState(user);
    // Reset pagination state when switching conversations
    resetPaginationState();
    if (user) {
      fetchPrivateHistory(user.id);
      markConversationAsRead(user.id);
    } else {
      setActiveChatHistory([]);
    }
  }, [fetchPrivateHistory, markConversationAsRead, resetPaginationState]);

  const connectWebSocket = useCallback(() => {
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    // Read token from localStorage (set by login.js) or fallback to cookies
    const token = localStorage.getItem('token') || getCookie('access_token') || getCookie('token') || '';
    const wsUrl = `${protocol}//${host}/chat/ws/chat${
      token ? `?token=${encodeURIComponent(token)}` : ''
    }`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    const startHeartbeat = () => {
      stopHeartbeat();
      lastPongRef.current = Date.now();
      // Send a ping every 25s. Well under Render Free's ~60s idle WebSocket
      // timeout so the connection never silently dies (which is what caused
      // outgoing messages to be persisted but never echoed back to the sender).
      heartbeatRef.current = setInterval(() => {
        try {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        } catch {
          // ignore transient send errors; the watchdog will reconnect
        }
      }, 25000);

      // If no pong arrives within 30s of the last one, force a reconnect.
      // This detects silent connection death that never fires onclose/onerror.
      const armWatchdog = () => {
        heartbeatWatchdogRef.current = setTimeout(() => {
          if (Date.now() - lastPongRef.current > 30000) {
            console.warn('WebSocket heartbeat missed — forcing reconnect');
            try {
              ws.close();
            } catch {
              /* noop */
            }
          }
        }, 30000);
      };
      armWatchdog();
      // Re-arm the watchdog after every pong.
      heartbeatWatchdogRef.current = heartbeatWatchdogRef.current;
      // Note: watchdog re-armed in the pong handler below via lastPongRef check.
    };

    ws.onopen = () => {
      setIsConnected(true);
      backoffRef.current = 1000;
      reconnectInProgressRef.current = false;
      startHeartbeat();
    };

    ws.onmessage = (event) => {
      try {
        const payload: WSMessagePayload = JSON.parse(event.data);
        const { type, data } = payload;

        if (type === 'pong') {
          lastPongRef.current = Date.now();
          return;
        }

        switch (type) {
          case 'auth_success': {
            if (data.user) {
              setCurrentUser(data.user);
            }
            if (typeof data.online_count === 'number') {
              setOnlineCount(data.online_count);
            }
            if (Array.isArray(data.online_users)) {
              setOnlineUsers(data.online_users);
            }
            break;
          }

          case 'guest_connected': {
            setCurrentUser(null);
            if (typeof data.online_count === 'number') {
              setOnlineCount(data.online_count);
            }
            if (Array.isArray(data.online_users)) {
              setOnlineUsers(data.online_users);
            }
            break;
          }

          case 'init_state': {
            if (data.user) {
              setCurrentUser(data.user);
            }
            if (typeof data.online_count === 'number') {
              setOnlineCount(data.online_count);
            }
            if (Array.isArray(data.online_users)) {
              setOnlineUsers(data.online_users);
            }
            break;
          }

          case 'presence_update': {
            if (typeof data.online_count === 'number') {
              setOnlineCount(data.online_count);
            }
            if (Array.isArray(data.online_users)) {
              setOnlineUsers(data.online_users);
            }
            break;
          }

          case 'global_message': {
            setGlobalMessages((prev) => {
              if (prev.some((m) => m.id === data.id)) return prev;
              return [...prev, data];
            });
            break;
          }

          case 'private_message': {
            const newMsg: PrivateMessage = data;
            const activeUser = activeRecipientRef.current;

            if (
              activeUser &&
              (activeUser.id === newMsg.sender_id || activeUser.id === newMsg.receiver_id)
            ) {
              setActiveChatHistory((prev) => {
                // Deduplicate by real ID (incoming echo)
                if (prev.some((m) => m.id === newMsg.id)) return prev;

                // Reconcile: if sender, replace the temporary optimistic message.
                // Primary lookup: use the pending-optimistics map which is keyed by
                // "senderId:recipientId:text" → tempId.  This is reliable regardless
                // of clock drift between client and server.
                const me = currentUserRef.current;
                if (me && newMsg.sender_id === me.id) {
                  const lookupKey = `${me.id}:${newMsg.receiver_id}:${newMsg.message_body}`;
                  const pendingTempId = pendingOptimisticsRef.current.get(lookupKey);

                  let tempIdx = -1;
                  if (pendingTempId !== undefined) {
                    tempIdx = prev.findIndex((m) => m.id === pendingTempId);
                  }

                  // Fallback: match any optimistic temp entry from this sender with
                  // identical body (covers races where the pending map entry was
                  // already consumed by an earlier mis-reconcile)
                  if (tempIdx < 0) {
                    tempIdx = prev.findIndex((m) =>
                      m.id < 0 &&
                      m.sender_id === me.id &&
                      m.message_body === newMsg.message_body
                    );
                  }

                  if (tempIdx >= 0) {
                    const updated = [...prev];
                    updated[tempIdx] = newMsg; // replace temp with real message
                    // Only clear the pending entry once the temp message has actually
                    // been found+replaced.  If the echo raced past React's state
                    // flush, keep the entry so a later re-render can still reconcile.
                    if (pendingTempId !== undefined && prev[tempIdx]?.id === pendingTempId) {
                      pendingOptimisticsRef.current.delete(lookupKey);
                    }
                    return updated;
                  }
                }

                return [...prev, newMsg];
              });
              if (currentUserRef.current && newMsg.sender_id === activeUser.id) {
                markConversationAsRead(activeUser.id);
              }
            }

            if (
              currentUserRef.current &&
              newMsg.sender_id !== currentUserRef.current.id &&
              isSoundEnabledRef.current
            ) {
              playNotificationChime();
            }

            setConversations((prev) => {
              const me = currentUserRef.current;
              const partnerId =
                me && newMsg.sender_id === me.id ? newMsg.receiver_id : newMsg.sender_id;

              const existingIdx = prev.findIndex((c) => c.user.id === partnerId);
              const isLookingAtChat = activeRecipientRef.current?.id === partnerId;

              if (existingIdx >= 0) {
                const updated = [...prev];
                const conv = { ...updated[existingIdx] };
                conv.last_message = newMsg.message_body;
                conv.last_message_time = newMsg.created_at;
                conv.last_sender_id = newMsg.sender_id;
                if (!isLookingAtChat && me && newMsg.sender_id !== me.id) {
                  conv.unread_count = (conv.unread_count || 0) + 1;
                }
                updated.splice(existingIdx, 1);
                return [conv, ...updated];
              } else {
                // Build the conversation entry directly from the WS message
                // so the inbox updates instantly without waiting for an async fetch.
                const isPartnerSender = newMsg.sender_id === partnerId;
                const partner: ChatUser = {
                  id: partnerId,
                  name: isPartnerSender ? (newMsg.sender_name || 'User') : (me?.name || 'You'),
                  email: '',
                  role: 'user',
                  profile_picture_url: isPartnerSender
                    ? newMsg.sender_avatar || null
                    : me?.profile_picture_url || null,
                  is_online: false,
                };
                const newConv: Conversation = {
                  user: partner,
                  last_message: newMsg.message_body,
                  last_message_time: newMsg.created_at,
                  unread_count: (!isLookingAtChat && me && newMsg.sender_id !== me.id) ? 1 : 0,
                  last_sender_id: newMsg.sender_id,
                };
                return [newConv, ...prev];
              }
            });
            break;
          }

          case 'typing': {
            const senderId = data.sender_id;
            const senderName = data.sender_name || 'Someone';
            const key = String(senderId);

            if (typingTimeoutsRef.current[key]) {
              clearTimeout(typingTimeoutsRef.current[key]);
            }

            setTypingUsers((prev) => ({ ...prev, [key]: senderName }));

            typingTimeoutsRef.current[key] = setTimeout(() => {
              setTypingUsers((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
              });
            }, 3000);
            break;
          }

          case 'stop_typing': {
            const senderId = data.sender_id;
            const key = String(senderId);
            if (typingTimeoutsRef.current[key]) {
              clearTimeout(typingTimeoutsRef.current[key]);
            }
            setTypingUsers((prev) => {
              const next = { ...prev };
              delete next[key];
              return next;
            });
            break;
          }

          case 'read_receipt': {
            const readerId = data.reader_id;
            setActiveChatHistory((prev) =>
              prev.map((m) =>
                m.receiver_id === readerId ? { ...m, is_read: true } : m
              )
            );
            break;
          }

          default:
            break;
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    ws.onclose = () => {
      stopHeartbeat();
      setIsConnected(false);
      const nextBackoff = Math.min(backoffRef.current * 1.5, 15000);
      backoffRef.current = nextBackoff;
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, nextBackoff);
    };

    ws.onerror = (err) => {
      console.warn('WebSocket connection notice:', err);
      ws.close();
    };
  }, [markConversationAsRead, refreshConversations]);


  useEffect(() => {
    refreshGlobalHistory();
    connectWebSocket();

    return () => {
      stopHeartbeat();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connectWebSocket, refreshGlobalHistory]);

  useEffect(() => {
    if (currentUser) {
      refreshConversations();
    }
  }, [currentUser, refreshConversations]);

  const sendGlobalMessage = useCallback((text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(
      JSON.stringify({
        type: 'global_message',
        message: text,
      })
    );
  }, []);

  const sendPrivateMessage = useCallback((recipientId: number, text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    // Double-click guard: suppress duplicate sends of the same text to the same
    // recipient within 800 ms.  This is the primary defence against accidental
    // double-clicks — React state batching means the input may not have cleared
    // yet when the second click fires.
    const sendKey = `${recipientId}:${text}`;
    const now = Date.now();
    const lastSent = lastSendKeyRef.current.get(sendKey) ?? 0;
    if (now - lastSent < 800) return;
    lastSendKeyRef.current.set(sendKey, now);
    // Evict stale entries after 5 s to avoid unbounded growth
    for (const [k, t] of lastSendKeyRef.current) {
      if (now - t > 5000) lastSendKeyRef.current.delete(k);
    }

    // Sanitize exactly like the backend so the optimistic body matches the echo.
    // If these differ (whitespace, & < > "), the echo can't be reconciled and the
    // sender sees the message twice.
    const cleanText = sanitizeMessageText(text);

    // Optimistically add the message to the sender's chat history immediately
    // so they see it without waiting for the backend echo.
    const me = currentUserRef.current;
    if (me && cleanText) {
      // Unique per call — even for image + text sent in the same millisecond.
      tempIdSeqRef.current += 1;
      const tempId = -tempIdSeqRef.current;
      const optimisticMsg: PrivateMessage = {
        id: tempId,
        sender_id: me.id,
        receiver_id: recipientId,
        message_body: cleanText,
        is_read: false,
        created_at: new Date().toISOString(),
        sender_name: me.name,
        sender_avatar: me.profile_picture_url,
      };

      // Register so the echo handler can reliably find and replace this entry.
      pendingOptimisticsRef.current.set(`${me.id}:${recipientId}:${cleanText}`, tempId);

      // Only add if the active chat matches this recipient
      const active = activeRecipientRef.current;
      if (active && active.id === recipientId) {
        setActiveChatHistory((prev) => {
          // Avoid duplicates WITHOUT depending on the wall clock (server/client
          // clocks can be skewed, which breaks timestamp-windowed checks):
          // 1) the echo already landed as a real DB message → don't add optimistic
          // 2) an optimistic temp with the same body is already queued → don't add
          if (
            prev.some((m) => m.sender_id === me.id && m.message_body === cleanText)
          ) {
            return prev;
          }
          return [...prev, optimisticMsg];
        });
      }

      // Always update the conversation list so the sender sees the chat move to top
      setConversations((prev) => {
        const existingIdx = prev.findIndex((c) => c.user.id === recipientId);
        if (existingIdx >= 0) {
          const updated = [...prev];
          const conv = { ...updated[existingIdx] };
          conv.last_message = cleanText;
          conv.last_message_time = optimisticMsg.created_at;
          conv.last_sender_id = me.id;
          updated.splice(existingIdx, 1);
          return [conv, ...updated];
        }
        return prev;
      });
    }

    wsRef.current.send(
      JSON.stringify({
        type: 'private_message',
        recipient_id: recipientId,
        message: text,
      })
    );
  }, []);

  const sendTypingStatus = useCallback((recipientId: number, isTyping: boolean) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(
      JSON.stringify({
        type: isTyping ? 'typing' : 'stop_typing',
        data: { recipient_id: recipientId },
      })
    );
  }, []);

  const uploadFile = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const token = localStorage.getItem('token') || getCookie('access_token') || getCookie('token');
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch('/chat/upload', {
      method: 'POST',
      body: formData,
      credentials: 'include',
      headers,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(err.detail || 'Upload failed');
    }
    return res.json();
  }, []);

  return (
    <WebSocketContext.Provider
      value={{
        isConnected,
        currentUser,
        onlineCount,
        onlineUsers,
        globalMessages,
        conversations,
        activeRecipient,
        activeChatHistory,
        typingUsers,
        totalUnreadCount,
        isSoundEnabled,
        setSoundEnabled: setSoundEnabledSafe,
        setActiveRecipient,
        sendGlobalMessage,
        sendPrivateMessage,
        sendTypingStatus,
        markConversationAsRead,
        refreshConversations,
        refreshGlobalHistory,
        fetchPrivateHistory,
        uploadFile,
        // Pagination
        oldestLoadedMessageId,
        hasMoreOlderMessages,
        isLoadingOlderMessages,
        loadOlderMessages,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

