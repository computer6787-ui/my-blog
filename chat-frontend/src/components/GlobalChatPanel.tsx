import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  X,
  Send,
  Smile,
  Paperclip,
  Volume2,
  VolumeX,
  ChevronDown,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { useWebSocket } from '../context/WebSocketContext';
import { MessageBubble } from './MessageBubble';
import type { ChatUser } from '../types';

const QUICK_EMOJIS = ['👋', '🔥', '❤️', '👏', '🎉', '💡', '🚀', '✨', '👍', '😊'];

interface GlobalChatPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  onOpenDirectChatWith?: (user: ChatUser) => void;
}

export const GlobalChatPanel: React.FC<GlobalChatPanelProps> = ({
  isOpen,
  onToggle,
  onOpenDirectChatWith,
}) => {
  const {
    globalMessages,
    sendGlobalMessage,
    onlineCount,
    currentUser,
    isSoundEnabled,
    setSoundEnabled,
    uploadFile,
  } = useWebSocket();

  const [inputVal, setInputVal] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasScrolledUp, setHasScrolledUp] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
    setHasScrolledUp(false);
  };

  useEffect(() => {
    if (isOpen && !hasScrolledUp) {
      scrollToBottom('smooth');
    }
  }, [globalMessages, isOpen, hasScrolledUp]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onToggle();
      }
    };

    // Small delay to prevent immediate close when opening
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onToggle]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 80;
    setHasScrolledUp(!isNearBottom);
  };

  const handleSend = () => {
    const trimmed = inputVal.trim();
    if (!trimmed) return;
    sendGlobalMessage(trimmed);
    setInputVal('');
    setShowEmojiPicker(false);
    setTimeout(() => scrollToBottom('smooth'), 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiClick = (emoji: string) => {
    setInputVal((prev) => prev + emoji);
    setShowEmojiPicker(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const res = await uploadFile(file);
      sendGlobalMessage(res.url);
      setTimeout(() => scrollToBottom('smooth'), 100);
    } catch (err: any) {
      alert(err.message || 'Attachment upload failed');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAuthorClick = (msg: (typeof globalMessages)[0]) => {
    if (!currentUser) return;
    if (msg.user_id && msg.user_id !== currentUser.id && onOpenDirectChatWith) {
      onOpenDirectChatWith({
        id: msg.user_id,
        name: msg.author_name,
        email: '',
        role: msg.author_role,
        profile_picture_url: msg.author_avatar,
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className={`fixed bottom-5 right-5 z-40 flex flex-col lumora-glass-surface rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transition-all duration-300 ${
        isExpanded
          ? 'w-[92vw] sm:w-[540px] h-[85vh]'
          : 'w-[92vw] sm:w-[410px] h-[580px] max-h-[85vh]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-blue-600 text-white shadow-sm">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">Global Chat</h3>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                {onlineCount} online
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Community discussion
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setSoundEnabled(!isSoundEnabled)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={isSoundEnabled ? 'Mute notification sound' : 'Unmute notification sound'}
          >
            {isSoundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="hidden sm:inline-flex p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={isExpanded ? 'Collapse size' : 'Expand size'}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Close Global Chat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>


      {/* Messages Stream */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 scroller-thin bg-slate-50/50 dark:bg-slate-900/50 space-y-1 relative"
      >
        {globalMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 dark:text-slate-500">
            <MessageSquare className="w-10 h-10 mb-2 opacity-40 text-slate-400" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Welcome to the Global Live Stream!
            </p>
            <p className="text-xs mt-1 max-w-xs">
              Say hello, share ideas, or join the conversation with Lumora readers and writers worldwide.
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
                onAuthorClick={
                  currentUser && msg.user_id && msg.user_id !== currentUser.id
                    ? () => handleAuthorClick(msg)
                    : undefined
                }
              />
            );
          })
        )}
        <div ref={messagesEndRef} />

        {hasScrolledUp && (
          <button
            onClick={() => scrollToBottom('smooth')}
            className="sticky bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-600 text-white text-xs font-semibold shadow-lg hover:bg-blue-700 transition-transform active:scale-95"
          >
            <ChevronDown className="w-3.5 h-3.5" />
            New messages below
          </button>
        )}
      </div>

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-850/95 flex items-center gap-1.5 overflow-x-auto scroller-thin">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleEmojiClick(emoji)}
              className="text-lg p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Input Box */}
      <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-2">
          {currentUser && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,.pdf,.txt,.zip"
                onChange={handleFileUpload}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                title="Attach file"
              >
                <Paperclip className="w-4 h-4" />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors"
            title="Insert emoji"
          >
            <Smile className="w-4 h-4" />
          </button>

          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              currentUser
                ? `Message global room as ${currentUser.name}...`
                : 'Join live discussion (Guest)...'
            }
            className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 px-3.5 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
          />

          <button
            type="button"
            onClick={handleSend}
            disabled={!inputVal.trim()}
            className="p-2.5 rounded-xl bg-blue-600 text-white shadow hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
            title="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

