import { cache } from 'react';

import { fetchObjectActivityMessage } from '../../infrastructure/messaging.client';
import type { MessageItem } from '../../domain/messaging.types';

/** One activity message for its permalink page; shared by `generateMetadata` and the page body. */
export const getObjectActivityMessageQuery = cache(
  async (
    objectId: string,
    messageId: string,
    viewer?: string | null,
  ): Promise<MessageItem | null> => fetchObjectActivityMessage(objectId, messageId, viewer),
);
