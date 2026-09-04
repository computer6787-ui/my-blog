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
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

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
  const [typingUsers, setTypingUsers] = useState<{ [key: string]: string }>({});
  const [isSoundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('lumora_chat_sound') !== 'false';
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const backoffRef = useRef(1000);
  const typingTimeoutsRef = useRef<{ [key: string]: any }>({});
  const activeRecipientRef = useRef<ChatUser | null>(null);

  activeRecipientRef.current = activeRecipient;

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
      const res = await fetch(`/chat/private/${partnerId}/history?limit=50`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveChatHistory(data);
      }
    } catch (err) {
      console.error('Error fetching private history:', err);
    }
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
    if (user) {
      fetchPrivateHistory(user.id);
      markConversationAsRead(user.id);
    } else {
      setActiveChatHistory([]);
    }
  }, [fetchPrivateHistory, markConversationAsRead]);

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

    ws.onopen = () => {
      setIsConnected(true);
      backoffRef.current = 1000;
    };

    ws.onmessage = (event) => {
      try {
        const payload: WSMessagePayload = JSON.parse(event.data);
        const { type, data } = payload;

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
                if (prev.some((m) => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
              });
              if (currentUser && newMsg.sender_id === activeUser.id) {
                markConversationAsRead(activeUser.id);
              }
            }

            if (currentUser && newMsg.sender_id !== currentUser.id && isSoundEnabled) {
              playNotificationChime();
            }

            setConversations((prev) => {
              const partnerId =
                currentUser && newMsg.sender_id === currentUser.id
                  ? newMsg.receiver_id
                  : newMsg.sender_id;

              const existingIdx = prev.findIndex((c) => c.user.id === partnerId);
              const isLookingAtChat = activeRecipientRef.current?.id === partnerId;

              if (existingIdx >= 0) {
                const updated = [...prev];
                const conv = { ...updated[existingIdx] };
                conv.last_message = newMsg.message_body;
                conv.last_message_time = newMsg.created_at;
                conv.last_sender_id = newMsg.sender_id;
                if (!isLookingAtChat && currentUser && newMsg.sender_id !== currentUser.id) {
                  conv.unread_count = (conv.unread_count || 0) + 1;
                }
                updated.splice(existingIdx, 1);
                return [conv, ...updated];
              } else {
                refreshConversations();
                return prev;
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
      setIsConnected(false);
      const nextBackoff = Math.min(backoffRef.current * 1.5, 15000);
      backoffRef.current = nextBackoff;
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, nextBackoff);
    };

    ws.onerror = (err) => {
      console.warn('WebSocket connection notice:', err);
      ws.close();
    };
  }, [isSoundEnabled, markConversationAsRead, refreshConversations]);


  useEffect(() => {
    refreshGlobalHistory();
    connectWebSocket();

    return () => {
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

