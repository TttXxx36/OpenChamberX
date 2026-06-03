import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Icon } from '@/components/icon/Icon';
import { useUIStore } from '@/stores/useUIStore';
import { useI18n } from '@/lib/i18n';
import type { LayoutPreset } from '@/stores/useUIStore';

const DEFAULT_PRESET_NAMES = new Set(['Full', 'Minimal', 'Review']);

export const LayoutPage: React.FC = () => {
  const { t } = useI18n();
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
          {t('layout.presets.title')}
        </h3>
        <p className="typography-meta text-muted-foreground mt-1">
          {t('layout.presets.description')}
        </p>
      </div>

      {/* Status bar visibility toggle */}
      <section className="px-2 pb-4">
        <div className="flex items-center justify-between rounded-md border border-border bg-[var(--surface-elevated)] px-3 py-2">
          <span className="typography-ui-label text-foreground">{t('layout.presets.showStatusBar')}</span>
          <Switch
            checked={isStatusBarVisible}
            onCheckedChange={setStatusBarVisible}
            aria-label={t('layout.presets.showStatusBarAria')}
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
            placeholder={t('layout.presets.presetNamePlaceholder')}
            aria-label={t('layout.presets.title')}
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
            {t('layout.presets.saveCurrentLayout')}
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
            {t('layout.presets.empty')}
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
  const { t } = useI18n();

  const presetLabel = isDefault
    ? ({ Full: t('layout.presets.presetFull'), Minimal: t('layout.presets.presetMinimal'), Review: t('layout.presets.presetReview') })[preset.name]
    : preset.name;

  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-[var(--surface-elevated)] px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <Icon name="layout-column" className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="typography-ui-label text-foreground truncate">{presetLabel}</span>
        {isDefault && (
          <span className="typography-micro px-1 rounded leading-none pb-px text-[var(--status-muted)] bg-[var(--surface-dim)] shrink-0">
            {t('layout.presets.default')}
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
          {t('layout.presets.load')}
        </Button>
        {!isDefault && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => onDelete(preset.name)}
            className="!font-normal text-muted-foreground hover:text-foreground"
            aria-label={t('layout.presets.deleteAria', { name: preset.name })}
          >
            <Icon name="delete-bin" className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
};
