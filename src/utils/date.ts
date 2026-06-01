import { formatISO, subDays, parseISO } from 'date-fns';

export const toDateStr = (date: Date): string =>
  formatISO(date, { representation: 'date' });

export const yesterday = (dateStr: string): string =>
  toDateStr(subDays(parseISO(dateStr), 1));
