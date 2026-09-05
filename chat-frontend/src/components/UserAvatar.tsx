import React from 'react';

interface UserAvatarProps {
  name?: string | null;
  avatarUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isOnline?: boolean;
  showStatus?: boolean;
}

const GRADIENTS = [
  'from-blossom-500 to-blossom-600',
  'from-pink-500 to-rose-600',
  'from-blossom-500 to-cyan-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-blossom-500 to-fuchsia-600',
];

function getInitialAndGradient(name?: string | null): { initial: string; gradient: string } {
  const safeName = (name || 'Guest').trim();
  const initial = safeName ? safeName[0].toUpperCase() : 'G';
  let hash = 0;
  for (let i = 0; i < safeName.length; i++) {
    hash = safeName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % GRADIENTS.length;
  return { initial, gradient: GRADIENTS[index] };
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  name,
  avatarUrl,
  size = 'md',
  isOnline = false,
  showStatus = false,
}) => {
  const { initial, gradient } = getInitialAndGradient(name);

  const sizeClasses = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-xs font-semibold',
    md: 'w-10 h-10 text-sm font-bold',
    lg: 'w-12 h-12 text-base font-bold',
    xl: 'w-16 h-16 text-lg font-bold',
  }[size];

  const dotSizeClasses = {
    xs: 'w-2 h-2 bottom-0 right-0',
    sm: 'w-2.5 h-2.5 bottom-0 right-0',
    md: 'w-3 h-3 bottom-0.5 right-0.5',
    lg: 'w-3.5 h-3.5 bottom-0.5 right-0.5',
    xl: 'w-4 h-4 bottom-1 right-1',
  }[size];

  return (
    <div className={`relative inline-flex flex-shrink-0 items-center justify-center ${sizeClasses}`}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name || 'User Avatar'}
          className="w-full h-full rounded-full object-cover shadow-inner ring-1 ring-black/5 dark:ring-white/10"
          onError={(e) => {
            // Fallback to initial if image fails
            (e.currentTarget as HTMLElement).style.display = 'none';
          }}
        />
      ) : (
        <div
          className={`w-full h-full rounded-full bg-gradient-to-br ${gradient} text-white flex items-center justify-center shadow-inner select-none`}
        >
          {initial}
        </div>
      )}

      {showStatus && (
        <span
          className={`absolute rounded-full ring-2 ring-white dark:ring-slate-900 ${dotSizeClasses} ${
            isOnline ? 'bg-emerald-500 live-pulse-dot' : 'bg-slate-400 dark:bg-slate-600'
          }`}
          title={isOnline ? 'Online now' : 'Offline'}
        />
      )}
    </div>
  );
};
