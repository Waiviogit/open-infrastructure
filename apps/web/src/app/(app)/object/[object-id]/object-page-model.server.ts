import { cache } from 'react';

import type { ObjectHeroIdentity, ObjectPageViewModel } from '@/modules/object';
import { fetchObjectHead } from '@/modules/object/infrastructure/fetch-object-head.server';
import { fetchObjectOptions } from '@/modules/object/infrastructure/fetch-object-options.server';
import { fetchProjectedObjectWithCounts } from '@/modules/object/infrastructure/fetch-object-resolve.server';
import { projectedObjectWithCountsToPageModel } from '@/modules/object/infrastructure/projected-object-to-page-model';
import { DEMO_OBJECT_IDS, mockModelFromDemoPreset } from './object-page-demo-data';

/** Hero fields only — cheap, viewer-independent; painted before {@link loadObjectPageModel}. */
export const loadObjectHead = cache(
  async (objectId: string, locale: string): Promise<ObjectHeroIdentity | null> =>
    fetchObjectHead(objectId, { locale }),
);

export const loadObjectPageModel = cache(
  async (
    objectId: string,
    locale: string,
    viewer: string | null,
  ): Promise<ObjectPageViewModel | null> => {
    const [api, optionsApi] = await Promise.all([
      fetchProjectedObjectWithCounts(objectId, { locale, viewer }),
      fetchObjectOptions(objectId, { locale, viewer }),
    ]);
    if (api) {
      return projectedObjectWithCountsToPageModel(api, optionsApi);
    }

    if (DEMO_OBJECT_IDS.has(objectId)) {
      return mockModelFromDemoPreset(objectId);
    }

    return null;
  },
);
