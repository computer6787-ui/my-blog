import React from 'react';

import {
  Check,
  CheckCheck,
  FileText,
  Download,
  ExternalLink,
  ImageOff,
} from 'lucide-react';

import { RoleBadge } from './RoleBadge';
import { UserAvatar } from './UserAvatar';

interface MessageBubbleProps {
  id: number;
  authorName?: string;
  authorRole?: string;
  authorAvatar?: string | null;
  messageBody: string;
  createdAt: string;
  isSelf: boolean;
  isRead?: boolean;
  showAvatar?: boolean;
  showRole?: boolean;
  onAuthorClick?: () => void;
}

function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString);

    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  authorName,
  authorRole,
  authorAvatar,
  messageBody,
  createdAt,
  isSelf,
  isRead,
  showAvatar = true,
  showRole = true,
  onAuthorClick,
}) => {
  const timeFormatted = formatTime(createdAt);

  // Renders an image with a graceful placeholder if the attachment is
  // missing or fails to load (e.g. a file that no longer exists on disk).
  const renderAttachmentImage = (
    src: string,
    alt: string
  ) => (
    <div className="mt-1 overflow-hidden rounded-xl border border-black/10 dark:border-white/10 shadow-sm max-w-xs">
      <img
        src={src}
        alt={alt}
        className="block w-full max-h-60 object-cover cursor-pointer hover:opacity-95 transition-opacity"
        onClick={() => window.open(src, '_blank')}
        onError={(e) => {
          const target = e.currentTarget;
          target.style.display = 'none';
          const placeholder = target.nextElementSibling as HTMLElement | null;
          if (placeholder) placeholder.style.display = 'flex';
        }}
      />
      <div
        className="hidden items-center gap-2.5 px-4 py-3 text-xs text-slate-500 dark:text-slate-400 bg-black/5 dark:bg-white/5"
        aria-hidden="true"
      >
        <ImageOff className="w-4 h-4 flex-shrink-0" />
        <span className="truncate">This image is no longer available</span>
      </div>
    </div>
  );

  const renderContent = () => {
    const trimmed = messageBody.trim();

    // Markdown image: ![alt](url)
    const markdownImgMatch = trimmed.match(
      /^!\[(.*?)\]\((.*?)\)$/
    );

    if (markdownImgMatch) {
      const alt = markdownImgMatch[1];
      const src = markdownImgMatch[2];

      return renderAttachmentImage(src, alt || 'Image');
    }

    // Direct image URL
    if (
      IMAGE_REGEX.test(trimmed) &&
      trimmed.split(/\s+/).length === 1
    ) {
      return renderAttachmentImage(trimmed, 'Attachment');
    }

    // Local uploaded file
    if (trimmed.startsWith('/static/uploads/chat/')) {
      const fileName =
        trimmed
          .split('/')
          .pop()
          ?.replace(/^[a-f0-9]{12}_/, '') || 'Attachment';

      const isImg =
        /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(trimmed);

      if (isImg) {
        return renderAttachmentImage(trimmed, fileName);
      }

      return (
        <a
          href={trimmed}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 p-2 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 transition-colors text-xs font-medium max-w-full"
        >
          <FileText className="w-4 h-4 text-blossom-500 flex-shrink-0" />

          <span className="truncate max-w-[140px]">
            {fileName}
          </span>

          <Download className="w-3.5 h-3.5 ml-auto opacity-70 flex-shrink-0" />
        </a>
      );
    }

    // Normal text + URLs
    const parts = messageBody.split(URL_REGEX);

    return (
      <p
        className="
          m-0
          min-w-0
          max-w-full
          text-sm
          leading-relaxed
          whitespace-pre-wrap
          break-words
        "
        style={{
          overflowWrap: 'anywhere',
          wordBreak: 'break-word',
        }}
      >
        {parts.map((part, i) => {
          if (URL_REGEX.test(part)) {
            // Reset regex lastIndex because URL_REGEX is global
            URL_REGEX.lastIndex = 0;

            return (
              <a
                key={i}
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                className="
                  underline
                  inline-flex
                  items-center
                  gap-0.5
                  font-medium
                  hover:opacity-80
                  break-all
                  max-w-full
                "
              >
                <span className="break-all">{part}</span>

                <ExternalLink className="w-2.5 h-2.5 inline flex-shrink-0" />
              </a>
            );
          }

          URL_REGEX.lastIndex = 0;

          return part;
        })}
      </p>
    );
  };

  return (
    <div
      className={`
        group
        flex
        items-end
        gap-2.5
        mb-3.5
        transition-all
        min-w-0
        w-full
        ${isSelf ? 'flex-row-reverse' : 'flex-row'}
      `}
    >
      {/* Avatar */}
      {showAvatar && !isSelf && (
        <div
          onClick={onAuthorClick}
          className={
            onAuthorClick
              ? 'cursor-pointer hover:opacity-85 transition-opacity flex-shrink-0'
              : 'flex-shrink-0'
          }
          title={
            onAuthorClick
              ? `Direct message ${authorName || 'user'}`
              : undefined
          }
        >
          <UserAvatar
            name={authorName}
            avatarUrl={authorAvatar}
            size="sm"
          />
        </div>
      )}

      {/* Message column */}
      <div
        className={`
          min-w-0
          max-w-[75%]
          flex
          flex-col
          ${isSelf ? 'items-end' : 'items-start'}
        `}
      >
        {/* Author */}
        {!isSelf && authorName && (
          <div className="flex items-center gap-1.5 mb-1 px-1 max-w-full">
            <span
              onClick={onAuthorClick}
              className={`
                text-xs
                font-semibold
                text-slate-700
                dark:text-slate-300
                truncate
                ${
                  onAuthorClick
                    ? 'cursor-pointer hover:text-blossom-600 dark:hover:text-blossom-400 transition-colors'
                    : ''
                }
              `}
            >
              {authorName}
            </span>

            {showRole && (
              <RoleBadge
                role={authorRole}
                size="sm"
              />
            )}
          </div>
        )}

        {/* Bubble */}
        <div
          className={`
            relative
            w-fit
            max-w-full
            min-w-[120px]
            px-4
            py-3.5
            rounded-xl
            text-sm
            shadow-sm
            break-words
            ${isSelf
              ? 'bg-blossom-600 text-white rounded-br-md'
              : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-md'
            }
          `}
        >
          {renderContent()}

          {/* Time + read status */}
          <div
            className={`
              flex
              items-center
              justify-end
              gap-1
              mt-1.5
              text-[10px]
              select-none
              whitespace-nowrap
              ${
                isSelf
                  ? 'text-white/75'
                  : 'text-slate-400 dark:text-slate-500'
              }
            `}
          >
            <span>{timeFormatted}</span>

            {isSelf && typeof isRead === 'boolean' && (
              <span
                title={isRead ? 'Seen' : 'Delivered'}
                className="flex-shrink-0"
              >
                {isRead ? (
                  <CheckCheck className="w-3.5 h-3.5 text-white/90" />
                ) : (
                  <Check className="w-3.5 h-3.5 text-white/70" />
                )}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Matches direct image URLs
const IMAGE_REGEX =
  /https?:\/\/[^\s]+?\.(?:png|jpg|jpeg|gif|webp|svg)(?:\?[^\s]*)?/i;

// Matches URLs
const URL_REGEX =
  /https?:\/\/[^\s]+/g;