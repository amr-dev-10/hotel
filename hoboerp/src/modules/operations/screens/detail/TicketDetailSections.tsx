import {useEffect, useMemo, useState} from 'react';
import {Pressable, ScrollView, Text, TextInput, View} from 'react-native';

import {Send} from '../../../../components/icons';
import {colors} from '../../../../theme/colors';
import {blue, styles} from '../../../../theme/styles';
import type {ArcadiaRecord} from '../../../../types/domain';
import {firstRecordValue} from '../../../../utils/dataUtils';
import {compactDate} from '../../utils';
import {CollapsibleDetailSection} from './DetailLayout';
import type {TicketActivityItem} from './detailTypes';

export function ActivityTimeline({
  items,
  note,
  noteSubmitting,
  onAddNote,
  onNoteChange,
}: {
  items: TicketActivityItem[];
  note: string;
  noteSubmitting: boolean;
  onAddNote: () => void;
  onNoteChange: (value: string) => void;
}) {
  return (
    <CollapsibleDetailSection defaultExpanded={false} title="Activity">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        persistentScrollbar
        showsVerticalScrollIndicator
        style={styles.activityTimelineScroll}
        contentContainerStyle={styles.activityTimelineList}>
        {items.length ? (
          items.map(item => (
            <View key={`${item.type}-${item.id}`} style={styles.activityTimelineItem}>
              <View
                style={[
                  styles.activityTimelineDot,
                  item.type === 'note'
                    ? styles.activityTimelineDotNote
                    : styles.activityTimelineDotEvent,
                ]}
              />
              <View style={styles.activityTimelineText}>
                <Text style={styles.lookupTitle}>{item.title}</Text>
                <Text style={styles.caption}>{item.content}</Text>
                <Text style={styles.captionTiny}>{compactDate(item.createdAt)}</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.caption}>No activity returned from this API.</Text>
        )}
      </ScrollView>
      <View style={styles.popupComposer}>
        <TextInput
          multiline
          placeholder="Add an internal update..."
          placeholderTextColor={colors.disabledText}
          style={styles.popupComposerInput}
          value={note}
          onChangeText={onNoteChange}
        />
        <Pressable style={styles.popupSendButton} disabled={noteSubmitting || !note.trim()} onPress={onAddNote}>
          <Send color={blue} size={18} strokeWidth={2.2} />
        </Pressable>
      </View>
    </CollapsibleDetailSection>
  );
}

export function TicketGuestWhatsAppSection({
  canSend,
  hasGuestContext,
  items,
  message,
  messageSubmitting,
  onMessageChange,
  onSendMessage,
}: {
  canSend: boolean;
  hasGuestContext: boolean;
  items: ArcadiaRecord[];
  message: string;
  messageSubmitting: boolean;
  onMessageChange: (value: string) => void;
  onSendMessage: () => void;
}) {
  const [visibleCount, setVisibleCount] = useState(20);

  useEffect(() => {
    setVisibleCount(20);
  }, [items.length]);

  const visibleItems = useMemo(
    () => items.slice(Math.max(0, items.length - visibleCount)),
    [items, visibleCount],
  );
  const canLoadEarlier = visibleCount < items.length;

  return (
    <CollapsibleDetailSection defaultExpanded={false} title="Guest WhatsApp Messages">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        persistentScrollbar
        scrollEventThrottle={16}
        showsVerticalScrollIndicator
        style={styles.chatTranscriptScroll}
        contentContainerStyle={styles.chatTranscript}
        onScroll={({nativeEvent}) => {
          if (nativeEvent.contentOffset.y <= 16 && canLoadEarlier) {
            setVisibleCount(current => Math.min(items.length, current + 20));
          }
        }}>
        {canLoadEarlier ? (
          <Text style={styles.captionTiny}>Scroll up to load earlier messages.</Text>
        ) : null}
        {visibleItems.length ? (
          visibleItems.map((item, index) => {
            const outbound =
              firstRecordValue(item, ['direction']) === 'outbound' ||
              firstRecordValue(item, ['sender_type']) === 'staff';
            return (
              <View
                key={`${firstRecordValue(item, ['id', 'created_at', 'meta_message_id'])}-${index}`}
                style={outbound ? styles.chatBubbleAgent : styles.chatBubbleGuest}>
                <Text style={outbound ? styles.chatBubbleAgentText : styles.chatBubbleGuestText}>
                  {firstRecordValue(item, ['message_text', 'message', 'content', 'body', 'message_type'])}
                </Text>
                <Text style={[styles.captionTiny, outbound && styles.chatBubbleAgentMeta]}>
                  {compactDate(firstRecordValue(item, ['created_at', 'timestamp', 'updated_at']))}
                </Text>
              </View>
            );
          })
        ) : (
          <Text style={styles.chatMessageGuest}>No guest WhatsApp messages linked to this ticket yet.</Text>
        )}
      </ScrollView>
      {canSend && hasGuestContext ? (
        <View style={styles.popupComposer}>
          <TextInput
            multiline
            placeholder="Type a WhatsApp message..."
            placeholderTextColor={colors.disabledText}
            style={styles.popupComposerInput}
            value={message}
            onChangeText={onMessageChange}
          />
          <Pressable
            style={styles.popupSendButton}
            disabled={messageSubmitting || !message.trim()}
            onPress={onSendMessage}>
            <Send color={blue} size={18} strokeWidth={2.2} />
          </Pressable>
        </View>
      ) : (
        <Text style={styles.caption}>
          {hasGuestContext
            ? 'WhatsApp send is available to staff with ticket assignment permission.'
            : 'Link a guest or WhatsApp conversation before sending a message.'}
        </Text>
      )}
    </CollapsibleDetailSection>
  );
}
