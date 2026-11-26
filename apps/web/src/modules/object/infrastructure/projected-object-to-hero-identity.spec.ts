import type { ObjectHeroIdentity } from '../domain/object-page.types';
import type { ProjectedObjectWithCountsView } from './object-resolve.types';
import {
  projectedObjectToHeroIdentity,
  projectedObjectWithCountsToPageModel,
} from './projected-object-to-page-model';

const COUNTS = {
  followers_count: 3,
  experts_count: 2,
  posts_count: 4,
  updates_count: 9,
  favorited_by_count: 0,
  supervised_count: 0,
  exclusive_count: 0,
  isFavorited: true,
  hasSupervisedOwnership: false,
  hasExclusiveOwnership: false,
  is_following: true,
  viewer_bell: false,
  update_type_counts: {},
  update_locales: [],
};

const HERO_KEYS: (keyof ObjectHeroIdentity)[] = [
  'objectId',
  'title',
  'subtitleTitle',
  'avatarUrl',
  'coverImageUrl',
  'kindLabel',
  'lifecycleStatus',
  'displayWeightLabel',
  'objectTypeKey',
  'showInstacartButton',
  'previewGallery',
  'galleryAlbums',
];

function heroOfFullModel(api: ProjectedObjectWithCountsView): ObjectHeroIdentity {
  const model = projectedObjectWithCountsToPageModel(api);
  return Object.fromEntries(HERO_KEYS.map((key) => [key, model[key]])) as ObjectHeroIdentity;
}

const AVATAR = { url: 'https://img/hive.png', rankScore: null, isAvatar: true };

describe('projectedObjectToHeroIdentity', () => {
  it.each<[string, ProjectedObjectWithCountsView, Record<string, unknown>]>([
    [
      'hashtag with avatar and name',
      {
        object_id: 'hive',
        object_type: 'hashtag',
        semantic_type: null,
        status: 'active',
        weight: 508924.73,
        fields: { name: 'Hive', image: AVATAR.url, description: 'only in the full model' },
        previewGallery: [AVATAR],
        galleryAlbums: [{ name: 'Photos', items: [AVATAR] }],
        ...COUNTS,
      },
      { name: 'Hive', image: AVATAR.url },
    ],
    [
      'closed restaurant with cover and subtitle',
      {
        object_id: 'taverna',
        object_type: 'restaurant',
        semantic_type: 'schema:Restaurant',
        status: 'closed',
        weight: null,
        fields: {
          name: 'Taverna',
          title: 'Greek food',
          imageBackground: 'https://img/cover.jpg',
          tagCategoryItem: [{ category: 'Cuisine', value: 'Greek' }],
        },
        previewGallery: [],
        galleryAlbums: [],
        ...COUNTS,
      },
      { name: 'Taverna', title: 'Greek food', imageBackground: 'https://img/cover.jpg' },
    ],
    [
      'recipe with an Instacart identifier and no name',
      {
        object_id: 'soup-1',
        object_type: 'recipe',
        semantic_type: null,
        weight: 1,
        fields: { identifier: [{ type: 'instacart', value: 'x' }] },
        previewGallery: [],
        galleryAlbums: [],
        ...COUNTS,
      },
      { identifier: [{ type: 'instacart', value: 'x' }] },
    ],
  ])('paints the same hero from the head as the full model: %s', (_name, full, headFields) => {
    const head = {
      object_id: full.object_id,
      object_type: full.object_type,
      semantic_type: full.semantic_type,
      status: full.status,
      weight: full.weight,
      fields: headFields,
      previewGallery: full.previewGallery,
      galleryAlbums: full.galleryAlbums,
      isFavorited: false,
      hasSupervisedOwnership: false,
      hasExclusiveOwnership: false,
    };

    expect(projectedObjectToHeroIdentity(head)).toEqual(heroOfFullModel(full));
  });

  it('falls back to the object id and active status', () => {
    const hero = projectedObjectToHeroIdentity({
      object_id: 'bare',
      object_type: 'hashtag',
      semantic_type: null,
      fields: {},
      isFavorited: false,
      hasSupervisedOwnership: false,
      hasExclusiveOwnership: false,
    });

    expect(hero).toMatchObject({
      title: 'bare',
      avatarUrl: null,
      coverImageUrl: null,
      lifecycleStatus: 'active',
      displayWeightLabel: null,
      showInstacartButton: false,
    });
  });
});
