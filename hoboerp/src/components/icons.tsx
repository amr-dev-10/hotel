import Svg, {Circle, Path, Polyline, Rect} from 'react-native-svg';

import {textColor} from '../theme/styles';
import type {IconComponent} from '../navigation/types';

type IconName =
  | 'alertCircle'
  | 'bell'
  | 'bot'
  | 'briefcase'
  | 'calendar'
  | 'checkCircle'
  | 'chevronLeft'
  | 'chevronRight'
  | 'clock'
  | 'clipboard'
  | 'filter'
  | 'eye'
  | 'helpCircle'
  | 'home'
  | 'hotel'
  | 'key'
  | 'lock'
  | 'logout'
  | 'menu'
  | 'message'
  | 'mic'
  | 'more'
  | 'package'
  | 'phone'
  | 'plus'
  | 'qr'
  | 'search'
  | 'send'
  | 'settings'
  | 'ticket'
  | 'trendingUp'
  | 'utensils'
  | 'user'
  | 'users'
  | 'wrench';

function AppIcon({
  name,
  color = textColor,
  size = 22,
  strokeWidth = 2,
}: {
  name: IconName;
  color?: string;
  size?: number;
  strokeWidth?: number;
}) {
  const strokeProps = {
    stroke: color,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth,
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {iconNode(name, strokeProps)}
    </Svg>
  );
}

function iconNode(
  name: IconName,
  props: {
    stroke: string;
    strokeLinecap: 'round';
    strokeLinejoin: 'round';
    strokeWidth: number;
  },
) {
  switch (name) {
    case 'alertCircle':
      return (
        <>
          <Circle cx="12" cy="12" r="9" {...props} />
          <Path d="M12 8v5M12 16h.01" {...props} />
        </>
      );
    case 'bell':
      return (
        <>
          <Path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" {...props} />
          <Path d="M10 21h4" {...props} />
        </>
      );
    case 'bot':
      return (
        <>
          <Rect x="4" y="7" width="16" height="12" rx="3" {...props} />
          <Path d="M12 3v4" {...props} />
          <Circle cx="9" cy="13" r="1" {...props} />
          <Circle cx="15" cy="13" r="1" {...props} />
          <Path d="M9 17h6" {...props} />
        </>
      );
    case 'briefcase':
      return (
        <>
          <Rect x="3" y="7" width="18" height="13" rx="2" {...props} />
          <Path d="M9 7V5h6v2" {...props} />
          <Path d="M3 13h18" {...props} />
        </>
      );
    case 'calendar':
      return (
        <>
          <Rect x="3" y="5" width="18" height="16" rx="2" {...props} />
          <Path d="M16 3v4M8 3v4M3 10h18" {...props} />
        </>
      );
    case 'checkCircle':
      return (
        <>
          <Circle cx="12" cy="12" r="9" {...props} />
          <Path d="m8.5 12.5 2.2 2.2 4.8-5.2" {...props} />
        </>
      );
    case 'chevronLeft':
      return <Polyline points="15 18 9 12 15 6" {...props} />;
    case 'chevronRight':
      return <Polyline points="9 18 15 12 9 6" {...props} />;
    case 'clock':
      return (
        <>
          <Circle cx="12" cy="12" r="9" {...props} />
          <Path d="M12 7v5l3.5 2" {...props} />
        </>
      );
    case 'clipboard':
      return (
        <>
          <Rect x="5" y="4" width="14" height="17" rx="2" {...props} />
          <Path d="M9 4a3 3 0 0 1 6 0" {...props} />
          <Path d="m9 13 2 2 4-5" {...props} />
        </>
      );
    case 'filter':
      return <Path d="M3 5h18l-7 8v5l-4 2v-7z" {...props} />;
    case 'eye':
      return (
        <>
          <Path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" {...props} />
          <Circle cx="12" cy="12" r="3" {...props} />
        </>
      );
    case 'helpCircle':
      return (
        <>
          <Circle cx="12" cy="12" r="9" {...props} />
          <Path d="M9.5 9a2.8 2.8 0 0 1 5.2 1.4c0 1.8-1.7 2.4-2.3 3.3" {...props} />
          <Path d="M12 17h.01" {...props} />
        </>
      );
    case 'home':
      return (
        <>
          <Path d="M3 11 12 4l9 7" {...props} />
          <Path d="M5 10v10h14V10" {...props} />
          <Path d="M9 20v-6h6v6" {...props} />
        </>
      );
    case 'hotel':
      return (
        <>
          <Path d="M4 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" {...props} />
          <Path d="M2 21h20M8 7h1M13 7h1M8 11h1M13 11h1M8 15h1M13 15h1" {...props} />
        </>
      );
    case 'key':
      return (
        <>
          <Circle cx="8" cy="15" r="4" {...props} />
          <Path d="m11 12 9-9M15 7l2 2M17 5l2 2" {...props} />
        </>
      );
    case 'lock':
      return (
        <>
          <Rect x="4" y="10" width="16" height="11" rx="2" {...props} />
          <Path d="M8 10V7a4 4 0 0 1 8 0v3" {...props} />
        </>
      );
    case 'logout':
      return (
        <>
          <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" {...props} />
          <Path d="M16 17l5-5-5-5M21 12H9" {...props} />
        </>
      );
    case 'menu':
      return <Path d="M4 6h16M4 12h16M4 18h16" {...props} />;
    case 'message':
      return (
        <>
          <Path d="M21 12a8 8 0 0 1-8 8H5l-2 2v-8a8 8 0 1 1 18-2Z" {...props} />
        </>
      );
    case 'mic':
      return (
        <>
          <Rect x="9" y="3" width="6" height="11" rx="3" {...props} />
          <Path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" {...props} />
        </>
      );
    case 'more':
      return (
        <>
          <Circle cx="5" cy="12" r="1" {...props} />
          <Circle cx="12" cy="12" r="1" {...props} />
          <Circle cx="19" cy="12" r="1" {...props} />
        </>
      );
    case 'package':
      return (
        <>
          <Path d="M21 8 12 3 3 8l9 5z" {...props} />
          <Path d="M3 8v8l9 5 9-5V8M12 13v8" {...props} />
        </>
      );
    case 'phone':
      return <Path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.7.6 2.5a2 2 0 0 1-.4 2.1L8 9.6a16 16 0 0 0 6.4 6.4l1.3-1.3a2 2 0 0 1 2.1-.4c.8.3 1.6.5 2.5.6a2 2 0 0 1 1.7 2Z" {...props} />;
    case 'plus':
      return <Path d="M12 5v14M5 12h14" {...props} />;
    case 'qr':
      return (
        <>
          <Rect x="3" y="3" width="7" height="7" {...props} />
          <Rect x="14" y="3" width="7" height="7" {...props} />
          <Rect x="3" y="14" width="7" height="7" {...props} />
          <Path d="M14 14h2v2h-2zM19 14h2v4h-4v3h-3v-5h5z" {...props} />
        </>
      );
    case 'search':
      return (
        <>
          <Circle cx="11" cy="11" r="7" {...props} />
          <Path d="m20 20-3.5-3.5" {...props} />
        </>
      );
    case 'send':
      return <Path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" {...props} />;
    case 'settings':
      return (
        <>
          <Circle cx="12" cy="12" r="3" {...props} />
          <Path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 3.4-.2-.1a1.7 1.7 0 0 0-2 .4l-.1.1a1.7 1.7 0 0 0-.5 1.2H9a1.7 1.7 0 0 0-.6-1.3 1.7 1.7 0 0 0-2-.3l-.2.1-2-3.4.1-.1a1.7 1.7 0 0 0 .4-2v-.1a1.7 1.7 0 0 0-1.2-1H3v-4h.4a1.7 1.7 0 0 0 1.3-1 1.7 1.7 0 0 0-.4-2L4.2 7l2-3.4.2.1a1.7 1.7 0 0 0 2-.4A1.7 1.7 0 0 0 9 2h6a1.7 1.7 0 0 0 .6 1.3 1.7 1.7 0 0 0 2 .3l.2-.1 2 3.4-.1.1a1.7 1.7 0 0 0-.4 2v.1a1.7 1.7 0 0 0 1.2 1h.5v4h-.4a1.7 1.7 0 0 0-1.2.9Z" {...props} />
        </>
      );
    case 'ticket':
      return <Path d="M3 9a3 3 0 0 0 0 6v3h18v-3a3 3 0 0 0 0-6V6H3zM9 6v12" {...props} />;
    case 'trendingUp':
      return (
        <>
          <Path d="m3 16 6-6 4 4 7-7" {...props} />
          <Path d="M14 7h6v6" {...props} />
        </>
      );
    case 'utensils':
      return <Path d="M4 3v8M8 3v8M6 3v18M14 3v8a4 4 0 0 0 4 4v6" {...props} />;
    case 'user':
      return (
        <>
          <Circle cx="12" cy="8" r="4" {...props} />
          <Path d="M4 21a8 8 0 0 1 16 0" {...props} />
        </>
      );
    case 'users':
      return (
        <>
          <Circle cx="9" cy="8" r="4" {...props} />
          <Path d="M2 21a7 7 0 0 1 14 0" {...props} />
          <Path d="M16 5a4 4 0 0 1 0 6M22 21a7 7 0 0 0-5-6.7" {...props} />
        </>
      );
    case 'wrench':
      return <Path d="M14.7 6.3a4 4 0 0 0-5 5L3 18l3 3 6.7-6.7a4 4 0 0 0 5-5l-2.4 2.4-2-2z" {...props} />;
    default:
      return null;
  }
}

