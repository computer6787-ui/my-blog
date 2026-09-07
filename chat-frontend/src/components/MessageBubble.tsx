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

  // ------------------------------------------------------------
  // IMAGE ATTACHMENT
  // ------------------------------------------------------------

  const renderAttachmentImage = (src: string, alt: string) => (
    <div className="mt-1 max-w-xs overflow-hidden rounded-xl border border-black/10 shadow-sm dark:border-white/10">
      <img
        src={src}
        alt={alt}
        className="block max-h-60 w-full cursor-pointer object-cover transition-opacity hover:opacity-95"
        onClick={() => window.open(src, '_blank')}
        onError={(e) => {
          const target = e.currentTarget;

          target.style.display = 'none';

          const placeholder =
            target.nextElementSibling as HTMLElement | null;

          if (placeholder) {
            placeholder.style.display = 'flex';
          }
        }}
      />

      <div
        className="hidden items-center gap-2.5 bg-black/5 px-4 py-3 text-xs text-slate-500 dark:bg-white/5 dark:text-slate-400"
        aria-hidden="true"
      >
        <ImageOff className="h-4 w-4 flex-shrink-0" />

        <span className="truncate">
          This image is no longer available
        </span>
      </div>
    </div>
  );

  // ------------------------------------------------------------
  // MESSAGE CONTENT
  // ------------------------------------------------------------

  const renderContent = () => {
    const trimmed = messageBody.trim();

    // ----------------------------------------------------------
    // Markdown image: ![alt](url)
    // ----------------------------------------------------------

    const markdownImgMatch = trimmed.match(
      /^!\[(.*?)\]\((.*?)\)$/
    );

    if (markdownImgMatch) {
      const alt = markdownImgMatch[1];
      const src = markdownImgMatch[2];

      return renderAttachmentImage(src, alt || 'Image');
    }

    // ----------------------------------------------------------
    // Direct image URL
    // ----------------------------------------------------------

    IMAGE_REGEX.lastIndex = 0;

    if (
      IMAGE_REGEX.test(trimmed) &&
      trimmed.split(/\s+/).length === 1
    ) {
      IMAGE_REGEX.lastIndex = 0;

      return renderAttachmentImage(trimmed, 'Attachment');
    }

    IMAGE_REGEX.lastIndex = 0;

    // ----------------------------------------------------------
    // Uploaded file
    // ----------------------------------------------------------

    if (
      trimmed.startsWith('/static/uploads/chat/') ||
      trimmed.includes('/storage/v1/object/public/')
    ) {
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
          className="flex min-w-0 max-w-full items-center gap-2.5 rounded-xl bg-black/5 p-2 text-xs font-medium transition-colors hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15"
        >
          <FileText className="h-4 w-4 flex-shrink-0 text-blossom-500" />

          <span className="max-w-[140px] truncate">
            {fileName}
          </span>

          <Download className="ml-auto h-3.5 w-3.5 flex-shrink-0 opacity-70" />
        </a>
      );
    }

    // ----------------------------------------------------------
    // Normal text + URLs
    // ----------------------------------------------------------

    URL_REGEX.lastIndex = 0;

    const parts = messageBody.split(URL_REGEX);

    URL_REGEX.lastIndex = 0;

    return (
      <p
        style={{
          margin: 0,
          padding: 0,
          width: '100%',
          minWidth: 0,
          maxWidth: '100%',
          fontSize: '14px',
          lineHeight: '1.625',
          overflowWrap: 'anywhere',
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
        }}
      >
        {parts.map((part, i) => {
          URL_REGEX.lastIndex = 0;

          const isUrl = URL_REGEX.test(part);

          URL_REGEX.lastIndex = 0;

          if (isUrl) {
            return (
              <a
                key={i}
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all font-medium underline hover:opacity-80"
                style={{
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-all',
                }}
              >
                {part}

                <ExternalLink className="ml-0.5 inline h-2.5 w-2.5 -mt-0.5" />
              </a>
            );
          }

          return part;
        })}
      </p>
    );
  };

  // ------------------------------------------------------------
  // COMPONENT
  // ------------------------------------------------------------

  return (
    <div
      className={`
        msg-enter
        group
        flex
        w-full
        min-w-0
        items-end
        gap-3
        mb-5
        px-1
        transition-all
        ${isSelf ? 'flex-row-reverse' : 'flex-row'}
      `}
    >
      {/* Avatar */}

      {showAvatar && !isSelf && (
        <div
          onClick={onAuthorClick}
          className={
            onAuthorClick
              ? 'flex-shrink-0 cursor-pointer transition-opacity hover:opacity-85'
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
          max-w-[85%]
          sm:max-w-[75%]
          lg:max-w-[65%]
          flex
          flex-col
          ${isSelf ? 'items-end' : 'items-start'}
        `}
      >
        {/* Author */}

        {!isSelf && authorName && (
          <div className="mb-1 flex max-w-full items-center gap-1.5 px-1">
            <span
              onClick={onAuthorClick}
              className={`
                max-w-full
                truncate
                text-xs
                font-semibold
                text-slate-700
                dark:text-slate-300
                ${
                  onAuthorClick
                    ? 'cursor-pointer transition-colors hover:text-blossom-600 dark:hover:text-blossom-400'
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
            min-w-0
            max-w-full
            rounded-2xl
            shadow-sm
            ${
              isSelf
                ? 'bg-blossom-600 text-white rounded-br-md'
                : 'bg-white text-slate-800 border border-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700 rounded-bl-md'
            }
          `}
          style={{
            padding: '12px 20px',
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
            fontSize: '14px',
            lineHeight: '1.625',
            boxSizing: 'border-box',
          }}
        >
          {renderContent()}

          {/* Time + read status */}

          <div
            className={`
              flex
              min-w-0
              max-w-full
              items-center
              justify-end
              gap-1
              mt-1.5
              whitespace-nowrap
              select-none
              text-[10px]
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
                  <CheckCheck className="h-3.5 w-3.5 text-white/90" />
                ) : (
                  <Check className="h-3.5 w-3.5 text-white/70" />
                )}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ------------------------------------------------------------
// REGEX
// ------------------------------------------------------------

// Matches direct image URLs
const IMAGE_REGEX =
  /https?:\/\/[^\s]+?\.(?:png|jpg|jpeg|gif|webp|svg)(?:\?[^\s]*)?/i;

// Matches URLs
const URL_REGEX =
  /https?:\/\/[^\s]+/g;