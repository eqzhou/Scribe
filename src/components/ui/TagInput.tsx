/**
 * 通用标签输入组件
 *
 * 从 CharacterForm 和 EntryEditor 中提取的公共标签管理模式：
 * 回车添加标签 + X 删除标签 + 自动去重。
 */
import { useState } from 'react';
import { X } from 'lucide-react';
import { Tag } from './Tag';
import { cn } from '../../utils/cn';

export interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  label?: string;
}

export function TagInput({ tags, onChange, placeholder, label = '标签' }: TagInputProps) {
  const [input, setInput] = useState('');

  const handleAdd = (): void => {
    const trimmed = input.trim();
    if (!trimmed || tags.includes(trimmed)) {
      setInput('');
      return;
    }
    onChange([...tags, trimmed]);
    setInput('');
  };

  const handleRemove = (tag: string): void => {
    onChange(tags.filter((t) => t !== tag));
  };

  return (
    <section>
      <label className="mb-1.5 block font-serif text-sm text-foreground">
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-2 rounded border border-border bg-muted px-2 py-2">
        {tags.map((tag) => (
          <Tag key={tag} variant="secondary" size="sm">
            <span className="inline-flex items-center gap-1">
              {tag}
              <button
                type="button"
                onClick={() => handleRemove(tag)}
                className="text-secondary transition-colors hover:text-primary"
                aria-label={`删除标签 ${tag}`}
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          </Tag>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder={placeholder ?? (tags.length === 0 ? '输入标签后回车添加' : '继续添加…')}
          className={cn(
            'min-w-[120px] flex-1 bg-transparent px-1 py-0.5',
            'font-serif text-sm text-foreground',
            'placeholder:text-muted-foreground focus:outline-none',
          )}
        />
      </div>
    </section>
  );
}
