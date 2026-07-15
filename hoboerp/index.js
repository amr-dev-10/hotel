/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { setEscalationBackgroundMessageHandler } from './src/services/pushNotifications';

setEscalationBackgroundMessageHandler();
AppRegistry.registerComponent(appName, () => App);
