export interface SlashCommand {
  id: string;
  label: string;
  description: string;
  apply: (arg: string) => string;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'summarize',
    label: '/summarize',
    description: 'Сделать краткое резюме',
    apply: (arg) =>
      `Сделай краткое резюме следующего текста: выдели главные идеи, ключевые тезисы и вывод.\n\n${arg}`,
  },
  {
    id: 'translate',
    label: '/translate',
    description: 'Перевести на английский',
    apply: (arg) =>
      `Переведи следующий текст на английский язык. Сохраняй стиль, тон и форматирование.\n\n${arg}`,
  },
  {
    id: 'explain',
    label: '/explain',
    description: 'Объяснить простыми словами',
    apply: (arg) =>
      `Объясни простыми словами, как будто я не специалист. Приведи аналогии и примеры.\n\n${arg}`,
  },
  {
    id: 'code',
    label: '/code',
    description: 'Написать рабочий код',
    apply: (arg) =>
      `Напиши готовый рабочий код для следующей задачи. Используй современные практики, добавь короткое объяснение к коду и примеры запуска.\n\n${arg}`,
  },
  {
    id: 'improve',
    label: '/improve',
    description: 'Улучшить текст',
    apply: (arg) =>
      `Улучши этот текст: сделай яснее, убери воду, исправь ошибки. Не меняй смысл, сохраняй стиль автора.\n\n${arg}`,
  },
  {
    id: 'eli5',
    label: '/eli5',
    description: 'Объяснить как ребёнку',
    apply: (arg) =>
      `Объясни как пятилетнему ребёнку, простыми словами и с примерами из повседневной жизни.\n\n${arg}`,
  },
];
