/**
 * @jest-environment jsdom
 */
import { renderHook, waitFor } from '@testing-library/react';

import { fetchDiscoverCategories } from '../../infrastructure/discover.client';
import {
  isDiscoverCategoryTreeVisible,
  useDiscoverCategoryNav,
} from './use-discover-category-nav';

jest.mock('../../infrastructure/discover.client', () => ({
  fetchDiscoverCategories: jest.fn(),
}));

const fetchMock = jest.mocked(fetchDiscoverCategories);

const LEVEL = {
  items: [{ name: 'Audio', objects_count: 5, has_children: false }],
  show_other: false,
};
const EMPTY = { items: [], show_other: false };

describe('useDiscoverCategoryNav', () => {
  beforeEach(() => fetchMock.mockReset());

  it('loads the children of the URL lineage with the filters', async () => {
    fetchMock.mockResolvedValue(LEVEL);

    const { result } = renderHook(() =>
      useDiscoverCategoryNav({
        objectType: 'product',
        categoryPath: ['Electronics'],
        q: ' sony ',
        tags: ['Brand:Sony'],
        box: null,
      }),
    );

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current).toEqual({
      status: 'ready',
      items: LEVEL.items,
      navLineage: ['Electronics'],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'product',
      expect.objectContaining({
        categoryPath: ['Electronics'],
        q: 'sony',
        tags: ['Brand:Sony'],
      }),
    );
  });

  it('shows the siblings of a leaf (parent level)', async () => {
    fetchMock.mockImplementation(async (_type, init) =>
      init.categoryPath.length === 2 ? EMPTY : LEVEL,
    );

    const { result } = renderHook(() =>
      useDiscoverCategoryNav({
        objectType: 'product',
        categoryPath: ['Electronics', 'Audio'],
        q: '',
        tags: [],
        box: null,
      }),
    );

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current).toEqual({
      status: 'ready',
      items: LEVEL.items,
      navLineage: ['Electronics'],
    });
  });

  it('reports an error and is idle without a category type', async () => {
    fetchMock.mockResolvedValue(null);
    const failing = renderHook(() =>
      useDiscoverCategoryNav({
        objectType: 'product',
        categoryPath: [],
        q: '',
        tags: [],
        box: null,
      }),
    );
    await waitFor(() => expect(failing.result.current.status).toBe('error'));

    fetchMock.mockClear();
    const idle = renderHook(() =>
      useDiscoverCategoryNav({
        objectType: null,
        categoryPath: [],
        q: '',
        tags: [],
        box: null,
      }),
    );
    await waitFor(() =>
      expect(idle.result.current).toEqual({
        status: 'ready',
        items: [],
        navLineage: [],
      }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the tree frame on reload only after a tree of the same type', async () => {
    fetchMock.mockResolvedValue(LEVEL);
    const params = {
      objectType: 'product',
      categoryPath: [] as string[],
      q: '',
      tags: [] as string[],
      box: null,
    };
    const { result, rerender } = renderHook(
      (p: typeof params) => useDiscoverCategoryNav(p),
      {
        initialProps: params,
      },
    );
    expect(result.current).toEqual({ status: 'loading', treeKnown: false });
    await waitFor(() => expect(result.current.status).toBe('ready'));

    fetchMock.mockResolvedValue(EMPTY);
    rerender({ ...params, q: 'sony' });
    expect(result.current).toEqual({ status: 'loading', treeKnown: true });
    await waitFor(() => expect(result.current.status).toBe('ready'));

    rerender({ ...params, q: 'sonya' });
    expect(result.current).toEqual({ status: 'loading', treeKnown: false });
    await waitFor(() => expect(result.current.status).toBe('ready'));

    fetchMock.mockResolvedValue(LEVEL);
    rerender({ ...params, q: '' });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    rerender({ ...params, objectType: 'book' });
    expect(result.current).toEqual({ status: 'loading', treeKnown: false });
    await waitFor(() => expect(result.current.status).toBe('ready'));
  });
});

describe('isDiscoverCategoryTreeVisible', () => {
  it('waits for the answer at the root of a type not yet known to have categories', () => {
    expect(
      isDiscoverCategoryTreeVisible(
        { status: 'loading', treeKnown: false },
        [],
      ),
    ).toBe(false);
    expect(
      isDiscoverCategoryTreeVisible({ status: 'error', treeKnown: false }, []),
    ).toBe(false);
    expect(
      isDiscoverCategoryTreeVisible(
        { status: 'ready', items: [], navLineage: [] },
        [],
      ),
    ).toBe(false);
    expect(
      isDiscoverCategoryTreeVisible(
        { status: 'ready', items: LEVEL.items, navLineage: [] },
        [],
      ),
    ).toBe(true);
  });

  it('keeps the tree while reloading a known tree or inside a category', () => {
    expect(
      isDiscoverCategoryTreeVisible({ status: 'loading', treeKnown: true }, []),
    ).toBe(true);
    expect(
      isDiscoverCategoryTreeVisible({ status: 'loading', treeKnown: false }, [
        'Audio',
      ]),
    ).toBe(true);
  });
});
