import {
  $applyNodeReplacement,
  ElementNode,
  type EditorConfig,
  type LexicalNode,
  type SerializedElementNode,
} from 'lexical';

/** Same JSON type as Lexical's HorizontalRuleNode: drafts and markdown stay compatible. */
export const POST_LINE_NODE_TYPE = 'horizontalrule';

export type SerializedLineNode = SerializedElementNode & {
  type: typeof POST_LINE_NODE_TYPE;
};

/**
 * Horizontal line block (`---`). A plain element like image / video blocks, not
 * Lexical's decorator HorizontalRuleNode: the decorator's own "block cursor"
 * navigation overrides node selection and strands the caret on the root.
 */
export class LineNode extends ElementNode {
  static getType(): string {
    return POST_LINE_NODE_TYPE;
  }

  static clone(node: LineNode): LineNode {
    return new LineNode(node.__key);
  }

  createDOM(config: EditorConfig): HTMLElement {
    const hr = document.createElement('hr');
    hr.contentEditable = 'false';
    const className = config.theme.hr;
    if (typeof className === 'string' && className) {
      hr.className = className;
    }
    return hr;
  }

  updateDOM(): boolean {
    return false;
  }

  /** Accepts both this node's JSON and Lexical HorizontalRuleNode JSON (no element fields). */
  static importJSON(): LineNode {
    return $createLineNode();
  }

  exportJSON(): SerializedLineNode {
    return { ...super.exportJSON(), type: POST_LINE_NODE_TYPE, version: 1 };
  }

  isInline(): boolean {
    return false;
  }

  canBeEmpty(): boolean {
    return true;
  }

  canInsertTextBefore(): boolean {
    return false;
  }

  canInsertTextAfter(): boolean {
    return false;
  }
}

export function $createLineNode(): LineNode {
  return $applyNodeReplacement(new LineNode());
}

export function $isLineNode(node: LexicalNode | null | undefined): node is LineNode {
  return node instanceof LineNode;
}
