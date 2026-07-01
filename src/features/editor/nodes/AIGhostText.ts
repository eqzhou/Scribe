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

/** 声明 AIGhostText 注入到编辑器命令链的命令类型 */
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    aiGhostText: {
      /** 在光标处插入空的 AI 幽灵文本节点 */
      insertAIGhostText: (text?: string) => ReturnType;
      /** 更新当前 ghost 节点的文本 */
      setGhostText: (text: string) => ReturnType;
      /** 接受 ghost 文本（转为普通段落） */
      acceptGhostText: () => ReturnType;
      /** 拒绝 ghost 文本（删除节点） */
      rejectGhostText: () => ReturnType;
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
        (text?: string) =>
        ({ tr, state, dispatch }: CommandProps) => {
          const ghostNode = state.schema.nodes.aiGhostText.create({
            text: text ?? '',
          });
          const { from } = state.selection;
          tr.insert(from, ghostNode);
          if (dispatch) dispatch(tr);
          return true;
        },
      setGhostText:
        (text: string) =>
        ({ tr, state, dispatch }: CommandProps) => {
          let updated = false;
          state.doc.descendants((node, pos) => {
            if (node.type.name === 'aiGhostText') {
              tr.setNodeMarkup(pos, undefined, { text });
              updated = true;
              return false;
            }
            return true;
          });
          if (updated && dispatch) dispatch(tr);
          return updated;
        },
      acceptGhostText:
        () =>
        ({ tr, state, dispatch }: CommandProps) => {
          let found = false;
          let insertText = '';
          let pos = 0;
          let nodeSize = 0;
          state.doc.descendants((node, p) => {
            if (node.type.name === 'aiGhostText' && !found) {
              found = true;
              insertText = node.attrs.text || '';
              pos = p;
              nodeSize = node.nodeSize;
              return false;
            }
            return true;
          });
          if (found && dispatch) {
            // 删除 ghost 节点，在原位插入普通段落文本
            tr.delete(pos, pos + nodeSize);
            tr.insertText(insertText, pos);
            dispatch(tr);
          }
          return found;
        },
      rejectGhostText:
        () =>
        ({ tr, state, dispatch }: CommandProps) => {
          let found = false;
          let pos = 0;
          let nodeSize = 0;
          state.doc.descendants((node, p) => {
            if (node.type.name === 'aiGhostText' && !found) {
              found = true;
              pos = p;
              nodeSize = node.nodeSize;
              return false;
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
