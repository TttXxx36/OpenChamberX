import type { I18nKey } from '@/lib/i18n'

type RightSidebarToggleKey = Extract<
  I18nKey,
  'layout.rightSidebar.actions.open' | 'layout.rightSidebar.actions.close'
>

type Translate = (key: RightSidebarToggleKey) => string

export const getRightSidebarToggleLabel = (isOpen: boolean | undefined, t: Translate): string => {
  return isOpen ? t('layout.rightSidebar.actions.close') : t('layout.rightSidebar.actions.open')
}
