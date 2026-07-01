/**
 * EmptyHint 空提示
 *
 * 从 src/features/editor/SettingSidebar.tsx 提取。
 * 用于设定列表为空时的占位提示。
 */
export function EmptyHint({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
      <p className="text-xs text-muted-foreground">{text}</p>
    </div>
  );
}

export default EmptyHint;
