import React, { useState, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import { useWebSocket } from '../context/WebSocketContext';
import { GlobalChatPanel } from './GlobalChatPanel';
import { DirectChatDrawer } from './DirectChatDrawer';
import type { ChatUser } from '../types';

export const ChatRoot: React.FC = () => {
  const {
    currentUser,
    onlineCount,
    totalUnreadCount,
    setActiveRecipient,
  } = useWebSocket();

  const [isGlobalOpen, setIsGlobalOpen] = useState(false);
  const [isDirectOpen, setIsDirectOpen] = useState(false);

  // Sync unread badge count to any navbar elements on the page
  useEffect(() => {
    const navBadges = document.querySelectorAll('.lumora-chat-unread-badge');
    navBadges.forEach((badge) => {
      if (totalUnreadCount > 0) {
        badge.textContent = totalUnreadCount > 99 ? '99+' : String(totalUnreadCount);
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    });
  }, [totalUnreadCount]);

  // Listen for custom dispatch events from Jinja templates or navbar triggers
  useEffect(() => {
    const handleOpenGlobal = () => setIsGlobalOpen(true);
    const handleToggleGlobal = () => setIsGlobalOpen((prev) => !prev);
    const handleOpenDirect = (e: any) => {
      setIsDirectOpen(true);
      if (e.detail?.user) {
        setActiveRecipient(e.detail.user);
      } else if (e.detail?.user_id) {
        // Fetch user data
        fetch(`/chat/users?q=${e.detail.user_id}`, { credentials: 'include' })
          .then((r) => r.json())
          .then((users) => {
            const found = users.find((u: ChatUser) => u.id === Number(e.detail.user_id));
            if (found) setActiveRecipient(found);
          });
      }
    };
    const handleToggleDirect = () => setIsDirectOpen((prev) => !prev);

    window.addEventListener('lumora:open-global-chat', handleOpenGlobal);
    window.addEventListener('lumora:toggle-global-chat', handleToggleGlobal);
    window.addEventListener('lumora:open-direct-chat', handleOpenDirect);
    window.addEventListener('lumora:toggle-direct-chat', handleToggleDirect);

    return () => {
      window.removeEventListener('lumora:open-global-chat', handleOpenGlobal);
      window.removeEventListener('lumora:toggle-global-chat', handleToggleGlobal);
      window.removeEventListener('lumora:open-direct-chat', handleOpenDirect);
      window.removeEventListener('lumora:toggle-direct-chat', handleToggleDirect);
    };
  }, [setActiveRecipient]);

  return (
    <>
      {/* Floating Action Buttons Hub in bottom right */}
      <div className="fixed bottom-5 right-5 z-40 flex items-center gap-3 select-none">
        {/* Direct Messages Trigger (Only if not already open) */}
        {!isDirectOpen && currentUser && (
          <button
            onClick={() => setIsDirectOpen(true)}
            className="relative p-3.5 rounded-full bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-100 shadow-lg border border-slate-200 dark:border-slate-800 hover:scale-105 active:scale-95 transition-all group"
            title="Open Private Messages"
            aria-label="Open Private Messages"
          >
            <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400 group-hover:rotate-6 transition-transform" />
            {totalUnreadCount > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white shadow-sm ring-2 ring-white dark:ring-slate-900 animate-pulse">
                {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
              </span>
            )}
          </button>
        )}

        {/* Global Live Room Trigger (Only if global panel is closed) */}
        {!isGlobalOpen && (
          <button
            onClick={() => setIsGlobalOpen(true)}
            className="relative flex items-center gap-2 py-2.5 px-4 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all"
            title="Open Global Live Discussion"
            aria-label="Open Global Chat"
          >
            <MessageSquare className="w-4 h-4" />
            <span className="text-xs font-semibold">Live Chat</span>
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              {onlineCount}
            </span>
          </button>
        )}
      </div>

      {/* Global Live Chat Panel */}
      <GlobalChatPanel
        isOpen={isGlobalOpen}
        onToggle={() => setIsGlobalOpen(false)}
        onOpenDirectChatWith={(user) => {
          setIsDirectOpen(true);
          setActiveRecipient(user);
        }}
      />

      {/* Direct Chat Messenger Drawer */}
      <DirectChatDrawer
        isOpen={isDirectOpen}
        onClose={() => setIsDirectOpen(false)}
      />
    </>
  );
};
