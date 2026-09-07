export type CategoryId =
  | 'promotions'
  | 'newsletters'
  | 'social'
  | 'updates'
  | 'finance'
  | 'work'
  | 'personal'
  | 'shopping'
  | 'spam_like'
  | 'other';

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  promotions: 'Promotions',
  newsletters: 'Newsletters',
  social: 'Social',
  updates: 'Updates',
  finance: 'Finance',
  work: 'Work',
  personal: 'Personal',
  shopping: 'Shopping',
  spam_like: 'Spam-like',
  other: 'Other',
};
