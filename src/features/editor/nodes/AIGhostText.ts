/**
 * AIGhostText AI 幽灵文本节点
 *
 * 行内块节点，用于在编辑器中展示 AI 续写/生成的灰色建议文本。
 * - 灰色斜体样式，与正文区分
 * - Tab 接受：将节点转为普通段落文本
 * - Esc 拒绝：删除节点
 * - 流式追加：通过 setGhostText 命令实时更新内容
 */
import { Node, mergeAttributes, type CommandProps, type RawCommands } from '@tiptap/core';

export type AIGhostSource = 'continue' | 'rewrite' | 'fulltext';
export const AI_GHOST_ACCEPTED_META = 'scribe:ai-ghost-accepted';

export interface AIGhostAcceptanceMeta {
  source: AIGhostSource;
  text: string;
}

export function isFulltextGhostAcceptance(meta: unknown): meta is AIGhostAcceptanceMeta {
  return typeof meta === 'object'
    && meta !== null
    && (meta as AIGhostAcceptanceMeta).source === 'fulltext'
    && typeof (meta as AIGhostAcceptanceMeta).text === 'string';
}

export function updateGhostAttributes(
  attributes: Record<string, unknown>,
  text: string,
): Record<string, unknown> {
  return { ...attributes, text };
}

export function createAIGhostId(): string {
  return globalThis.crypto?.randomUUID?.()
    ?? `ai-ghost-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function matchesAIGhostId(nodeGhostId: unknown, ghostId: string | undefined): boolean {
  return ghostId === undefined || nodeGhostId === ghostId;
}

/** 声明 AIGhostText 注入到编辑器命令链的命令类型 */
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    aiGhostText: {
      /** 在光标处插入空的 AI 幽灵文本节点 */
      insertAIGhostText: (text?: string, source?: AIGhostSource, ghostId?: string) => ReturnType;
      /** 更新指定 ghost 节点的文本 */
      setGhostText: (ghostId: string, text: string) => ReturnType;
      /** 接受指定 ghost 文本（未指定时接受最近一个） */
      acceptGhostText: (ghostId?: string) => ReturnType;
      /** 拒绝指定 ghost 文本（未指定时拒绝最近一个） */
      rejectGhostText: (ghostId?: string) => ReturnType;
    };
  }
}

/** AI 幽灵文本节点：灰色斜体，可接受/拒绝 */
export const AIGhostText = Node.create({
  name: 'aiGhostText',
  group: 'block',
  atom: true,
  defining: true,

  addAttributes() {
    return {
      text: {
        default: '',
      },
      source: {
        default: 'continue',
      },
      ghostId: {
        default: '',
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-ai-ghost]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-ai-ghost': '',
        class: 'ai-ghost-text',
        contenteditable: 'false',
      }),
      node.attrs.text || '',
    ];
  },

  addCommands() {
    return {
      insertAIGhostText:
        (text?: string, source: AIGhostSource = 'continue', ghostId = createAIGhostId()) =>
        ({ tr, state, dispatch }: CommandProps) => {
          const ghostNode = state.schema.nodes.aiGhostText.create({
            text: text ?? '',
            source,
            ghostId,
          });
          const { from } = state.selection;
          tr.insert(from, ghostNode);
          if (dispatch) dispatch(tr);
          return true;
        },
      setGhostText:
        (ghostId: string, text: string) =>
        ({ tr, state, dispatch }: CommandProps) => {
          let updated = false;
          state.doc.descendants((node, pos) => {
            if (node.type.name === 'aiGhostText' && matchesAIGhostId(node.attrs.ghostId, ghostId)) {
              tr.setNodeMarkup(pos, undefined, updateGhostAttributes(node.attrs, text));
              updated = true;
              return false;
            }
            return true;
          });
          if (updated && dispatch) dispatch(tr);
          return updated;
        },
      acceptGhostText:
        (ghostId?: string) =>
        ({ tr, state, dispatch }: CommandProps) => {
          let found = false;
          let insertText = '';
          let source: AIGhostSource = 'continue';
          let pos = 0;
          let nodeSize = 0;
          state.doc.descendants((node, p) => {
            if (node.type.name === 'aiGhostText' && matchesAIGhostId(node.attrs.ghostId, ghostId)) {
              found = true;
              insertText = node.attrs.text || '';
              source = node.attrs.source === 'fulltext' || node.attrs.source === 'rewrite'
                ? node.attrs.source
                : 'continue';
              pos = p;
              nodeSize = node.nodeSize;
            }
            return true;
          });
          if (found && dispatch) {
            // 删除 ghost 节点，在原位插入普通段落文本
            tr.delete(pos, pos + nodeSize);
            tr.insertText(insertText, pos);
            tr.setMeta(AI_GHOST_ACCEPTED_META, {
              source,
              text: insertText,
            });
            dispatch(tr);
          }
          return found;
        },
      rejectGhostText:
        (ghostId?: string) =>
        ({ tr, state, dispatch }: CommandProps) => {
          let found = false;
          let pos = 0;
          let nodeSize = 0;
          state.doc.descendants((node, p) => {
            if (node.type.name === 'aiGhostText' && matchesAIGhostId(node.attrs.ghostId, ghostId)) {
              found = true;
              pos = p;
              nodeSize = node.nodeSize;
            }
            return true;
          });
          if (found && dispatch) {
            tr.delete(pos, pos + nodeSize);
            dispatch(tr);
          }
          return found;
        },
      hasGhostText:
        () =>
        ({ state }: CommandProps) => {
          let found = false;
          state.doc.descendants((node) => {
            if (node.type.name === 'aiGhostText') {
              found = true;
              return false;
            }
            return true;
          });
          return found;
        },
    } as Partial<RawCommands>;
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        // 仅当存在 ghost 文本时拦截 Tab
        return this.editor.commands.acceptGhostText();
      },
      Escape: () => {
        return this.editor.commands.rejectGhostText();
      },
    };
  },
});

export default AIGhostText;
