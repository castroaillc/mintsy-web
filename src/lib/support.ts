import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { Alert, Linking, Platform } from 'react-native';

/** Where people get help. Shared by Settings › Support and anywhere else that points to support. */
export const SUPPORT_EMAIL = 'support@getmintsy.com';
export const HELP_CENTER_URL = 'https://getmintsy.com/support';

/** Opens the help center in the in-app browser, like the legal links. */
export function openHelpCenter() {
  WebBrowser.openBrowserAsync(HELP_CENTER_URL).catch(() => {
    Linking.openURL(HELP_CENTER_URL).catch(() => {});
  });
}

function feedbackBody() {
  const version = Constants.expoConfig?.version ?? 'unknown';
  const os = `${Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : Platform.OS} ${Platform.Version}`;
  return `\n\n\n---\nmintsy ${version} · ${os}`;
}

const SUBJECT = 'mintsy feedback';

/** The in-app mail sheet; false when it can't be shown (no Mail account, or a build without the native module). */
async function composeInApp() {
  try {
    const MailComposer = await import('expo-mail-composer');
    if (!(await MailComposer.isAvailableAsync())) return false;
    await MailComposer.composeAsync({ recipients: [SUPPORT_EMAIL], subject: SUBJECT, body: feedbackBody() });
    return true;
  } catch {
    return false;
  }
}

/** Any other mail app through a mailto: link; false when nothing handles it. */
async function composeWithMailto() {
  const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(feedbackBody())}`;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

async function copyAddress() {
  try {
    const Clipboard = await import('expo-clipboard');
    await Clipboard.setStringAsync(SUPPORT_EMAIL);
    Alert.alert('Address copied', `Paste ${SUPPORT_EMAIL} into your email app.`);
  } catch {
    Alert.alert('Email us', SUPPORT_EMAIL);
  }
}

/** Opens a feedback email to support with the app version and platform; shows the address when no mail app is set up. */
export async function sendFeedback() {
  if (await composeInApp()) return;
  if (await composeWithMailto()) return;
  Alert.alert('No mail app found', `Email us at ${SUPPORT_EMAIL} and we’ll get back to you.`, [
    { text: 'Copy address', onPress: copyAddress },
    { text: 'OK', style: 'cancel' },
  ]);
}
