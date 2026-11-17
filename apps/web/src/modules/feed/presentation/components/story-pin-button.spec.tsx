/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';

import { StoryPinButton, type StoryPinButtonProps } from './story-pin-button';

jest.mock('@/i18n/providers/i18n-provider', () => ({
  useI18n: () => ({ t: (key: string) => key, locale: 'en-US' }),
}));

function renderButton(overrides: Partial<StoryPinButtonProps> = {}) {
  const props: StoryPinButtonProps = {
    pinned: false,
    viewerPinned: false,
    pending: false,
    loggedIn: true,
    onPin: jest.fn(),
    onUnpin: jest.fn(),
    onRequireLogin: jest.fn(),
    ...overrides,
  };
  render(<StoryPinButton {...props} />);
  return { props, button: screen.getByRole('button') };
}

function iconClass(button: HTMLElement): string {
  return button.querySelector('svg')?.getAttribute('class') ?? '';
}

describe('StoryPinButton', () => {
  it('pins a post that is not pinned (outline icon)', () => {
    const { props, button } = renderButton();

    expect(button).toHaveAccessibleName('object_post_menu_pin');
    expect(iconClass(button)).not.toContain('fill-current');
    fireEvent.click(button);
    expect(props.onPin).toHaveBeenCalledTimes(1);
  });

  it("shows someone else's pin grey filled and pins on click", () => {
    const { props, button } = renderButton({ pinned: true });

    expect(iconClass(button)).toContain('fill-current');
    expect(iconClass(button)).not.toContain('text-accent');
    fireEvent.click(button);
    expect(props.onPin).toHaveBeenCalledTimes(1);
  });

  it("unpins the viewer's own pin (accent icon)", () => {
    const { props, button } = renderButton({ pinned: true, viewerPinned: true });

    expect(button).toHaveAccessibleName('object_post_menu_unpin');
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(iconClass(button)).toContain('text-accent');
    fireEvent.click(button);
    expect(props.onUnpin).toHaveBeenCalledTimes(1);
    expect(props.onPin).not.toHaveBeenCalled();
  });

  it('asks a logged-out viewer to sign in', () => {
    const { props, button } = renderButton({ loggedIn: false });

    fireEvent.click(button);
    expect(props.onRequireLogin).toHaveBeenCalledTimes(1);
    expect(props.onPin).not.toHaveBeenCalled();
  });

  it('is disabled while a broadcast is pending', () => {
    const { button } = renderButton({ pending: true });

    expect(button).toBeDisabled();
  });
});
