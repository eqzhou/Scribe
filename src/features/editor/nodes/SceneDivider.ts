/**
 * SceneDivider 场景分隔符节点
 *
 * 原子块节点（atom + group: 'block'），渲染为居中的「§ § §」分隔符。
 * 不可编辑内容，作为一个整体被选中与删除。
 * 快捷键 Ctrl/Cmd + Enter 插入。
 */
import { Node, mergeAttributes, type CommandProps } from '@tiptap/core';

/** 场景分隔符节点：居中显示 § § § */
export const SceneDivider = Node.create({
  name: 'sceneDivider',
  group: 'block',
  atom: true,

  parseHTML() {
    return [{ tag: 'div[data-scene-divider]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-scene-divider': '',
        class: 'scene-divider',
        contenteditable: 'false',
      }),
      '§ § §',
    ];
  },

  addCommands() {
    return {
      insertSceneDivider:
        () =>
        ({ commands }: CommandProps) => {
          return commands.insertContent({
            type: 'sceneDivider',
          });
        },
    } as never;
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Enter': () => {
        return this.editor.commands.insertContent({
          type: 'sceneDivider',
        });
      },
    };
  },
});

export default SceneDivider;
