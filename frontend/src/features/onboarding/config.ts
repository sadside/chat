export interface TourStep {
  id: string;
  anchor: string; // CSS selector
  title: string;
  body: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'composer',
    anchor: '[data-tour="composer"]',
    title: 'Composer',
    body: 'Пиши сообщение здесь. Поддерживается Markdown, формулы LaTeX и слэш-команды — попробуй «/».',
  },
  {
    id: 'model',
    anchor: '[data-tour="model-picker"]',
    title: 'Модель',
    body: 'Переключай локальную LLM на лету. Выбор сохраняется в браузере.',
  },
  {
    id: 'sidebar',
    anchor: '[data-tour="sidebar"]',
    title: 'Сайдбар',
    body: 'История чатов с поиском, закреплённые сверху. Меню чата — три точки справа.',
  },
  {
    id: 'palette',
    anchor: '[data-tour="composer"]',
    title: '⌘K — палитра команд',
    body: 'Самый быстрый способ всё сделать: новый чат, смена темы, статистика, переключение модели. Открой ⌘K (Ctrl+K) в любой момент.',
  },
  {
    id: 'search',
    anchor: '[data-tour="composer"]',
    title: '⌘F — глобальный поиск',
    body: 'Найди любое сообщение во всех своих чатах. Клик по результату — перенесёт к нему.',
  },
];

export const ONBOARDING_KEY = 'nova-onboarded';
