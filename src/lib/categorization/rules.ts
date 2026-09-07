import type { CategoryRule } from './types';

const GMAIL_LABEL_TO_CATEGORY: Record<string, ReturnType<CategoryRule>> = {
  CATEGORY_PROMOTIONS: 'promotions',
  CATEGORY_SOCIAL: 'social',
  CATEGORY_UPDATES: 'updates',
  CATEGORY_FORUMS: 'updates',
  CATEGORY_PERSONAL: 'personal',
};

const gmailCategoryLabelRule: CategoryRule = (message) => {
  for (const label of message.labels) {
    const mapped = GMAIL_LABEL_TO_CATEGORY[label];
    if (mapped) return mapped;
  }
  return undefined;
};

const FINANCE_KEYWORDS = /\b(invoice|statement|payment|receipt|billing|balance due|payroll|tax)\b/i;
const FINANCE_DOMAINS = /(paypal|stripe|chase|bankofamerica|wellsfargo|citibank|venmo|quickbooks)\./i;

const financeRule: CategoryRule = (message) => {
  if (FINANCE_DOMAINS.test(message.senderEmail) || FINANCE_KEYWORDS.test(message.subject)) {
    return 'finance';
  }
  return undefined;
};

const SHOPPING_KEYWORDS = /\b(order|shipped|delivery|tracking|out for delivery|delivered)\b/i;
const SHOPPING_DOMAINS = /(amazon|ebay|etsy|shopify|walmart|target|bestbuy)\./i;

const shoppingRule: CategoryRule = (message) => {
  if (SHOPPING_DOMAINS.test(message.senderEmail) || SHOPPING_KEYWORDS.test(message.subject)) {
    return 'shopping';
  }
  return undefined;
};

const MARKETING_KEYWORDS =
  /\b(sale|% off|discount|deal|promo|limited time|clearance|coupon|exclusive offer)\b/i;

const marketingKeywordRule: CategoryRule = (message) => {
  if (MARKETING_KEYWORDS.test(message.subject)) return 'promotions';
  return undefined;
};

/** A List-Unsubscribe header without any stronger signal (finance/shopping/gmail category)
 *  is a strong newsletter indicator. */
const listUnsubscribeRule: CategoryRule = (message) => {
  if (message.hasListUnsubscribe) return 'newsletters';
  return undefined;
};

const SPAM_LIKE_SENDER_PATTERN = /^(noreply|no-reply|donotreply|do-not-reply|marketing|bulk)@/i;

const spamLikeSenderRule: CategoryRule = (message) => {
  if (SPAM_LIKE_SENDER_PATTERN.test(message.senderEmail) && !message.hasListUnsubscribe) {
    return 'spam_like';
  }
  return undefined;
};

/** Ordered rule chain — first match wins. */
export const CATEGORY_RULES: CategoryRule[] = [
  gmailCategoryLabelRule,
  financeRule,
  shoppingRule,
  marketingKeywordRule,
  listUnsubscribeRule,
  spamLikeSenderRule,
];
