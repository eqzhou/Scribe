/**
 * CharacterMention 角色提及节点
 *
 * 行内原子节点（inline + atom），携带 characterId 与 label 属性。
 * 渲染为带朱砂红背景的胶囊标签，不可编辑内容。
 * 通过工具栏按钮插入（打开角色选择弹窗），不支持 @ 触发（避免依赖 suggestion 扩展）。
 */
import { Node, mergeAttributes, type CommandProps } from '@tiptap/core';

/** 角色提及节点属性 */
export interface CharacterMentionAttrs {
  characterId: string;
  label: string;
}

/** 角色提及节点：行内胶囊，点击跳转到角色详情 */
export const CharacterMention = Node.create({
  name: 'characterMention',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      characterId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-character-id') || '',
      },
      label: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-label') || el.textContent || '',
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-character-mention]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const { characterId, label } = node.attrs as CharacterMentionAttrs;
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-character-mention': '',
        'data-character-id': characterId,
        'data-label': label,
        class: 'character-mention',
        contenteditable: 'false',
      }),
      `@${label}`,
    ];
  },

  addCommands() {
    return {
      insertCharacterMention:
        (attrs: CharacterMentionAttrs) =>
        ({ commands }: CommandProps) => {
          return commands.insertContent({
            type: 'characterMention',
            attrs,
          });
        },
    } as never;
  },
});

export default CharacterMention;
