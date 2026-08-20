import {PermissionsAndroid, Platform} from 'react-native';

let hasRequestedLocationPermission = false;

export async function requestLocationPermissionOnLaunch(): Promise<boolean> {
  if (hasRequestedLocationPermission || Platform.OS !== 'android') {
    return false;
  }

  hasRequestedLocationPermission = true;

  try {
    const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
    const coarse = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
    const [hasFine, hasCoarse] = await Promise.all([
      PermissionsAndroid.check(fine),
      PermissionsAndroid.check(coarse),
    ]);

    if (hasFine || hasCoarse) {
      return true;
    }

    const result = await PermissionsAndroid.request(fine, {
      title: 'Location access',
      message:
        'HOBO uses location to store GPS coordinates with attendance check-in and check-out records.',
      buttonPositive: 'Allow',
      buttonNegative: 'Not now',
    });

    if (result === PermissionsAndroid.RESULTS.GRANTED) {
      return true;
    }

    const coarseResult = await PermissionsAndroid.request(coarse);
    return coarseResult === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}
