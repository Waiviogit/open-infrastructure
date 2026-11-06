/**
 * @jest-environment jsdom
 */
import {
  beginScrollRestore,
  historyStateWithoutSavedScroll,
  isScrollRestorePending,
  readSavedScrollY,
  rememberScrollForCurrentEntry,
  resetScrollRestoreForTests,
  scrollToTopNow,
} from './scroll-memory';

describe('scroll-memory', () => {
  const replaceState = jest.fn();

  beforeEach(() => {
    resetScrollRestoreForTests();
    replaceState.mockClear();
    Object.defineProperty(window, 'history', {
      configurable: true,
      value: {
        state: { __NA: true, idx: 2 },
        replaceState,
      },
    });
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 1840 });
  });

  afterEach(() => {
    resetScrollRestoreForTests();
    jest.restoreAllMocks();
  });

  it('stamps __odlScrollY onto the current entry and keeps Next state', () => {
    rememberScrollForCurrentEntry();
    expect(replaceState).toHaveBeenCalledWith({ __NA: true, idx: 2, __odlScrollY: 1840 }, '');
  });

  it('reads a finite non-negative offset and ignores anything else', () => {
    expect(readSavedScrollY({ __NA: true, __odlScrollY: 900 })).toBe(900);
    expect(readSavedScrollY({ __odlScrollY: -1 })).toBeNull();
    expect(readSavedScrollY(null)).toBeNull();
  });

  it('strips saved scroll when copying state onto a new entry', () => {
    expect(historyStateWithoutSavedScroll({ __NA: true, __odlScrollY: 900 })).toEqual({
      __NA: true,
    });
  });

  it('scrollToTopNow jumps instantly regardless of CSS scroll-behavior', () => {
    const scrollTo = jest.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    document.documentElement.style.scrollBehavior = 'smooth';

    scrollToTopNow();

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.style.scrollBehavior = '';
  });

  it('waits until the document is tall enough, then restores', () => {
    const scrollTo = jest.spyOn(window, 'scrollTo').mockImplementation((options) => {
      const top = typeof options === 'object' ? options.top : undefined;
      Object.defineProperty(window, 'scrollY', { configurable: true, value: top ?? 0 });
    });
    let frame = 0;
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frame += 1;
      const id = frame;
      if (id === 1) {
        Object.defineProperty(document.documentElement, 'scrollHeight', {
          configurable: true,
          value: 400,
        });
      }
      if (id === 2) {
        Object.defineProperty(document.documentElement, 'scrollHeight', {
          configurable: true,
          value: 4000,
        });
      }
      callback(id * 16);
      return id;
    });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });

    beginScrollRestore(1800);

    expect(isScrollRestorePending()).toBe(false);
    expect(scrollTo).toHaveBeenCalledWith({ top: 1800, left: 0, behavior: 'instant' });
  });

  it('aborts when the user scrolls before content is tall enough', () => {
    const scrollTo = jest.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      configurable: true,
      value: 100,
    });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });

    beginScrollRestore(1800);
    expect(isScrollRestorePending()).toBe(true);

    window.dispatchEvent(new Event('wheel'));

    expect(isScrollRestorePending()).toBe(false);
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
