import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  MessageSquare,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useWebSocket } from '../context/WebSocketContext';
import { UserAvatar } from './UserAvatar';
import { RoleBadge } from './RoleBadge';
import type { ChatUser } from '../types';

interface ConversationListViewProps {
  onSelectUser: (user: ChatUser) => void;
  onClose: () => void;
}

export const ConversationListView: React.FC<ConversationListViewProps> = ({
  onSelectUser,
  onClose,
}) => {
  const {
    currentUser,
    conversations,
    isSoundEnabled,
    setSoundEnabled,
  } = useWebSocket();

  const [activeTab, setActiveTab] = useState<'conversations' | 'directory'>('conversations');
  const [searchQuery, setSearchQuery] = useState('');
  const [directoryUsers, setDirectoryUsers] = useState<ChatUser[]>([]);
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(false);

  useEffect(() => {
    if (currentUser && (activeTab === 'directory' || searchQuery.trim())) {
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
  }, [activeTab, searchQuery, currentUser]);

  const filteredConversations = conversations.filter((c) =>
    c.user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );


  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* List Header */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-slate-600 text-white shadow-sm">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                Direct Messages
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Encrypted peer conversations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setSoundEnabled(!isSoundEnabled)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={isSoundEnabled ? 'Mute chime' : 'Unmute chime'}
            >
              {isSoundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === 'conversations' ? 'Search chats...' : 'Find users...'}
            className="w-full bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3.5 py-2 rounded-lg text-sm border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-shadow placeholder:text-slate-400"
          />
        </div>

        {/* Navigation Tabs */}
        <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5">
          <button
            onClick={() => setActiveTab('conversations')}
            className={`flex-1 py-1.5 px-2 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'conversations'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Chats ({conversations.length})
          </button>
          <button
            onClick={() => setActiveTab('directory')}
            className={`flex-1 py-1.5 px-2 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'directory'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Directory
          </button>
        </div>
      </div>


      {/* List Body */}
      <div className="flex-1 overflow-y-auto scroller-thin divide-y divide-slate-100 dark:divide-slate-800/60">
        {activeTab === 'conversations' ? (
          filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-slate-400 dark:text-slate-500">
              <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30 text-slate-400" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                No conversations yet
              </p>
              <p className="text-xs mt-1 text-slate-400">
                Switch to the Directory tab or click any author in Global Live to start messaging!
              </p>
              <button
                onClick={() => setActiveTab('directory')}
                className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <Users className="w-3.5 h-3.5" />
                Browse Directory
              </button>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <div
                key={conv.user.id}
                onClick={() => onSelectUser(conv.user)}
                className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group"
              >
                <UserAvatar
                  name={conv.user.name}
                  avatarUrl={conv.user.profile_picture_url}
                  size="md"
                  isOnline={conv.user.is_online}
                  showStatus={true}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {conv.user.name}
                      </span>
                      <RoleBadge role={conv.user.role} size="sm" />
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                      {new Date(conv.last_message_time).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate pr-2">
                      {currentUser && conv.last_sender_id === currentUser.id ? 'You: ' : ''}
                      {conv.last_message}
                    </p>
                    {conv.unread_count > 0 && (
                      <span className="flex-shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white min-w-4 text-center">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )
        ) : (
          /* Directory Tab */
          isLoadingDirectory ? (
            <div className="p-8 text-center text-xs text-slate-400">
              Loading users...
            </div>
          ) : directoryUsers.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No users found matching your search.
            </div>
          ) : (
            directoryUsers.map((user) => (
              <div
                key={user.id}
                onClick={() => onSelectUser(user)}
                className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar
                    name={user.name}
                    avatarUrl={user.profile_picture_url}
                    size="md"
                    isOnline={user.is_online}
                    showStatus={true}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {user.name}
                      </span>
                      <RoleBadge role={user.role} size="sm" />
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">
                      {user.email || (user.is_online ? 'Active now' : 'Offline')}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 group-hover:bg-blue-600 group-hover:text-white transition-colors"
                >
                  Chat
                </button>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
};

