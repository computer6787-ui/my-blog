import React, { useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWebSocket } from '../context/WebSocketContext';

export const ChatRoot: React.FC = () => {
  const navigate = useNavigate();
  const {
    currentUser,
    onlineCount,
    totalUnreadCount,
  } = useWebSocket();

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
    const handleOpenGlobal = () => {
      window.location.href = '/chat';
    };
    const handleToggleGlobal = () => {
      window.location.href = '/chat';
    };
    const handleOpenDirect = () => {
      window.location.href = '/chat';
    };
    const handleToggleDirect = () => {
      window.location.href = '/chat';
    };

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
  }, []);

  return (
    <>
      {/* Floating Action Buttons Hub in bottom right */}
      <div className="fixed bottom-5 right-5 z-40 flex items-center gap-3 select-none">
        {/* Direct Messages Trigger */}
        {currentUser && (
          <button
            onClick={() => navigate('/chat')}
            className="relative p-3.5 rounded-full bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-100 shadow-lg border border-slate-200 dark:border-slate-800 hover:scale-105 active:scale-95 transition-all group"
            title="Open Private Messages"
            aria-label="Open Private Messages"
          >
            <MessageSquare className="w-5 h-5 text-blossom-600 dark:text-blossom-400 group-hover:rotate-6 transition-transform" />
            {totalUnreadCount > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white shadow-sm ring-2 ring-white dark:ring-slate-900 animate-pulse">
                {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
              </span>
            )}
          </button>
        )}

        {/* Global Live Room Trigger */}
        <button
          onClick={() => navigate('/chat')}
          className="relative flex items-center gap-2 py-3 px-5 min-h-12 rounded-full bg-blossom-600 text-white shadow-lg hover:bg-blossom-700 hover:scale-105 active:scale-95 transition-all"
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
      </div>
    </>
  );
};
