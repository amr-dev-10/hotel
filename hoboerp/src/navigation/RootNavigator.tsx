import React from 'react';

import {AppProviders} from '../app/AppProviders';
import ArcadiaMobileApp from '../app/ArcadiaMobileApp';

export default function RootNavigator() {
  return (
    <AppProviders>
      <ArcadiaMobileApp />
    </AppProviders>
  );
}
