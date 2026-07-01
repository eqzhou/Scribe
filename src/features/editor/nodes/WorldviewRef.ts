/**
 * WorldviewRef 世界观引用节点
 *
 * 行内原子节点（inline + atom），携带 worldviewId 与 label 属性。
 * 渲染为带铜金背景的胶囊标签，不可编辑内容。
 * 通过工具栏按钮插入（打开世界观选择弹窗），不支持 # 触发。
 */
import { Node, mergeAttributes, type CommandProps } from '@tiptap/core';

/** 世界观引用节点属性 */
export interface WorldviewRefAttrs {
  worldviewId: string;
  label: string;
}

/** 世界观引用节点：行内胶囊 */
export const WorldviewRef = Node.create({
  name: 'worldviewRef',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      worldviewId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-worldview-id') || '',
      },
      label: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-label') || el.textContent || '',
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-worldview-ref]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const { worldviewId, label } = node.attrs as WorldviewRefAttrs;
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-worldview-ref': '',
        'data-worldview-id': worldviewId,
        'data-label': label,
        class: 'worldview-ref',
        contenteditable: 'false',
      }),
      `#${label}`,
    ];
  },

  addCommands() {
    return {
      insertWorldviewRef:
        (attrs: WorldviewRefAttrs) =>
        ({ commands }: CommandProps) => {
          return commands.insertContent({
            type: 'worldviewRef',
            attrs,
          });
        },
    } as never;
  },
});

export default WorldviewRef;
