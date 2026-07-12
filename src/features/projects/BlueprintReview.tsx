import { useState } from 'react';
import {
  BookOpen,
  Eye,
  GitBranch,
  Lightbulb,
  MapPin,
  Milestone,
  ScrollText,
  Trash2,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { ProjectBlueprintResult } from '../../types/ai';
import { cn } from '../../utils/cn';
import type { BlueprintSectionKey } from './blueprintUtils';

interface BlueprintSection {
  key: BlueprintSectionKey;
  label: string;
  icon: LucideIcon;
}

const SECTIONS: BlueprintSection[] = [
  { key: 'chapters', label: '章节', icon: BookOpen },
  { key: 'characters', label: '角色', icon: Users },
  { key: 'scenes', label: '场景', icon: MapPin },
  { key: 'plotLines', label: '剧情线', icon: GitBranch },
  { key: 'plotPoints', label: '剧情节点', icon: Milestone },
  { key: 'worldview', label: '世界观', icon: ScrollText },
  { key: 'foreshadowing', label: '伏笔', icon: Eye },
  { key: 'inspirations', label: '灵感', icon: Lightbulb },
];

interface BlueprintReviewProps {
  blueprint: ProjectBlueprintResult;
  bookTitle: string;
  onRemove: (section: BlueprintSectionKey, index: number) => void;
}

function itemTitle(section: BlueprintSectionKey, item: Record<string, unknown>): string {
  if (section === 'characters' || section === 'scenes') return String(item.name ?? '未命名');
  return String(item.title ?? '未命名');
}

function itemDescription(section: BlueprintSectionKey, item: Record<string, unknown>): string {
  if (section === 'chapters') return String(item.summary ?? item.outline ?? '');
  if (section === 'plotLines') return String(item.synopsis ?? '');
  if (section === 'inspirations') return String(item.content ?? '');
  if (section === 'worldview') return String(item.content ?? '');
  if (section === 'characters') return String(item.arc ?? item.personality ?? '');
  return String(item.description ?? '');
}

export function BlueprintReview({ blueprint, bookTitle, onRemove }: BlueprintReviewProps) {
  const [activeSection, setActiveSection] = useState<BlueprintSectionKey>('chapters');
  const active = SECTIONS.find((section) => section.key === activeSection) ?? SECTIONS[0];
  const items = blueprint[active.key] as Array<Record<string, unknown>>;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="font-serif text-lg font-semibold text-foreground">蓝图预览</h3>
        <p className="mt-1 font-sans text-sm text-muted-foreground">{bookTitle}</p>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border pb-2" role="tablist" aria-label="蓝图分类">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          const activeTab = active.key === section.key;
          return (
            <button
              key={section.key}
              type="button"
              role="tab"
              aria-selected={activeTab}
              onClick={() => setActiveSection(section.key)}
              className={cn(
                'flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 font-sans text-xs transition-colors',
                activeTab
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {section.label}
              <span className={cn('tabular-nums', activeTab ? 'text-primary-foreground/75' : 'text-muted-foreground')}>
                {blueprint[section.key].length}
              </span>
            </button>
          );
        })}
      </div>

      <div className="min-h-64 max-h-[45vh] overflow-y-auto border-y border-border">
        {items.length === 0 ? (
          <div className="flex min-h-40 items-center justify-center font-sans text-sm text-muted-foreground">
            此分类暂无保留内容
          </div>
        ) : (
          items.map((item, index) => {
            const title = itemTitle(active.key, item);
            const description = itemDescription(active.key, item);
            return (
              <div key={`${title}-${index}`} className="flex items-start gap-3 border-b border-border px-1 py-3 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-serif text-sm font-medium text-foreground">{title}</p>
                  {description && (
                    <p className="mt-1 line-clamp-2 font-sans text-xs leading-5 text-muted-foreground">
                      {description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(active.key, index)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  aria-label={`移除 ${title}`}
                  title={`移除 ${title}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
