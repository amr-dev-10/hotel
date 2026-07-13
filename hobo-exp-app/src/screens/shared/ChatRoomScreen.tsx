import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, ChatMessage, User } from '../../types';
import { ChatService, UsersService } from '../../services/backend';
import { useAuthStore } from '../../store/useAuthStore';
import { UserAvatar } from '../../components/common/UserAvatar';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatRoom'>;

const BG          = '#F9F9FF';
const WHITE       = '#FFFFFF';
const CYAN        = '#00D9FE';
const ON_CYAN     = '#001F26';
const PRIMARY     = '#0052CC';
const ON_SURFACE  = '#101C2D';
const ON_SURF_VAR = '#434654';
const OUTLINE     = '#737685';
const OUTLINE_VAR = '#C3C6D6';
const SURFACE_LO  = '#F0F3FF';
const SURFACE_CT  = '#DEE9FF';
const GREEN_DOT   = '#10B981';

export function ChatRoomScreen({ navigation, route }: Props) {
  const { userId: otherUserId, userName, chatType = 'USER' } = route.params;
  const { employeeId, name } = useAuthStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const listRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, []);

  useEffect(() => {
    if (!otherUserId || chatType === 'GUEST') return;
    return UsersService.subscribeToUser(otherUserId, setOtherUser);
  }, [otherUserId, chatType]);

  useEffect(() => {
    if (!employeeId) return;
    UsersService.updateUser(employeeId, { OnlineForChat: true } as any);
    return () => {
      UsersService.updateUser(employeeId, { OnlineForChat: false } as any);
    };
  }, [employeeId]);

  useEffect(() => {
    if (!employeeId) return;
    const unsub = ChatService.subscribeToMessages(employeeId, otherUserId, setMessages, chatType);
    ChatService.updateUnreadCount(employeeId, otherUserId, userName, false);
    return unsub;
  }, [employeeId, otherUserId, chatType]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  // A guest conversation is closed once a `_system: "chat_ended"` marker is
  // the last entry in the thread — written by the guest's WhatsApp bot / web
  // widget when they end it, or by a staff dashboard. Once closed, the
  // guest's relay listener has detached, so anything sent here goes nowhere;
  // lock the composer until the guest re-engages (which appends a fresh
  // non-system message and flips this back to false).
  const lastMessage = messages.length ? messages[messages.length - 1] : undefined;
  const chatEnded = chatType === 'GUEST' && lastMessage?._system === 'chat_ended';

  async function send() {
    if (!input.trim() || !employeeId || chatEnded) return;
    const text = input.trim();
    setInput('');
    await ChatService.sendMessage(employeeId, otherUserId, text, chatType);
    if (chatType !== 'GUEST') {
      const recipientUser = await UsersService.getUser(otherUserId);
      if (!recipientUser?.OnlineForChat) {
        await ChatService.updateUnreadCount(otherUserId, employeeId, '', true);
      }
    }
  }

  const isOnline = otherUser?.OnlineForChat === true || otherUser?.Status === true;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Custom Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={24} color={ON_SURFACE} />
          </TouchableOpacity>

          <View style={styles.headerInfo}>
            <View style={styles.headerAvatarWrap}>
              <UserAvatar profileImage={otherUser?.ProfileImage} name={userName} size={36} />
              {isOnline && <View style={styles.onlineDot} />}
            </View>
            <View style={styles.headerText}>
              <Text style={styles.headerName} numberOfLines={1}>{userName}</Text>
              {isOnline ? (
                <View style={styles.onlineRow}>
                  <View style={styles.onlineSmallDot} />
                  <Text style={styles.onlineLabel}>Online</Text>
                </View>
              ) : null}
            </View>
          </View>

        </View>

        {/* Messages */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.msgId}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              isOwn={item.senderId === employeeId}
              otherUser={otherUser}
              otherName={userName}
            />
          )}
          ListHeaderComponent={
            <View style={styles.dateSepWrap}>
              <View style={styles.dateSepPill}>
                <Text style={styles.dateSepText}>TODAY</Text>
              </View>
            </View>
          }
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />

        {/* Input bar */}
        <View style={[styles.inputBar, { paddingBottom: 10 + insets.bottom }]}>
          <View style={[styles.inputWrap, chatEnded && styles.inputWrapDisabled]}>
            <TextInput
              style={styles.input}
              placeholder={
                chatEnded
                  ? 'Chat ended — the guest is back with the assistant'
                  : 'Type your message...'
              }
              placeholderTextColor={OUTLINE}
              value={input}
              onChangeText={setInput}
              editable={!chatEnded}
              multiline
            />
          </View>

          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || chatEnded) && styles.sendBtnDisabled]}
            onPress={send}
            disabled={!input.trim() || chatEnded}
            activeOpacity={0.85}
          >
            <Ionicons name="send" size={18} color={WHITE} style={{ marginLeft: 2 }} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function formatMessageTime(ts: any): string {
  const ms = typeof ts === 'string' ? Number(ts) : typeof ts === 'number' ? ts : 0;
  if (!ms || isNaN(ms)) return '';
  const d = new Date(ms);
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

function MessageBubble({
  message, isOwn, otherUser, otherName,
}: {
  message: ChatMessage; isOwn: boolean; otherUser: User | null; otherName: string;
}) {
  // System events (e.g. the guest or a manager ended the chat) render as a
  // centered pill rather than a left/right bubble — no sender, no time.
  if (message._system === 'chat_ended') {
    return (
      <View style={styles.systemRow}>
        <View style={styles.systemPill}>
          <Text style={styles.systemText}>{message.message || 'Chat ended'}</Text>
        </View>
      </View>
    );
  }

  const time = formatMessageTime(message.timestamp);

  if (isOwn) {
    return (
      <View style={styles.ownRow}>
        <View style={styles.ownBubbleWrap}>
          <View style={styles.ownBubble}>
            <Text style={styles.ownText}>{message.message}</Text>
          </View>
          {time ? <Text style={styles.ownTime}>{time}</Text> : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.otherRow}>
      <View style={styles.otherAvatarWrap}>
        <UserAvatar profileImage={otherUser?.ProfileImage} name={otherName} size={32} />
      </View>
      <View style={styles.otherBubbleWrap}>
        <View style={styles.otherBubble}>
          <Text style={styles.otherText}>{message.message}</Text>
        </View>
        {time ? <Text style={styles.otherTime}>{time}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: WHITE },
  container: { flex: 1, backgroundColor: BG },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: WHITE,
    borderBottomWidth: 1,
    borderBottomColor: SURFACE_CT,
    gap: 10,
  },
  headerInfo:      { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 4 },
  headerAvatarWrap:{ position: 'relative' },
  onlineDot: {
    position: 'absolute', bottom: -1, right: -1,
    width: 11, height: 11, borderRadius: 6,
    backgroundColor: GREEN_DOT,
    borderWidth: 2, borderColor: WHITE,
  },
  headerText:    {},
  headerName:    { fontSize: 16, fontWeight: '700', color: ON_SURFACE, letterSpacing: -0.2 },
  onlineRow:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  onlineSmallDot:{ width: 6, height: 6, borderRadius: 3, backgroundColor: GREEN_DOT },
  onlineLabel:   { fontSize: 11, color: '#005B6B', fontWeight: '600' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headerIconBtn: { padding: 2 },

  // List
  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 },

  // Date separator
  dateSepWrap: { alignItems: 'center', paddingVertical: 8, marginBottom: 8 },
  dateSepPill: {
    backgroundColor: SURFACE_CT,
    paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 9999,
  },
  dateSepText: { fontSize: 10, color: ON_SURF_VAR, letterSpacing: 1, fontWeight: '500' },

  // System event pill (chat ended, etc.) — centered, neutral
  systemRow:  { alignItems: 'center', paddingVertical: 4, marginBottom: 12 },
  systemPill: {
    backgroundColor: SURFACE_CT,
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 9999,
    maxWidth: '90%',
  },
  systemText: { fontSize: 12, color: ON_SURF_VAR, fontWeight: '500', textAlign: 'center' },

  // Other (incoming) message — left aligned, cyan bubble
  otherRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    alignSelf: 'flex-start',
    gap: 8,
    marginBottom: 16,
    maxWidth: '85%',
  },
  otherAvatarWrap: { paddingBottom: 4, flexShrink: 0 },
  otherBubbleWrap: { flex: 1, flexShrink: 1, minWidth: 0 },
  otherBubble: {
    backgroundColor: CYAN,
    borderRadius: 16,
    borderBottomLeftRadius: 2,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexShrink: 1,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  otherText: { fontSize: 15, lineHeight: 22, color: ON_CYAN, flexShrink: 1, flexWrap: 'wrap' },
  otherTime: { fontSize: 10, color: OUTLINE, marginTop: 4, marginLeft: 4 },

  // Own (outgoing) message — right aligned, white card with border
  ownRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    alignSelf: 'flex-end',
    gap: 8,
    marginBottom: 16,
    maxWidth: '85%',
  },
  ownBubbleWrap: { flex: 1, flexShrink: 1, minWidth: 0, alignItems: 'flex-end' },
  ownBubble: {
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: OUTLINE_VAR,
    borderRadius: 16,
    borderBottomRightRadius: 2,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexShrink: 1,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  ownText: { fontSize: 15, lineHeight: 22, color: ON_SURFACE, flexShrink: 1, flexWrap: 'wrap' },
  ownTime: { fontSize: 10, color: OUTLINE, marginTop: 4, marginRight: 4 },
  meAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: PRIMARY,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 4,
  },
  meAvatarText: { fontSize: 11, color: WHITE, fontWeight: '700', letterSpacing: 0.5 },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: WHITE,
    borderTopWidth: 1,
    borderTopColor: SURFACE_CT,
    gap: 8,
  },
  plusBtn: { padding: 4 },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE_LO,
    borderRadius: 9999,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  inputWrapDisabled: { opacity: 0.6 },
  input: {
    flex: 1,
    fontSize: 14,
    color: ON_SURFACE,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    maxHeight: 100,
  },
  emojiBtn: { paddingLeft: 8, paddingVertical: 4 },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: PRIMARY,
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: OUTLINE_VAR },
});
