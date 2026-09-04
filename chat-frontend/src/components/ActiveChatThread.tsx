import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ArrowLeft,
  Send,
  Smile,
  Paperclip,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useWebSocket } from '../context/WebSocketContext';
import { UserAvatar } from './UserAvatar';
import { RoleBadge } from './RoleBadge';
import { MessageBubble } from './MessageBubble';
import type { ChatUser } from '../types';

interface ActiveChatThreadProps {
  recipient: ChatUser;
  onBack: () => void;
  onClose: () => void;
}

const QUICK_EMOJIS = ['👋', '🔥', '❤️', '👏', '🎉', '💡', '🚀', '✨', '👍', '😊'];

export const ActiveChatThread: React.FC<ActiveChatThreadProps> = ({
  recipient,
  onBack,
  onClose,
}) => {
  const {
    currentUser,
    activeChatHistory,
    typingUsers,
    isSoundEnabled,
    setSoundEnabled,
    sendPrivateMessage,
    sendTypingStatus,
    uploadFile,
  } = useWebSocket();

  const [inputVal, setInputVal] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimerRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChatHistory]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputVal(val);

    sendTypingStatus(recipient.id, true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      sendTypingStatus(recipient.id, false);
    }, 2000);
  };

  const handleSend = () => {
    const trimmed = inputVal.trim();
    if (!trimmed) return;

    sendPrivateMessage(recipient.id, trimmed);
    sendTypingStatus(recipient.id, false);
    setInputVal('');
    setShowEmojiPicker(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const res = await uploadFile(file);
      sendPrivateMessage(recipient.id, res.url);
    } catch (err: any) {
      alert(err.message || 'File upload failed');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const isPartnerTyping = Boolean(typingUsers[String(recipient.id)]);


  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Thread Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Back to conversations"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <UserAvatar
            name={recipient.name}
            avatarUrl={recipient.profile_picture_url}
            size="sm"
            isOnline={recipient.is_online}
            showStatus={true}
          />
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate max-w-[160px]">
                {recipient.name}
              </h4>
              <RoleBadge role={recipient.role} size="sm" />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-none">
              {recipient.is_online ? 'Active now' : 'Offline'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setSoundEnabled(!isSoundEnabled)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={isSoundEnabled ? 'Mute chime' : 'Unmute chime'}
          >
            {isSoundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Direct Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 scroller-thin bg-slate-50/40 dark:bg-slate-900/40 space-y-1 relative">
        {activeChatHistory.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 dark:text-slate-500">
            <UserAvatar
              name={recipient.name}
              avatarUrl={recipient.profile_picture_url}
              size="lg"
              isOnline={recipient.is_online}
              showStatus={true}
            />
            <h4 className="mt-3 font-semibold text-slate-700 dark:text-slate-200 text-sm">
              {recipient.name}
            </h4>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              Start your direct conversation with {recipient.name}. Messages are real-time and private.
            </p>
          </div>
        ) : (
          activeChatHistory.map((msg) => {
            const isSelf = currentUser ? msg.sender_id === currentUser.id : false;
            return (
              <MessageBubble
                key={msg.id}
                id={msg.id}
                authorName={isSelf ? currentUser?.name : recipient.name}
                authorAvatar={isSelf ? currentUser?.profile_picture_url : recipient.profile_picture_url}
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
            <div className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 typing-dot-1" />
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 typing-dot-2" />
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 typing-dot-3" />
              <span className="ml-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {recipient.name} is typing...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>


      {/* Emoji Bar */}
      {showEmojiPicker && (
        <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-850/95 flex items-center gap-1.5 overflow-x-auto scroller-thin">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                setInputVal((p) => p + emoji);
                setShowEmojiPicker(false);
              }}
              className="text-lg p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-slate-700 transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Direct Input */}
      <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-2">
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
            className="p-2 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            title="Attach file"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors"
          >
            <Smile className="w-4 h-4" />
          </button>

          <input
            type="text"
            value={inputVal}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${recipient.name}...`}
            className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 px-3.5 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
          />

          <button
            type="button"
            onClick={handleSend}
            disabled={!inputVal.trim()}
            className="p-2.5 rounded-xl bg-blue-600 text-white shadow hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

