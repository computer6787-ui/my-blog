import React from 'react';
import { X, MessageSquare, LogIn } from 'lucide-react';
import { useWebSocket } from '../context/WebSocketContext';
import { ActiveChatThread } from './ActiveChatThread';
import { ConversationListView } from './ConversationListView';
import type { ChatUser } from '../types';

interface DirectChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DirectChatDrawer: React.FC<DirectChatDrawerProps> = ({ isOpen, onClose }) => {
  const { currentUser, activeRecipient, setActiveRecipient } = useWebSocket();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity animate-fade-in"
      />

      {/* Drawer Panel */}
      <aside
        className="relative w-full max-w-md h-full lumora-glass-surface bg-white/95 dark:bg-slate-900/95 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col z-10 transition-transform duration-300 transform translate-x-0"
        aria-label="Direct Messages Drawer"
      >
        {!currentUser ? (
          /* Guest fallback */
          <div className="flex-1 flex flex-col p-6 items-center justify-center text-center">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              title="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 mb-4 shadow-inner">
              <MessageSquare className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              Private Messenger
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-xs leading-relaxed">
              Connect directly with Lumora authors, collaborate on essays, and discuss ideas in real-time private threads.
            </p>
            <div className="mt-6 flex flex-col gap-2.5 w-full max-w-xs">
              <a
                href="/login"
                className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 text-white font-semibold text-sm shadow hover:bg-blue-700 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Sign In to Message
              </a>
              <a
                href="/register"
                className="flex items-center justify-center py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Create an Account
              </a>
            </div>
          </div>
        ) : activeRecipient ? (
          <ActiveChatThread
            recipient={activeRecipient}
            onBack={() => setActiveRecipient(null)}
            onClose={onClose}
          />
        ) : (
          <ConversationListView
            onSelectUser={(user: ChatUser) => setActiveRecipient(user)}
            onClose={onClose}
          />
        )}
      </aside>
    </div>
  );
};

