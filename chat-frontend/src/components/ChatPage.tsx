import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Search,
  Globe,
  ArrowLeft,
  Send,
  Smile,
  Paperclip,
  Volume2,
  VolumeX,
  Hash,
} from 'lucide-react';
import { useWebSocket } from '../context/WebSocketContext';
import { UserAvatar } from './UserAvatar';
import { RoleBadge } from './RoleBadge';
import { MessageBubble } from './MessageBubble';
import type { ChatUser } from '../types';

const QUICK_EMOJIS = ['👋', '🔥', '❤️', '👏', '🎉', '💡', '🚀', '✨', '👍', '😊'];

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
  const [showGlobalEmoji, setShowGlobalEmoji] = useState(false);
  const globalMessagesEndRef = useRef<HTMLDivElement>(null);
  const globalScrollRef = useRef<HTMLDivElement>(null);

  // Direct chat input
  const [directInputVal, setDirectInputVal] = useState('');
  const [showDirectEmoji, setShowDirectEmoji] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const directMessagesEndRef = useRef<HTMLDivElement>(null);
  const directFileInputRef = useRef<HTMLInputElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // --- Global Chat Handlers ---
  const handleGlobalSend = () => {
    const trimmed = globalInputVal.trim();
    if (!trimmed) return;
    sendGlobalMessage(trimmed);
    setGlobalInputVal('');
    setShowGlobalEmoji(false);
    setTimeout(() => globalMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const handleGlobalKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGlobalSend();
    }
  };

  // --- Direct Chat Handlers ---
  const handleDirectSend = () => {
    const trimmed = directInputVal.trim();
    if (!trimmed || !activeRecipient) return;
    sendPrivateMessage(activeRecipient.id, trimmed);
    sendTypingStatus(activeRecipient.id, false);
    setDirectInputVal('');
    setShowDirectEmoji(false);
  };

  const handleDirectKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleDirectSend();
    }
  };

  const handleDirectInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDirectInputVal(e.target.value);
    if (activeRecipient) {
      sendTypingStatus(activeRecipient.id, true);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        sendTypingStatus(activeRecipient.id, false);
      }, 2000);
    }
  };

  const handleDirectFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeRecipient) return;
    try {
      setIsUploading(true);
      const res = await uploadFile(file);
      sendPrivateMessage(activeRecipient.id, res.url);
    } catch (err: any) {
      alert(err.message || 'File upload failed');
    } finally {
      setIsUploading(false);
      if (directFileInputRef.current) directFileInputRef.current.value = '';
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
    <div
      className="fixed inset-x-0 bottom-0 z-40 flex bg-[#0d0b0c] text-slate-100 overflow-hidden flex-col sm:flex-row"
      style={{ top: 'var(--navbar-height)' }}
    >
      {/* ===== Sidebar (always visible on desktop) ===== */}
      <aside className={`${
        activeRecipient || showGlobalChat ? 'hidden md:flex' : 'flex'
      } w-full md:w-80 lg:w-[340px] flex-1 min-h-0 md:flex-none flex flex-col border-r border-white/5 bg-[#161213]`}>
        {/* Sidebar Header */}
        <div className="px-4 pt-5 pb-3">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blossom-600 shadow-sm">
                <MessageSquare className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-white">Chats</h1>
                <p className="text-[11px] text-slate-400">
                  {onlineCount} online
                </p>
              </div>
            </div>
            <button
              onClick={() => setSoundEnabled(!isSoundEnabled)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              title={isSoundEnabled ? 'Mute sounds' : 'Unmute sounds'}
            >
              {isSoundEnabled ? <Volume2 className="w-4.5 h-4.5" /> : <VolumeX className="w-4.5 h-4.5" />}
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full bg-white/5 text-white pl-9 pr-3 py-2.5 rounded-xl text-sm border border-white/5 focus:outline-none focus:border-blossom-500/50 focus:ring-1 focus:ring-blossom-500/25 placeholder:text-slate-500 transition-all"
            />
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-0.5 bg-white/5 rounded-xl">
            <button
              onClick={() => setSidebarTab('conversations')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                sidebarTab === 'conversations'
                  ? 'bg-blossom-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Chats
            </button>
            <button
              onClick={() => setSidebarTab('directory')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                sidebarTab === 'directory'
                  ? 'bg-blossom-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
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
              : 'bg-white/5 border border-white/5 text-slate-300 hover:bg-white/10'
          }`}
        >
          <div className="p-1.5 rounded-lg bg-green-500/20">
            <Globe className="w-4 h-4 text-green-400" />
          </div>
          <div className="text-left flex-1">
            <p className="text-xs font-semibold">Global Live Chat</p>
            <p className="text-[10px] text-slate-500">{onlineCount} online</p>
          </div>
          <Hash className="w-3.5 h-3.5 text-slate-500" />
        </button>

        {/* Conversation / Directory List */}
        <div className="flex-1 overflow-y-auto scroller-thin">
          {sidebarTab === 'conversations' ? (
            filteredConversations.length === 0 ? (
              <div className="p-8 text-center">
                <MessageSquare className="w-10 h-10 mx-auto mb-2 text-slate-600 opacity-40" />
                <p className="text-sm font-medium text-slate-400">No conversations yet</p>
                <p className="text-xs text-slate-500 mt-1">
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
                      : 'hover:bg-white/5 border-r-2 border-transparent'
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
                        <span className="font-semibold text-sm text-white truncate">
                          {conv.user.name}
                        </span>
                        <RoleBadge role={conv.user.role} size="sm" />
                      </div>
                      <span className="text-[10px] text-slate-500 flex-shrink-0 ml-2">
                        {new Date(conv.last_message_time).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-slate-400 truncate">
                        {currentUser && conv.last_sender_id === currentUser.id ? 'You: ' : ''}
                        {conv.last_message}
                      </p>
                      {conv.unread_count > 0 && (
                        <span className="flex-shrink-0 ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blossom-600 text-white min-w-[18px] text-center">
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
              <div className="p-8 text-center text-xs text-slate-500">Loading users...</div>
            ) : directoryUsers.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">No users found</div>
            ) : (
              directoryUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleSelectConversation(user)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
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
                      <span className="font-semibold text-sm text-white truncate">{user.name}</span>
                      <RoleBadge role={user.role} size="sm" />
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">
                      {user.is_online ? 'Active now' : 'Offline'}
                    </p>
                  </div>
                  <span className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-white/5 text-blossom-400 hover:bg-blossom-600 hover:text-white transition-colors">
                    Chat
                  </span>
                </button>
              ))
            )
          )}
        </div>
      </aside>

      {/* ===== Main Chat Area ===== */}
      <main className={`${
        activeRecipient || showGlobalChat ? 'flex' : 'hidden md:flex'
      } flex-1 min-h-0 flex-col min-w-0 bg-[#0d0b0c]`}>
        {showGlobalChat ? (
          /* ---- Global Chat View ---- */
          <>
            {/* Global Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-white/5 bg-[#161213]">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setShowGlobalChat(false);
                  }}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="p-2 rounded-xl bg-green-500/20">
                  <Globe className="w-4.5 h-4.5 text-green-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Global Chat</h2>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 live-pulse-dot" />
                    <span className="text-[11px] text-slate-400">{onlineCount} online</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Global Messages */}
            <div
              ref={globalScrollRef}
              className="flex-1 overflow-y-auto min-w-0 px-4 py-4 sm:px-5 sm:py-5 scroller-thin space-y-4"
            >
              {globalMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="p-4 rounded-2xl bg-white/5 mb-4">
                    <Globe className="w-10 h-10 text-blossom-400 opacity-60" />
                  </div>
                  <p className="text-sm font-medium text-slate-300">Welcome to Global Chat!</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
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

            {/* Global Input */}
            <div className="px-4 py-3 border-t border-white/5 bg-[#161213]">
              {showGlobalEmoji && (
                <div className="mb-2 px-2 py-1.5 flex items-center gap-1 overflow-x-auto scroller-thin">
                  {QUICK_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        setGlobalInputVal((p) => p + emoji);
                        setShowGlobalEmoji(false);
                      }}
                      className="p-1.5 text-xl hover:bg-white/10 rounded-lg transition-colors"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowGlobalEmoji(!showGlobalEmoji)}
                  className="p-2.5 rounded-xl text-slate-400 hover:text-blossom-400 hover:bg-white/5 transition-colors"
                >
                  <Smile className="w-5 h-5" />
                </button>
                <input
                  type="text"
                  value={globalInputVal}
                  onChange={(e) => setGlobalInputVal(e.target.value)}
                  onKeyDown={handleGlobalKeyDown}
                  placeholder={
                    currentUser
                      ? `Message as ${currentUser.name}...`
                      : 'Join the conversation...'
                  }
                  className="flex-1 bg-white/5 text-white px-4 py-2.5 rounded-xl text-sm border border-white/5 focus:outline-none focus:border-blossom-500/50 focus:ring-1 focus:ring-blossom-500/25 placeholder:text-slate-500 transition-all"
                />
                <button
                  onClick={handleGlobalSend}
                  disabled={!globalInputVal.trim()}
                  className="p-2.5 rounded-xl bg-blossom-600 text-white hover:bg-blossom-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : activeRecipient ? (
          /* ---- Direct Chat View ---- */
          <>
            {/* Direct Chat Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-white/5 bg-[#161213]">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveRecipient(null)}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <UserAvatar
                  name={activeRecipient.name}
                  avatarUrl={activeRecipient.profile_picture_url}
                  size="sm"
                  isOnline={activeRecipient.is_online}
                  showStatus
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-sm font-bold text-white">{activeRecipient.name}</h2>
                    <RoleBadge role={activeRecipient.role} size="sm" />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {activeRecipient.is_online ? 'Active now' : 'Offline'}
                  </p>
                </div>
              </div>
            </div>

            {/* Direct Messages */}
            <div className="flex-1 overflow-y-auto min-w-0 px-4 py-4 sm:px-5 sm:py-5 scroller-thin space-y-4">
              {activeChatHistory.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <UserAvatar
                    name={activeRecipient.name}
                    avatarUrl={activeRecipient.profile_picture_url}
                    size="lg"
                    isOnline={activeRecipient.is_online}
                    showStatus
                  />
                  <h4 className="mt-3 font-semibold text-white text-sm">{activeRecipient.name}</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
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
                  <div className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/5 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blossom-500 typing-dot-1" />
                    <span className="w-1.5 h-1.5 rounded-full bg-blossom-500 typing-dot-2" />
                    <span className="w-1.5 h-1.5 rounded-full bg-blossom-500 typing-dot-3" />
                    <span className="ml-1 text-[11px] text-slate-500 font-medium">
                      {activeRecipient.name} is typing...
                    </span>
                  </div>
                </div>
              )}

              <div ref={directMessagesEndRef} />
            </div>

            {/* Direct Input */}
            <div className="px-4 py-3 border-t border-white/5 bg-[#161213]">
              {showDirectEmoji && (
                <div className="mb-2 px-2 py-1.5 flex items-center gap-1 overflow-x-auto scroller-thin">
                  {QUICK_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        setDirectInputVal((p) => p + emoji);
                        setShowDirectEmoji(false);
                      }}
                      className="p-1.5 text-xl hover:bg-white/10 rounded-lg transition-colors"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  ref={directFileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf,.txt,.zip"
                  onChange={handleDirectFileUpload}
                />
                <button
                  onClick={() => directFileInputRef.current?.click()}
                  disabled={isUploading}
                  className="p-2.5 rounded-xl text-slate-400 hover:text-blossom-400 hover:bg-white/5 disabled:opacity-30 transition-colors"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowDirectEmoji(!showDirectEmoji)}
                  className="p-2.5 rounded-xl text-slate-400 hover:text-blossom-400 hover:bg-white/5 transition-colors"
                >
                  <Smile className="w-5 h-5" />
                </button>
                <input
                  type="text"
                  value={directInputVal}
                  onChange={handleDirectInputChange}
                  onKeyDown={handleDirectKeyDown}
                  placeholder={`Message ${activeRecipient.name}...`}
                  className="flex-1 bg-white/5 text-white px-4 py-2.5 rounded-xl text-sm border border-white/5 focus:outline-none focus:border-blossom-500/50 focus:ring-1 focus:ring-blossom-500/25 placeholder:text-slate-500 transition-all"
                />
                <button
                  onClick={handleDirectSend}
                  disabled={!directInputVal.trim()}
                  className="p-2.5 rounded-xl bg-blossom-600 text-white hover:bg-blossom-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          /* ---- Empty State (No chat selected) ---- */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <div className="p-5 rounded-2xl bg-white/5 mb-4">
              <MessageSquare className="w-12 h-12 text-blossom-400 opacity-50" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Welcome to Lumora Chat</h3>
            <p className="text-sm text-slate-400 max-w-sm">
              Select a conversation from the sidebar or join the Global Live Chat to start messaging.
            </p>
            <button
              onClick={handleGoGlobal}
              className="mt-6 px-6 py-2.5 rounded-xl bg-blossom-600 text-white text-sm font-semibold hover:bg-blossom-700 transition-colors shadow-sm"
            >
              <span className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Join Global Chat
              </span>
            </button>
          </div>
        )}
      </main>
    </div>
  );
};
