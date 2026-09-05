import React from 'react';
import { Shield, Sparkles, User as UserIcon } from 'lucide-react';

interface RoleBadgeProps {
  role?: string | null;
  size?: 'sm' | 'md';
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role, size = 'sm' }) => {
  const normalized = (role || 'guest').toLowerCase();

  if (normalized === 'admin') {
    return (
      <span
        className={`inline-flex items-center gap-1 font-semibold rounded-full uppercase tracking-wider ${
          size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
        } bg-gradient-to-r from-blossom-600 to-blossom-600 text-white shadow-sm`}
        title="Lumora Administrator"
      >
        <Shield className="w-2.5 h-2.5" />
        Admin
      </span>
    );
  }

  if (normalized === 'moderator' || normalized === 'mod') {
    return (
      <span
        className={`inline-flex items-center gap-1 font-semibold rounded-full uppercase tracking-wider ${
          size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
        } bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30`}
        title="Community Moderator"
      >
        <Sparkles className="w-2.5 h-2.5" />
        Mod
      </span>
    );
  }

  if (normalized === 'user' || normalized === 'member' || normalized === 'author') {
    return (
      <span
        className={`inline-flex items-center gap-1 font-medium rounded-full ${
          size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
        } bg-blossom-50 dark:bg-blossom-950/50 text-blossom-600 dark:text-blossom-400 border border-blossom-200/50 dark:border-blossom-800/40`}
      >
        Member
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded-full ${
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
      } bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400`}
    >
      <UserIcon className="w-2.5 h-2.5" />
      Guest
    </span>
  );
};