function makeIcon(name: IconName): IconComponent {
  return props => <AppIcon name={name} {...props} />;
}

export const AlertCircle = makeIcon('alertCircle');
export const Bell = makeIcon('bell');
export const Bot = makeIcon('bot');
export const BriefcaseBusiness = makeIcon('briefcase');
export const CalendarDays = makeIcon('calendar');
export const CheckCircle = makeIcon('checkCircle');
export const ChevronLeft = makeIcon('chevronLeft');
export const ChevronRight = makeIcon('chevronRight');
export const Clock = makeIcon('clock');
export const ClipboardCheck = makeIcon('clipboard');
export const Filter = makeIcon('filter');
export const Eye = makeIcon('eye');
export const HelpCircle = makeIcon('helpCircle');
export const Home = makeIcon('home');
export const Hotel = makeIcon('hotel');
export const KeyRound = makeIcon('key');
export const LockKeyhole = makeIcon('lock');
export const LogOut = makeIcon('logout');
export const Menu = makeIcon('menu');
export const MessageCircle = makeIcon('message');
export const Mic = makeIcon('mic');
export const MoreHorizontal = makeIcon('more');
export const Package = makeIcon('package');
export const Phone = makeIcon('phone');
export const Plus = makeIcon('plus');
export const QrCode = makeIcon('qr');
export const Search = makeIcon('search');
export const Send = makeIcon('send');
export const Settings = makeIcon('settings');
export const Ticket = makeIcon('ticket');
export const TrendingUp = makeIcon('trendingUp');
export const Utensils = makeIcon('utensils');
export const User = makeIcon('user');
export const Users = makeIcon('users');
export const Wrench = makeIcon('wrench');
