import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';
import { getSafeStorage } from './utils/safeStorage';

const EMPTY_TEMPLATES = {
  completion: { title: '', message: '' },
  error: { title: '', message: '' },
  question: { title: '', message: '' },
  subtask: { title: '', message: '' },
} as const;

export interface NotificationStore {
  nativeNotificationsEnabled: boolean;
  notificationMode: 'always' | 'hidden-only';
  notifyOnSubtasks: boolean;
  notifyOnCompletion: boolean;
  notifyOnError: boolean;
  notifyOnQuestion: boolean;
  notificationTemplates: {
    completion: { title: string; message: string };
    error: { title: string; message: string };
    question: { title: string; message: string };
    subtask: { title: string; message: string };
  };
  summarizeLastMessage: boolean;
  summaryThreshold: number;
  summaryLength: number;
  maxLastMessageLength: number;
  showOpenCodeUpdateNotifications: boolean;

  setNativeNotificationsEnabled: (value: boolean) => void;
  setNotificationMode: (mode: 'always' | 'hidden-only') => void;
  setNotifyOnSubtasks: (value: boolean) => void;
  setNotifyOnCompletion: (value: boolean) => void;
  setNotifyOnError: (value: boolean) => void;
  setNotifyOnQuestion: (value: boolean) => void;
  setNotificationTemplates: (templates: NotificationStore['notificationTemplates']) => void;
  setSummarizeLastMessage: (value: boolean) => void;
  setSummaryThreshold: (value: number) => void;
  setSummaryLength: (value: number) => void;
  setMaxLastMessageLength: (value: number) => void;
  setShowOpenCodeUpdateNotifications: (value: boolean) => void;
}

export const useNotificationStore = create<NotificationStore>()(
  devtools(
    persist(
      (set) => ({
        nativeNotificationsEnabled: false,
        notificationMode: 'hidden-only',
        notifyOnSubtasks: true,
        notifyOnCompletion: true,
        notifyOnError: true,
        notifyOnQuestion: true,
        notificationTemplates: {
          completion: { ...EMPTY_TEMPLATES.completion },
          error: { ...EMPTY_TEMPLATES.error },
          question: { ...EMPTY_TEMPLATES.question },
          subtask: { ...EMPTY_TEMPLATES.subtask },
        },
        summarizeLastMessage: false,
        summaryThreshold: 200,
        summaryLength: 100,
        maxLastMessageLength: 250,
        showOpenCodeUpdateNotifications: true,

        setNativeNotificationsEnabled: (value) => set({ nativeNotificationsEnabled: value }),
        setNotificationMode: (mode) => set({ notificationMode: mode }),
        setNotifyOnSubtasks: (value) => set({ notifyOnSubtasks: value }),
        setNotifyOnCompletion: (value) => set({ notifyOnCompletion: value }),
        setNotifyOnError: (value) => set({ notifyOnError: value }),
        setNotifyOnQuestion: (value) => set({ notifyOnQuestion: value }),
        setNotificationTemplates: (templates) => set({ notificationTemplates: templates }),
        setSummarizeLastMessage: (value) => set({ summarizeLastMessage: value }),
        setSummaryThreshold: (value) => set({ summaryThreshold: value }),
        setSummaryLength: (value) => set({ summaryLength: value }),
        setMaxLastMessageLength: (value) => set({ maxLastMessageLength: value }),
        setShowOpenCodeUpdateNotifications: (value) => set({ showOpenCodeUpdateNotifications: value }),
      }),
      {
        name: 'openchamber-notifications',
        storage: createJSONStorage(() => getSafeStorage()),
        version: 1,
      },
    ),
    { name: 'notification-store' },
  ),
);
