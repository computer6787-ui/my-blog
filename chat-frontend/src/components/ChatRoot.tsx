import React, { useEffect } from 'react';
import { useWebSocket } from '../context/WebSocketContext';

export const ChatRoot: React.FC = () => {
  const {
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

  return null;
};
