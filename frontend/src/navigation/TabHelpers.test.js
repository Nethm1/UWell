import { getTabBarStyle } from './TabHelpers';

describe('getTabBarStyle', () => {
  it('adds bottom safe-area padding so the tab bar is not clipped', () => {
    const style = getTabBarStyle(20);

    expect(style.height).toBe(84);
    expect(style.paddingBottom).toBe(20);
    expect(style.paddingTop).toBe(6);
  });

  it('keeps a minimum bottom inset for devices without a home indicator', () => {
    const style = getTabBarStyle(0);

    expect(style.height).toBe(72);
    expect(style.paddingBottom).toBe(8);
  });
});
