/**
 * 角色档案详情区
 *
 * 从 CharacterForm.tsx 提取：外貌 / 性格 / 背景 / 成长线（文本视图 + 时间线视图）。
 */
import { Textarea } from '../../components/ui';
import { cn } from '../../utils/cn';
import type { CharacterFormState } from './constants';

interface CharacterProfileSectionProps {
  form: CharacterFormState;
  updateField: <K extends keyof CharacterFormState>(
    key: K,
    value: CharacterFormState[K],
  ) => void;
  arcView: 'text' | 'timeline';
  setArcView: (view: 'text' | 'timeline') => void;
}

export function CharacterProfileSection({
  form,
  updateField,
  arcView,
  setArcView,
}: CharacterProfileSectionProps) {
  return (
    <section>
      <h3 className="mb-3 font-serif text-sm font-semibold tracking-wide text-secondary">
        § 角色档案
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <Textarea
          label="外貌描述"
          name="appearance"
          value={form.appearance}
          onChange={(e) => updateField('appearance', e.target.value)}
          placeholder="身形、面容、衣着、随身之物…"
          rows={4}
        />
        <Textarea
          label="性格"
          name="personality"
          value={form.personality}
          onChange={(e) => updateField('personality', e.target.value)}
          placeholder="性情、脾性、行事作风…"
          rows={4}
        />
        <Textarea
          label="背景"
          name="background"
          value={form.background}
          onChange={(e) => updateField('background', e.target.value)}
          placeholder="出身、经历、重要往事…"
          rows={4}
        />
        <div className="flex flex-col">
          <div className="mb-1.5 flex items-center justify-between">
            <label className="block font-serif text-sm text-foreground">
              成长线
            </label>
            <div className="flex items-center gap-1 rounded-lg border border-border bg-muted p-0.5">
              <button
                type="button"
                onClick={() => setArcView('text')}
                className={cn(
                  'rounded-md px-2 py-0.5 text-xs transition-colors',
                  arcView === 'text'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                文本视图
              </button>
              <button
                type="button"
                onClick={() => setArcView('timeline')}
                className={cn(
                  'rounded-md px-2 py-0.5 text-xs transition-colors',
                  arcView === 'timeline'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                时间线视图
              </button>
            </div>
          </div>
          {arcView === 'text' ? (
            <Textarea
              name="arc"
              value={form.arc}
              onChange={(e) => updateField('arc', e.target.value)}
              placeholder="角色在故事中的转变与成长轨迹…"
              rows={4}
            />
          ) : (
            <div className="rounded border border-border bg-muted px-3 py-3">
              {form.arc.trim() ? (
                <div className="relative pl-6">
                  <div
                    className="absolute left-[7px] top-1 bottom-1 w-px bg-border"
                    aria-hidden="true"
                  />
                  <ul className="space-y-3">
                    {form.arc
                      .split('\n')
                      .map((line) => line.trim())
                      .filter(Boolean)
                      .map((line, idx) => {
                        const match = line.match(/^(.+?)[：:](.+)$/);
                        const timePoint = match ? match[1].trim() : null;
                        const description = match ? match[2].trim() : line;
                        return (
                          <li key={idx} className="relative">
                            <span
                              className={cn(
                                'absolute -left-6 top-1 h-3 w-3 rounded-full border-2 border-primary bg-background',
                              )}
                              aria-hidden="true"
                            />
                            <div className="flex flex-col gap-0.5">
                              {timePoint && (
                                <span className="text-xs font-semibold text-primary">
                                  {timePoint}
                                </span>
                              )}
                              <p className="text-xs leading-relaxed text-foreground">
                                {description}
                              </p>
                            </div>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              ) : (
                <p className="text-xs italic text-muted-foreground">
                  暂无成长线内容，切换到文本视图添加。
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
