import { navigateBackSafely } from '../CounselorBackButton';

jest.mock('react-native', () => ({
  StyleSheet: { create: (styles) => styles },
  TouchableOpacity: 'TouchableOpacity',
}));
jest.mock('@expo/vector-icons', () => ({ Feather: 'Feather' }));

describe('navigateBackSafely', () => {
  it('pops the active counselor stack when it has a previous screen', () => {
    const navigation = {
      getState: () => ({ type: 'stack', index: 1 }),
      goBack: jest.fn(),
      getParent: jest.fn(),
    };

    navigateBackSafely(navigation);

    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    expect(navigation.getParent).not.toHaveBeenCalled();
  });

  it('returns to counselor Home from a root screen in a nested stack', () => {
    const tabs = {
      getState: () => ({ type: 'tab', routeNames: ['Dashboard', 'Appointments'] }),
      navigate: jest.fn(),
      getParent: jest.fn(),
    };
    const stack = {
      getState: () => ({ type: 'stack', index: 0 }),
      goBack: jest.fn(),
      getParent: () => tabs,
    };

    navigateBackSafely(stack);

    expect(stack.goBack).not.toHaveBeenCalled();
    expect(tabs.navigate).toHaveBeenCalledWith('Dashboard');
  });

  it('returns to counselor Home from a root tab screen', () => {
    const navigation = {
      getState: () => ({ type: 'tab', routeNames: ['Dashboard', 'Messages'] }),
      navigate: jest.fn(),
    };

    navigateBackSafely(navigation);

    expect(navigation.navigate).toHaveBeenCalledWith('Dashboard');
  });

  it('uses the specified fallback route for a shared student screen', () => {
    const navigation = {
      getState: () => ({ type: 'tab', routeNames: ['Home', 'Counselors', 'Sessions'] }),
      navigate: jest.fn(),
    };

    navigateBackSafely(navigation, 'Counselors');

    expect(navigation.navigate).toHaveBeenCalledWith('Counselors');
  });
});
