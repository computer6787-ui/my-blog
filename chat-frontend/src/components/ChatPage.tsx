import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Search,
  Globe,
  ArrowLeft,
  Send,
  ImagePlus,
  X,
  Volume2,
  VolumeX,
  Hash,
} from 'lucide-react';
import { useWebSocket } from '../context/WebSocketContext';
import { UserAvatar } from './UserAvatar';
import { RoleBadge } from './RoleBadge';
import { MessageBubble } from './MessageBubble';
import type { ChatUser } from '../types';

type SidebarTab = 'conversations' | 'directory';

export const ChatPage: React.FC = () => {
  const {
    currentUser,
    conversations,
    onlineCount,
    globalMessages,
    activeRecipient,
    activeChatHistory,
    typingUsers,
    isSoundEnabled,
    setSoundEnabled,
    setActiveRecipient,
    sendGlobalMessage,
    sendPrivateMessage,
    sendTypingStatus,
    uploadFile,
    refreshGlobalHistory,
  } = useWebSocket();

  // Sidebar state
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('conversations');
  const [searchQuery, setSearchQuery] = useState('');
  const [directoryUsers, setDirectoryUsers] = useState<ChatUser[]>([]);
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(false);
  const [showGlobalChat, setShowGlobalChat] = useState(false);

  // Global chat input
  const [globalInputVal, setGlobalInputVal] = useState('');
  const globalMessagesEndRef = useRef<HTMLDivElement>(null);
  const globalScrollRef = useRef<HTMLDivElement>(null);

  // Direct chat input
  const [directInputVal, setDirectInputVal] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const directMessagesEndRef = useRef<HTMLDivElement>(null);
  const globalInputRef = useRef<HTMLTextAreaElement>(null);
  const directInputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards send-with-preview against re-entry while an upload is in flight
  const isUploadSenderRef = useRef(false);

  // Photo preview (shared — only one chat view is active at a time)
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Fetch directory users
  useEffect(() => {
    if (currentUser && (sidebarTab === 'directory' || searchQuery.trim())) {
      setIsLoadingDirectory(true);
      const timer = setTimeout(() => {
        const url = searchQuery.trim()
          ? `/chat/users?q=${encodeURIComponent(searchQuery.trim())}`
          : '/chat/users?limit=30';
        fetch(url, { credentials: 'include' })
          .then((r) => (r.ok ? r.json() : []))
          .then((data: ChatUser[]) => {
            setDirectoryUsers(data.filter((u) => u.id !== currentUser.id));
          })
          .catch(console.error)
          .finally(() => setIsLoadingDirectory(false));
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, currentUser, sidebarTab]);

  // Auto-open global chat when arriving with ?global=true
  useEffect(() => {
    if (!currentUser) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('global') === 'true') {
      handleGoGlobal();
      window.history.replaceState(window.history.state, '', '/chat');
    }
  }, [currentUser]);

  // Auto-open a direct conversation when arriving from a "Message" button on
  // another page (e.g. the public profile's btn-dm-profile), which routes here
  // as /chat?user=<id>. Resolves the recipient from an existing conversation,
  // then falls back to the public profile endpoint.
  const dmUserTarget = useRef<number | null>(null);
  useEffect(() => {
    if (!currentUser) return;
    if (dmUserTarget.current == null) {
      const raw = new URLSearchParams(window.location.search).get('user');
      const id = raw ? Number(raw) : NaN;
      dmUserTarget.current =
        Number.isFinite(id) && id > 0 && id !== currentUser.id ? id : null;
    }
    const targetId = dmUserTarget.current;
    if (targetId == null) return;

    const select = (u: ChatUser) => {
      dmUserTarget.current = null;
      window.history.replaceState(window.history.state, '', '/chat');
      setActiveRecipient(u);
    };

    const existing = conversations.find((c) => c.user.id === targetId);
    if (existing) {
      select(existing.user);
      return;
    }
    if (activeRecipient?.id === targetId) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/user/${targetId}`, { credentials: 'include' });
        if (!res.ok || cancelled) return;
        const u = await res.json();
        if (cancelled || !u || !u.id) return;
        select({
          id: u.id,
          name: u.name || 'User',
          email: u.email || '',
          role: u.role || 'user',
          profile_picture_url: u.profile_picture_url || null,
          is_online: false,
        });
      } catch {
        dmUserTarget.current = null; // give up rather than re-try in a loop
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser, conversations, activeRecipient, setActiveRecipient]);

  // Auto-scroll global chat
  useEffect(() => {
    if (showGlobalChat) {
      globalMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [globalMessages, showGlobalChat]);

  // Auto-scroll direct chat
  useEffect(() => {
    directMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChatHistory]);

  // Auto-resize textarea: grows up to 3 lines then scrolls
  const autoResize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    const lineHeight = 24; // approx line-height for text-sm
    const maxH = lineHeight * 3;
    el.style.height = Math.min(el.scrollHeight, maxH) + 'px';
    el.style.overflowY = el.scrollHeight > maxH ? 'auto' : 'hidden';
  };

  const handleGlobalInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setGlobalInputVal(e.target.value);
    autoResize(e.target);
  };

  const resetGlobalInput = () => {
    setGlobalInputVal('');
    if (globalInputRef.current) {
      globalInputRef.current.style.height = 'auto';
      globalInputRef.current.style.overflowY = 'hidden';
    }
  };

  // --- Photo preview helpers ---
  const clearPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Only allow images for preview
    if (!file.type.startsWith('image/')) {
      alert('Only image files can be previewed.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    clearPreview();
    const url = URL.createObjectURL(file);
    setPreviewFile(file);
    setPreviewUrl(url);
  };

  const handleSendWithPreview = async (text: string) => {
    if (!previewFile || isUploadSenderRef.current) return;
    isUploadSenderRef.current = true;
    try {
      setIsUploading(true);
      const res = await uploadFile(previewFile);
      if (activeRecipient) {
        sendPrivateMessage(activeRecipient.id, res.url);
        // Also send the text as a follow-up message if present
        if (text) {
          sendPrivateMessage(activeRecipient.id, text);
        }
      } else if (showGlobalChat) {
        sendGlobalMessage(res.url);
        if (text) {
          sendGlobalMessage(text);
        }
      }
      clearPreview();
    } catch (err: any) {
      alert(err.message || 'Image upload failed');
    } finally {
      setIsUploading(false);
      isUploadSenderRef.current = false;
    }
  };

  // --- Global Chat Handlers ---
  const handleGlobalSend = async () => {
    const trimmed = globalInputVal.trim();
    if (previewFile) {
      await handleSendWithPreview(trimmed);
    } else {
      if (!trimmed) return;
      // Clear input FIRST so the send button disables immediately
      resetGlobalInput();
      sendGlobalMessage(trimmed);
      setTimeout(() => globalMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      return;
    }
    resetGlobalInput();
    setTimeout(() => globalMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const handleGlobalKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGlobalSend();
    }
  };

  // --- Direct Chat Handlers ---
  const handleDirectSend = async () => {
    const trimmed = directInputVal.trim();
    if (previewFile) {
      await handleSendWithPreview(trimmed);
    } else {
      if (!trimmed || !activeRecipient) return;
      // Clear input FIRST so the send button disables immediately and
      // prevents double-click from sending the same text twice.
      resetDirectInput();
      sendPrivateMessage(activeRecipient.id, trimmed);
      sendTypingStatus(activeRecipient.id, false);
      return; // already called resetDirectInput above
    }
    resetDirectInput();
  };

  const resetDirectInput = () => {
    setDirectInputVal('');
    if (directInputRef.current) {
      directInputRef.current.style.height = 'auto';
      directInputRef.current.style.overflowY = 'hidden';
    }
  };

  const handleDirectKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleDirectSend();
    }
  };

  const handleDirectInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDirectInputVal(e.target.value);
    if (activeRecipient) {
      sendTypingStatus(activeRecipient.id, true);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        sendTypingStatus(activeRecipient.id, false);
      }, 2000);
    }
  };

  const handleSelectConversation = (user: ChatUser) => {
    setActiveRecipient(user);
    setShowGlobalChat(false);
  };

  const handleGoGlobal = () => {
    setShowGlobalChat(true);
    setActiveRecipient(null);
    refreshGlobalHistory();
  };

  const isPartnerTyping = activeRecipient ? Boolean(typingUsers[String(activeRecipient.id)]) : false;

  const filteredConversations = conversations.filter((c) =>
    c.user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // --- Render ---
  return (
    <div className="fixed inset-x-0 bottom-0 top-[var(--navbar-height)] z-40 flex bg-page text-primary overflow-hidden flex-col sm:flex-row"
         style={{ marginTop: 0 }}>
      {/* ===== Sidebar (always visible on desktop) ===== */}
      <aside className={`${
        activeRecipient || showGlobalChat ? 'hidden show-on-desktop' : 'flex'
      } w-full md:w-[20rem] lg:w-[340px] flex-1 min-h-0 md:flex-none flex flex-col border-r border-subtle bg-card`}>
        {/* Sidebar Header */}
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blossom-600 shadow-sm">
                <MessageSquare className="w-4.5 h-4.5 text-inverse" />
              </div>
              <div>
                <h1 className="text-base font-bold text-primary">Chats</h1>
                <p className="text-[11px] text-muted">
                  {onlineCount} online
                </p>
              </div>
            </div>
            <button
              onClick={() => setSoundEnabled(!isSoundEnabled)}
              className="p-2 rounded-lg text-muted hover:text-primary hover:bg-elevated transition-colors"
              title={isSoundEnabled ? 'Mute sounds' : 'Unmute sounds'}
            >
              {isSoundEnabled ? <Volume2 className="w-4.5 h-4.5" /> : <VolumeX className="w-4.5 h-4.5" />}
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full bg-elevated text-primary pl-9 pr-3 py-2.5 rounded-xl text-sm border border-subtle focus:outline-none focus:border-blossom-500/50 focus:ring-1 focus:ring-blossom-500/25 placeholder:text-muted transition-all"
            />
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-0.5 bg-elevated rounded-xl">
            <button
              onClick={() => setSidebarTab('conversations')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                sidebarTab === 'conversations'
                  ? 'bg-blossom-600 text-inverse shadow-sm'
                  : 'text-muted hover:text-primary'
              }`}
            >
              Chats
            </button>
            <button
              onClick={() => setSidebarTab('directory')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                sidebarTab === 'directory'
                  ? 'bg-blossom-600 text-inverse shadow-sm'
                  : 'text-muted hover:text-primary'
              }`}
            >
              Directory
            </button>
          </div>
        </div>

        {/* Global Chat Button */}
        <button
          onClick={handleGoGlobal}
          className={`mx-3 mb-2 flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all ${
            showGlobalChat
              ? 'bg-blossom-600/20 border border-blossom-500/30 text-blossom-400'
              : 'bg-elevated border border-subtle text-secondary hover:bg-hover'
          }`}
        >
          <div className="p-1.5 rounded-lg bg-green-500/20">
            <Globe className="w-4 h-4 text-green-400" />
          </div>
          <div className="text-left flex-1">
            <p className="text-xs font-semibold">Global Live Chat</p>
            <p className="text-[10px] text-muted">{onlineCount} online</p>
          </div>
          <Hash className="w-3.5 h-3.5 text-muted" />
        </button>

        {/* Conversation / Directory List */}
        <div className="flex-1 overflow-y-auto scroller-thin">
          {sidebarTab === 'conversations' ? (
            filteredConversations.length === 0 ? (
              <div className="p-8 text-center">
                <MessageSquare className="w-10 h-10 mx-auto mb-2 text-secondary opacity-40" />
                <p className="text-sm font-medium text-muted">No conversations yet</p>
                <p className="text-xs text-muted mt-1">
                  Start chatting from the Directory tab
                </p>
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <button
                  key={conv.user.id}
                  onClick={() => handleSelectConversation(conv.user)}
                  className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${
                    activeRecipient?.id === conv.user.id && !showGlobalChat
                      ? 'bg-blossom-600/10 border-r-2 border-blossom-500'
                      : 'hover:bg-elevated border-r-2 border-transparent'
                  }`}
                >
                  <UserAvatar
                    name={conv.user.name}
                    avatarUrl={conv.user.profile_picture_url}
                    size="md"
                    isOnline={conv.user.is_online}
                    showStatus
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-semibold text-sm text-primary truncate">
                          {conv.user.name}
                        </span>
                        <RoleBadge role={conv.user.role} size="sm" />
                      </div>
                      <span className="text-[10px] text-muted flex-shrink-0 ml-2">
                        {new Date(conv.last_message_time).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-muted truncate">
                        {currentUser && conv.last_sender_id === currentUser.id ? 'You: ' : ''}
                        {conv.last_message}
                      </p>
                      {conv.unread_count > 0 && (
                        <span className="flex-shrink-0 ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blossom-600 text-primary min-w-[18px] text-center">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )
          ) : (
            /* Directory Tab */
            isLoadingDirectory ? (
              <div className="p-8 text-center text-xs text-muted">Loading users...</div>
            ) : directoryUsers.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted">No users found</div>
            ) : (
              directoryUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleSelectConversation(user)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-elevated transition-colors text-left"
                >
                  <UserAvatar
                    name={user.name}
                    avatarUrl={user.profile_picture_url}
                    size="md"
                    isOnline={user.is_online}
                    showStatus
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-sm text-primary truncate">{user.name}</span>
                      <RoleBadge role={user.role} size="sm" />
                    </div>
                    <p className="text-[11px] text-muted truncate">
                      {user.is_online ? 'Active now' : 'Offline'}
                    </p>
                  </div>
                  <span className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-elevated text-blossom-400 hover:bg-blossom-600 hover:text-inverse transition-colors">
                    Chat
                  </span>
                </button>
              ))
            )
          )}
        </div>
      </aside>

      {/* ===== Main Chat Area ===== */}
      <div className={`${
        activeRecipient || showGlobalChat ? 'flex' : 'hidden show-on-desktop'
      } flex-1 min-h-0 flex-col min-w-0 bg-page`}>
        {showGlobalChat ? (
          /* ---- Global Chat View ---- */
          <>
            {/* Global Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-subtle bg-card">
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => {
                    setShowGlobalChat(false);
                  }}
                  className="p-2 rounded-lg text-muted hover:text-primary hover:bg-elevated transition-colors"
                >
                  <ArrowLeft className="w-4.5 h-4.5" />
                </button>
                <div className="p-1.5 rounded-xl bg-green-500/20">
                  <Globe className="w-4 h-4 text-green-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-primary">Global Chat</h2>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 live-pulse-dot" />
                    <span className="text-[10px] text-muted">{onlineCount} online</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Global Messages */}
            <div
              ref={globalScrollRef}
              className="flex-1 overflow-y-auto min-w-0 py-4 sm:py-5 scroller-thin"
            >
              <div className="px-6 sm:px-10 space-y-4">
              {globalMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="p-4 rounded-2xl bg-elevated mb-4">
                    <Globe className="w-10 h-10 text-blossom-400 opacity-60" />
                  </div>
                  <p className="text-sm font-medium text-secondary">Welcome to Global Chat!</p>
                  <p className="text-xs text-muted mt-1 max-w-xs">
                    Start a conversation with the community. Messages are real-time.
                  </p>
                </div>
              ) : (
                globalMessages.map((msg) => {
                  const isSelf = currentUser ? msg.user_id === currentUser.id : false;
                  return (
                    <MessageBubble
                      key={msg.id}
                      id={msg.id}
                      authorName={msg.author_name}
                      authorRole={msg.author_role}
                      authorAvatar={msg.author_avatar}
                      messageBody={msg.message_body}
                      createdAt={msg.created_at}
                      isSelf={isSelf}
                    />
                  );
                })
              )}
              <div ref={globalMessagesEndRef} />
              </div>
            </div>

            {/* Global Input */}
            <div className="px-4 py-3 border-t border-subtle bg-card">
              {previewUrl && (
                <div className="mb-2 relative inline-block">
                  <img src={previewUrl} alt="Preview" className="h-16 rounded-lg object-cover border border-subtle" />
                  <button onClick={clearPreview} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileSelect}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center text-muted hover:text-blossom-400 hover:bg-elevated disabled:opacity-30 transition-all flex-shrink-0"
                >
                  <ImagePlus className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
                </button>
                <textarea
                  ref={globalInputRef}
                  rows={1}
                  value={globalInputVal}
                  onChange={handleGlobalInputChange}
                  onKeyDown={handleGlobalKeyDown}
                  placeholder={
                    currentUser
                      ? `Message as ${currentUser.name}...`
                      : 'Join the conversation...'
                  }
                  className="flex-1 bg-elevated text-primary px-5 py-2.5 rounded-xl text-sm border border-subtle focus:outline-none focus:border-blossom-500/50 focus:ring-1 focus:ring-blossom-500/25 placeholder:text-muted transition-all resize-none overflow-hidden leading-6"
                  style={{ minHeight: '42px', maxHeight: '72px' }}
                />
                <button
                  onClick={handleGlobalSend}
                  disabled={isUploading || (!globalInputVal.trim() && !previewFile)}
                  className="flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed shadow-md hover:shadow-lg hover:scale-105 active:scale-95"
                  style={{
                    background: (globalInputVal.trim() || previewFile)
                      ? 'linear-gradient(135deg, #C77B91 0%, #a2526b 100%)'
                      : undefined,
                    backgroundColor: (globalInputVal.trim() || previewFile) ? undefined : 'var(--bg-elevated)',
                  }}
                >
                  <Send className="w-4.5 h-4.5 sm:w-5 sm:h-5" style={{ color: (globalInputVal.trim() || previewFile) ? '#F2F1ED' : 'var(--text-muted)' }} />
                </button>
              </div>
            </div>
          </>
        ) : activeRecipient ? (
          /* ---- Direct Chat View ---- */
          <>
            {/* Direct Chat Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-subtle bg-card">
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setActiveRecipient(null)}
                  className="p-2 rounded-lg text-muted hover:text-primary hover:bg-elevated transition-colors"
                >
                  <ArrowLeft className="w-4.5 h-4.5" />
                </button>
                <a
                  href={`/profile/${activeRecipient.id}`}
                  className="flex items-center gap-3 group"
                  title={`View ${activeRecipient.name}'s public profile`}
                >
                  <UserAvatar
                    name={activeRecipient.name}
                    avatarUrl={activeRecipient.profile_picture_url}
                    size="sm"
                    isOnline={activeRecipient.is_online}
                    showStatus
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h2 className="text-sm font-bold text-primary group-hover:text-blossom-400 transition-colors">{activeRecipient.name}</h2>
                      <RoleBadge role={activeRecipient.role} size="sm" />
                    </div>
                    <p className="text-[11px] text-muted">
                      {activeRecipient.is_online ? 'Active now' : 'Offline'}
                    </p>
                  </div>
                </a>
              </div>
            </div>

            {/* Direct Messages */}
            <div className="flex-1 overflow-y-auto min-w-0 py-4 sm:py-5 scroller-thin">
              <div className="px-6 sm:px-10 space-y-4">
              {activeChatHistory.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <UserAvatar
                    name={activeRecipient.name}
                    avatarUrl={activeRecipient.profile_picture_url}
                    size="lg"
                    isOnline={activeRecipient.is_online}
                    showStatus
                  />
                  <h4 className="mt-3 font-semibold text-primary text-sm">{activeRecipient.name}</h4>
                  <p className="text-xs text-muted mt-1 max-w-xs">
                    Start your direct conversation. Messages are real-time and private.
                  </p>
                </div>
              ) : (
                activeChatHistory.map((msg) => {
                  const isSelf = currentUser ? msg.sender_id === currentUser.id : false;
                  return (
                    <MessageBubble
                      key={msg.id}
                      id={msg.id}
                      authorName={isSelf ? currentUser?.name : activeRecipient.name}
                      authorAvatar={isSelf ? currentUser?.profile_picture_url : activeRecipient.profile_picture_url}
                      messageBody={msg.message_body}
                      createdAt={msg.created_at}
                      isSelf={isSelf}
                      isRead={msg.is_read}
                      showAvatar={false}
                      showRole={false}
                    />
                  );
                })
              )}

              {isPartnerTyping && (
                <div className="flex items-center gap-2 mb-2">
                  <div className="px-3.5 py-2 rounded-xl bg-elevated border border-subtle flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blossom-500 typing-dot-1" />
                    <span className="w-1.5 h-1.5 rounded-full bg-blossom-500 typing-dot-2" />
                    <span className="w-1.5 h-1.5 rounded-full bg-blossom-500 typing-dot-3" />
                    <span className="ml-1 text-[11px] text-muted font-medium">
                      {activeRecipient.name} is typing...
                    </span>
                  </div>
                </div>
              )}

              <div ref={directMessagesEndRef} />
              </div>
            </div>

            {/* Direct Input */}
            <div className="px-4 py-3 border-t border-subtle bg-card">
              {previewUrl && (
                <div className="mb-2 relative inline-block">
                  <img src={previewUrl} alt="Preview" className="h-16 rounded-lg object-cover border border-subtle" />
                  <button onClick={clearPreview} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileSelect}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center text-muted hover:text-blossom-400 hover:bg-elevated disabled:opacity-30 transition-all flex-shrink-0"
                >
                  <ImagePlus className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
                </button>
                <textarea
                  ref={directInputRef}
                  rows={1}
                  value={directInputVal}
                  onChange={(e) => { handleDirectInputChange(e); autoResize(e.target); }}
                  onKeyDown={handleDirectKeyDown}
                  placeholder={`Message ${activeRecipient.name}...`}
                  className="flex-1 bg-elevated text-primary px-5 py-2.5 rounded-xl text-sm border border-subtle focus:outline-none focus:border-blossom-500/50 focus:ring-1 focus:ring-blossom-500/25 placeholder:text-muted transition-all resize-none overflow-hidden leading-6"
                  style={{ minHeight: '42px', maxHeight: '72px' }}
                />
                <button
                  onClick={handleDirectSend}
                  disabled={isUploading || (!directInputVal.trim() && !previewFile)}
                  className="flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed shadow-md hover:shadow-lg hover:scale-105 active:scale-95"
                  style={{
                    background: (directInputVal.trim() || previewFile)
                      ? 'linear-gradient(135deg, #C77B91 0%, #a2526b 100%)'
                      : undefined,
                    backgroundColor: (directInputVal.trim() || previewFile) ? undefined : 'var(--bg-elevated)',
                  }}
                >
                  <Send className="w-4.5 h-4.5 sm:w-5 sm:h-5" style={{ color: (directInputVal.trim() || previewFile) ? '#F2F1ED' : 'var(--text-muted)' }} />
                </button>
              </div>
            </div>
          </>
        ) : (
          /* ---- Empty State (No chat selected) ---- */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <div className="p-5 rounded-2xl bg-elevated mb-4">
              <MessageSquare className="w-12 h-12 text-blossom-400 opacity-50" />
            </div>
            <h3 className="text-lg font-bold text-primary mb-1">Welcome to Lumora Chat</h3>
            <p className="text-sm text-muted max-w-sm">
              Select a conversation from the sidebar or join the Global Live Chat to start messaging.
            </p>
            <button
              onClick={handleGoGlobal}
              className="mt-6 px-6 py-2.5 rounded-xl bg-blossom-600 text-primary text-sm font-semibold hover:bg-blossom-700 transition-colors shadow-sm"
            >
              <span className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Join Global Chat
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
