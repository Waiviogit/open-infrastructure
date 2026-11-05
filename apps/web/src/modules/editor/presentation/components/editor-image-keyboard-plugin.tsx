'use client';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getNearestNodeFromDOMNode,
  $getSelection,
  $isNodeSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  SELECTION_CHANGE_COMMAND,
} from 'lexical';
import { useEffect } from 'react';

import {
  $getMediaBlockAfterRange,
  $getMediaBlockBeforeRange,
  $getSelectedMediaBlockNodes,
  $removeMediaBlocksAndPlaceCaret,
  $selectMediaBlockNode,
} from '../../application/image-selection';
import { $isMediaBlockNode } from '../../domain/nodes/media-block';

const MEDIA_BLOCK_SELECTOR = '[data-post-image], [data-post-video], hr';

function setImageDomSelected(el: Element, selected: boolean): void {
  if (selected) {
    el.setAttribute('data-image-selected', '');
    el.setAttribute('aria-selected', 'true');
  } else {
    el.removeAttribute('data-image-selected');
    el.removeAttribute('aria-selected');
  }
}

function syncImageDomSelection(editor: ReturnType<typeof useLexicalComposerContext>[0]) {
  const root = editor.getRootElement();
  if (!root) {
    return;
  }

  for (const el of root.querySelectorAll(MEDIA_BLOCK_SELECTOR)) {
    setImageDomSelected(el, false);
  }

  let blockSelected = false;
  editor.getEditorState().read(() => {
    const selection = $getSelection();
    if (!$isNodeSelection(selection)) {
      return;
    }
    for (const node of $getSelectedMediaBlockNodes(selection)) {
      const dom = editor.getElementByKey(node.getKey());
      if (dom) {
        setImageDomSelected(dom, true);
        blockSelected = true;
      }
    }
  });
  // The browser keeps a stale caret while a block is node-selected; hide it.
  if (blockSelected) {
    root.setAttribute('data-block-selected', '');
  } else {
    root.removeAttribute('data-block-selected');
  }
}

export function EditorImageKeyboardPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    /**
     * Runs inside the command's own update (no nested `editor.update`: Lexical
     * would defer it, the command would fall through to the default delete and
     * the caret would jump). Returns whether the key was consumed.
     */
    const $handleDeleteKey = (
      event: KeyboardEvent | null,
      direction: 'backward' | 'forward',
    ): boolean => {
      const selection = $getSelection();
      let handled = false;
      if ($isNodeSelection(selection)) {
        const blocks = $getSelectedMediaBlockNodes(selection);
        if (blocks.length > 0) {
          $removeMediaBlocksAndPlaceCaret(blocks);
          handled = true;
        }
      } else if ($isRangeSelection(selection) && selection.isCollapsed()) {
        const block =
          direction === 'backward'
            ? $getMediaBlockBeforeRange(selection)
            : $getMediaBlockAfterRange(selection);
        if (block) {
          $selectMediaBlockNode(block);
          handled = true;
        }
      }
      if (handled) {
        // Stop the browser's beforeinput delete: it would remove the block just selected.
        event?.preventDefault();
      }
      return handled;
    };

    const removeBackspace = editor.registerCommand(
      KEY_BACKSPACE_COMMAND,
      (event: KeyboardEvent | null) => $handleDeleteKey(event, 'backward'),
      COMMAND_PRIORITY_HIGH,
    );

    const removeDelete = editor.registerCommand(
      KEY_DELETE_COMMAND,
      (event: KeyboardEvent | null) => $handleDeleteKey(event, 'forward'),
      COMMAND_PRIORITY_HIGH,
    );

    const removeSelectionSync = editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        syncImageDomSelection(editor);
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );

    const removeUpdateListener = editor.registerUpdateListener(() => {
      syncImageDomSelection(editor);
    });

    return () => {
      removeBackspace();
      removeDelete();
      removeSelectionSync();
      removeUpdateListener();
    };
  }, [editor]);

  useEffect(() => {
    const root = editor.getRootElement();
    if (!root) {
      return;
    }

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const wrapper = target.closest(MEDIA_BLOCK_SELECTOR);
      if (!wrapper || !root.contains(wrapper)) {
        return;
      }
      editor.update(() => {
        const node = $getNearestNodeFromDOMNode(wrapper);
        if ($isMediaBlockNode(node)) {
          $selectMediaBlockNode(node);
        }
      });
      event.preventDefault();
    };

    root.addEventListener('click', onClick);
    return () => root.removeEventListener('click', onClick);
  }, [editor]);

  return null;
}
