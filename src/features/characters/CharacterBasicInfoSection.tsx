/**
 * 角色基本信息区
 *
 * 从 CharacterForm.tsx 提取：姓名 / 别名 / 阵营 / 角色类型 / 生日 / 年龄 / 头像主题色。
 */
import { Input } from '../../components/ui';
import { cn } from '../../utils/cn';
import type { CharacterRole } from '../../types';
import {
  COLOR_PRESETS,
  ROLE_OPTIONS,
  type CharacterFormState,
} from './constants';

interface CharacterBasicInfoSectionProps {
  form: CharacterFormState;
  updateField: <K extends keyof CharacterFormState>(
    key: K,
    value: CharacterFormState[K],
  ) => void;
}

export function CharacterBasicInfoSection({
  form,
  updateField,
}: CharacterBasicInfoSectionProps) {
  return (
    <section>
      <h3 className="mb-3 font-serif text-sm font-semibold tracking-wide text-secondary">
        § 基本信息
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="姓名"
          name="name"
          value={form.name}
          onChange={(e) => updateField('name', e.target.value)}
          placeholder="如：沈云舟"
          maxLength={30}
          required
        />
        <Input
          label="别名 / 称号"
          name="alias"
          value={form.alias}
          onChange={(e) => updateField('alias', e.target.value)}
          placeholder="如：孤剑客"
          maxLength={30}
        />
        <Input
          label="阵营"
          name="faction"
          value={form.faction}
          onChange={(e) => updateField('faction', e.target.value)}
          placeholder="如：听雨楼"
          maxLength={30}
        />
        {/* 角色类型 select */}
        <div className="flex flex-col">
          <label className="mb-1.5 block font-serif text-sm text-foreground">
            角色类型
          </label>
          <select
            value={form.role}
            onChange={(e) =>
              updateField('role', e.target.value as CharacterRole)
            }
            className={cn(
              'w-full rounded border border-border bg-muted px-3 py-2',
              'font-serif text-sm text-foreground',
              'transition-all duration-200',
              'focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/25',
            )}
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <Input
          label="生日"
          name="birthday"
          type="date"
          value={form.birthday}
          onChange={(e) => updateField('birthday', e.target.value)}
        />
        <Input
          label="年龄"
          name="age"
          type="number"
          min={0}
          value={form.age}
          onChange={(e) => updateField('age', e.target.value)}
          placeholder="如：24"
        />
        {/* 头像主题色选择器 */}
        <div className="col-span-2 flex flex-col">
          <label className="mb-1.5 block font-serif text-sm text-foreground">
            头像主题色
          </label>
          <div className="flex items-center gap-2.5">
            {COLOR_PRESETS.map((color) => {
              const selected = form.appearanceColor === color;
              return (
                <button
                  key={color}
                  type="button"
                  onClick={() => updateField('appearanceColor', color)}
                  title={color}
                  aria-label={`选择主题色 ${color}`}
                  aria-pressed={selected}
                  className={cn(
                    'h-8 w-8 rounded-full border-2 transition-all duration-200',
                    selected
                      ? 'scale-110 border-foreground shadow-soft'
                      : 'border-border hover:scale-105 hover:border-secondary',
                  )}
                  style={{ backgroundColor: color }}
                />
              );
            })}
            <span className="ml-1 font-mono text-[11px] text-muted-foreground">
              {form.appearanceColor}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
