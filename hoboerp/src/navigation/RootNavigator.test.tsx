import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import RootNavigator from './RootNavigator';

test('renders correctly', () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<RootNavigator />);
  });

  expect(renderer?.toJSON()).toBeTruthy();

  ReactTestRenderer.act(() => {
    renderer?.unmount();
  });
});
