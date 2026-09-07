import type { EmailMessage } from '../../types/email';
import type { CategoryId } from '../../types/category';

export type CategoryRule = (message: EmailMessage) => CategoryId | undefined;
