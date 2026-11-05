'use client';

import dynamic from 'next/dynamic';
import { EmojiStyle, Theme, type EmojiClickData } from 'emoji-picker-react';

import { useI18n } from '@/i18n/providers/i18n-provider';

import '../styles/editor-emoji-picker.css';

/** Picker data (~300 KB) loads only when the Emoji panel opens. */
const EmojiPicker = dynamic(() => import('emoji-picker-react'), {
  ssr: false,
  loading: () => null,
});

const PICKER_HEIGHT_PX = 360;

export type EditorInsertEmojiPanelProps = {
  onSelect: (emoji: string) => void;
};

/**
 * Native-glyph emoji picker (no CDN sprite sheets) themed through CSS variables.
 */
export function EditorInsertEmojiPanel({ onSelect }: EditorInsertEmojiPanelProps) {
  const { t } = useI18n();
  return (
    <div className="editor-emoji-picker">
      <EmojiPicker
        emojiStyle={EmojiStyle.NATIVE}
        theme={Theme.LIGHT}
        width="100%"
        height={PICKER_HEIGHT_PX}
        lazyLoadEmojis
        previewConfig={{ showPreview: false }}
        searchPlaceholder={t('editor_emoji_search_placeholder')}
        onEmojiClick={(data: EmojiClickData) => onSelect(data.emoji)}
      />
    </div>
  );
}
