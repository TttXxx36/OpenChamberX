import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Icon } from '@/components/icon/Icon';
import { useUIStore } from '@/stores/useUIStore';
import type { LayoutPreset } from '@/stores/useUIStore';

const DEFAULT_PRESET_NAMES = new Set(['Full', 'Minimal', 'Review']);

const PRESET_LABELS: Record<string, string> = {
  'Full': '完整',
  'Minimal': '极简',
  'Review': '审查',
};

export const LayoutPage: React.FC = () => {
  const layoutPresets = useUIStore((state) => state.layoutPresets);
  const saveCurrentLayoutPreset = useUIStore((state) => state.saveCurrentLayoutPreset);
  const loadLayoutPreset = useUIStore((state) => state.loadLayoutPreset);
  const deleteLayoutPreset = useUIStore((state) => state.deleteLayoutPreset);
  const isStatusBarVisible = useUIStore((state) => state.isStatusBarVisible);
  const setStatusBarVisible = useUIStore((state) => state.setStatusBarVisible);
  const [inputName, setInputName] = React.useState('');

  const handleSave = React.useCallback(() => {
    const trimmed = inputName.trim();
    if (!trimmed) return;
    saveCurrentLayoutPreset(trimmed);
    setInputName('');
  }, [inputName, saveCurrentLayoutPreset]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSave();
      }
    },
    [handleSave]
  );

  const isDefaultPreset = React.useCallback((name: string) => DEFAULT_PRESET_NAMES.has(name), []);

  return (
    <div>
      <div className="mb-1 px-1">
        <h3 className="typography-ui-header font-medium text-foreground">
          布局预设
        </h3>
        <p className="typography-meta text-muted-foreground mt-1">
          保存和恢复面板布局配置。
        </p>
      </div>

      {/* Status bar visibility toggle */}
      <section className="px-2 pb-4">
        <div className="flex items-center justify-between rounded-md border border-border bg-[var(--surface-elevated)] px-3 py-2">
          <span className="typography-ui-label text-foreground">显示状态栏</span>
          <Switch
            checked={isStatusBarVisible}
            onCheckedChange={setStatusBarVisible}
            aria-label="切换状态栏可见性"
          />
        </div>
      </section>

      {/* Save current layout */}
      <section className="px-2 pb-4 pt-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={inputName}
            onChange={(e) => setInputName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="预设名称…"
            aria-label="布局预设名称"
            className="w-full sm:w-64"
          />
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={handleSave}
            disabled={!inputName.trim()}
            className="!font-normal"
          >
            <Icon name="save-3" className="h-3.5 w-3.5 mr-1" />
            保存当前布局
          </Button>
        </div>
      </section>

      {/* Presets list */}
      <section className="px-2 space-y-1">
        {layoutPresets.map((preset) => (
          <PresetRow
            key={preset.name}
            preset={preset}
            isDefault={isDefaultPreset(preset.name)}
            onLoad={loadLayoutPreset}
            onDelete={deleteLayoutPreset}
          />
        ))}
        {layoutPresets.length === 0 && (
          <p className="typography-meta text-muted-foreground py-4 text-center">
            暂无已保存的预设。在上方输入名称并点击"保存当前布局"。
          </p>
        )}
      </section>
    </div>
  );
};

interface PresetRowProps {
  preset: LayoutPreset;
  isDefault: boolean;
  onLoad: (name: string) => void;
  onDelete: (name: string) => void;
}

const PresetRow: React.FC<PresetRowProps> = ({ preset, isDefault, onLoad, onDelete }) => {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-[var(--surface-elevated)] px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <Icon name="layout-column" className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="typography-ui-label text-foreground truncate">{PRESET_LABELS[preset.name] || preset.name}</span>
        {isDefault && (
          <span className="typography-micro px-1 rounded leading-none pb-px text-[var(--status-muted)] bg-[var(--surface-dim)] shrink-0">
            默认
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={() => onLoad(preset.name)}
          className="!font-normal"
        >
          加载
        </Button>
        {!isDefault && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => onDelete(preset.name)}
            className="!font-normal text-muted-foreground hover:text-foreground"
            aria-label={`删除预设"${preset.name}"`}
          >
            <Icon name="delete-bin" className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
};
