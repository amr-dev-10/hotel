import {useEffect, useMemo, useState} from 'react';
import type {ReactNode} from 'react';
import {Modal, Pressable, RefreshControl, ScrollView, Text, TextInput, View} from 'react-native';

import {
  ActionMenu,
  type ActionMenuItem,
  ErrorNotice,
  InfoLine,
  LoadingProcessCard,
  TopAppBar,
} from '../../../../components/AppComponents';
import {Bell, ChevronLeft, ChevronRight, Menu} from '../../../../components/icons';
import {formatErrorDetails} from '../../../../services/api';
import {colors} from '../../../../theme/colors';
import {styles} from '../../../../theme/styles';
import type {ArcadiaRecord} from '../../../../types/domain';
import {firstRecordValue} from '../../../../utils/dataUtils';
import {compactDate, text} from '../../utils';
import {compactRecord, formatKey, formatValue, normalize} from './detailUtils';
import type {ActionButtonTone, RelationLabels} from './detailTypes';

export function DetailFrame({
  actions,
  children,
  error,
  loading,
  loadingLabel,
  title,
  onBack,
  onMenu,
  onOpenNotifications,
  onRefresh,
}: {
  actions?: ActionMenuItem[];
  children: ReactNode;
  error: string | null;
  loading: boolean;
  loadingLabel?: string;
  title: string;
  onBack: () => void;
  onMenu: () => void;
  onOpenNotifications?: () => void;
  onRefresh: () => void;
}) {
  return (
    <View style={styles.screen}>
      <View style={styles.staticTopAppBar}>
        <TopAppBar
          title={title}
          leftIcon={ChevronLeft}
          onLeftPress={onBack}
          rightIcon={Menu}
          notificationIcon={Bell}
          onRightPress={onMenu}
          onNotificationPress={onOpenNotifications}
          rightAccessory={actions ? <ActionMenu items={actions} /> : undefined}
        />
      </View>
      <LoadingProcessCard
        active={loading}
        floating
        label={loadingLabel ?? `Loading ${title.toLowerCase()}`}
      />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.screenContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}>
        <ErrorNotice message={error} onRetry={onRefresh} />
        {children}
      </ScrollView>
    </View>
  );
}

export function DetailSection({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <View style={styles.contextBanner}>
      <Text style={styles.formLabel}>{title}</Text>
      {children}
    </View>
  );
}

export function CollapsibleDetailSection({
  children,
  defaultExpanded = true,
  title,
}: {
  children: ReactNode;
  defaultExpanded?: boolean;
  title: string;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <View style={styles.contextBanner}>
      <Pressable
        style={styles.collapsibleSectionHeader}
        onPress={() => setExpanded(current => !current)}>
        <Text style={[styles.formLabel, styles.collapsibleSectionTitle]}>{title}</Text>
        <View
          style={[
            styles.collapsibleSectionIcon,
            expanded && styles.collapsibleSectionIconOpen,
          ]}>
          <ChevronRight color={colors.textMuted} size={17} strokeWidth={2.2} />
        </View>
      </Pressable>
      {expanded ? <View style={styles.collapsibleSectionBody}>{children}</View> : null}
    </View>
  );
}

export function ActionRow({children}: {children: ReactNode}) {
  return <View style={styles.popupActions}>{children}</View>;
}

export function ActionButton({
  disabled,
  label,
  onPress,
  tone = 'primary',
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  tone?: ActionButtonTone;
}) {
  return (
    <Pressable
      disabled={disabled}
      style={[
        styles.popupActionButton,
        tone === 'secondary' && styles.secondaryActionButton,
        tone === 'success' && styles.successActionButton,
        tone === 'warning' && styles.warningActionButton,
        tone === 'danger' && styles.dangerActionButton,
        disabled && styles.disabledActionButton,
      ]}
      onPress={onPress}>
      <Text
        style={[
          styles.popupActionText,
          tone === 'secondary' && styles.secondaryActionText,
          tone === 'warning' && styles.warningActionText,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function EditableField({
  label,
  placeholder,
  value,
  multiline,
  onChangeText,
}: {
  label: string;
  placeholder?: string;
  value: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.formField}>
      <Text style={styles.formLabel}>{label}</Text>
      <TextInput
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor={colors.disabledText}
        style={[styles.formInput, multiline && styles.formInputMultiline]}
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
}

export function Many2OneField({
  createActionLabel,
  displayKeys,
  label,
  onCreateRecord,
  placeholder,
  records,
  selectedRecord,
  onSelect,
}: {
  createActionLabel?: string;
  displayKeys: string[];
  label: string;
  onCreateRecord?: (query: string) => Promise<ArcadiaRecord | null>;
  placeholder: string;
  records: ArcadiaRecord[];
  selectedRecord: ArcadiaRecord | null;
  onSelect: (record: ArcadiaRecord | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);
  const [creating, setCreating] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const selectedTitle = firstRecordValue(selectedRecord, displayKeys);
  const filteredOptions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return records
      .filter(record => {
        if (!needle) {
          return true;
        }
        return displayKeys.some(key =>
          String(record[key] ?? '').toLowerCase().includes(needle),
        );
      });
  }, [displayKeys, query, records]);
  const options = useMemo(
    () => filteredOptions.slice(0, visibleCount),
    [filteredOptions, visibleCount],
  );
  const hasMoreOptions = visibleCount < filteredOptions.length;

  useEffect(() => {
    setVisibleCount(10);
    setPickerError(null);
  }, [query, open]);

  function loadMoreOptions() {
    if (hasMoreOptions) {
      setVisibleCount(current => Math.min(current + 10, filteredOptions.length));
    }
  }

  async function handleCreateRecord() {
    if (!onCreateRecord || creating) {
      return;
    }

    setCreating(true);
    setPickerError(null);
    try {
      const record = await onCreateRecord(query);
      if (record) {
        onSelect(record);
        setQuery('');
        setOpen(false);
      }
    } catch (nextError) {
      setPickerError(formatErrorDetails(nextError, 'Create record failed'));
    } finally {
      setCreating(false);
    }
  }

  return (
    <View style={styles.formField}>
      <Text style={styles.formLabel}>{label}</Text>
      {selectedTitle ? (
        <View style={styles.selectedLookupRow}>
          <Text style={styles.lookupTitle}>{selectedTitle}</Text>
          <Pressable
            onPress={() => {
              onSelect(null);
              setQuery('');
              setOpen(false);
            }}>
            <Text style={styles.inlineLinkText}>Clear</Text>
          </Pressable>
        </View>
      ) : null}
      <Pressable style={styles.lookupInputButton} onPress={() => setOpen(true)}>
        <Text
          numberOfLines={1}
          style={[
            styles.lookupInputText,
            !selectedTitle && styles.lookupPlaceholderText,
          ]}>
          {selectedTitle || placeholder}
        </Text>
        <ChevronRight color={colors.disabledText} size={18} strokeWidth={2.2} />
      </Pressable>
      <Modal
        animationType="slide"
        transparent
        visible={open}
        onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.relationPickerBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.relationPickerSheet}>
            <View style={styles.quickDrawerHandle} />
            <View style={styles.relationPickerHeader}>
              <Text style={styles.relationPickerTitle}>{label}</Text>
              <Pressable style={styles.popupCloseButton} onPress={() => setOpen(false)}>
                <Text style={styles.popupCloseText}>x</Text>
              </Pressable>
            </View>
            <TextInput
              autoFocus
              placeholder={placeholder}
              placeholderTextColor={colors.disabledText}
              style={styles.formInput}
              value={query}
              onChangeText={setQuery}
            />
            {onCreateRecord && createActionLabel ? (
              <Pressable
                disabled={creating}
                style={[
                  styles.lookupSmartAction,
                  creating && styles.disabledActionButton,
                ]}
                onPress={handleCreateRecord}>
                <Text style={styles.lookupSmartActionText}>
                  {creating
                    ? 'Creating...'
                    : query.trim()
                      ? `${createActionLabel}: ${query.trim()}`
                      : createActionLabel}
                </Text>
              </Pressable>
            ) : null}
            {pickerError ? (
              <View style={styles.formErrorBox}>
                <Text style={styles.formErrorTitle}>Action failed</Text>
                <Text style={styles.formErrorText}>{pickerError}</Text>
              </View>
            ) : null}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              showsVerticalScrollIndicator
              style={styles.relationPickerList}
              onScroll={({nativeEvent}) => {
                const distanceFromBottom =
                  nativeEvent.contentSize.height -
                  (nativeEvent.contentOffset.y + nativeEvent.layoutMeasurement.height);
                if (distanceFromBottom < 72) {
                  loadMoreOptions();
                }
              }}
              scrollEventThrottle={16}>
              {options.length > 0 ? (
                options.map((record, index) => {
                  const title = firstRecordValue(record, displayKeys) || `Record ${index + 1}`;
                  const subtitle = firstRecordValue(record, [
                    'room_number',
                    'guest_name',
                    'phone',
                    'email',
                    'status',
                    'job_role',
                  ]);
                  return (
                    <Pressable
                      key={`${firstRecordValue(record, ['id', 'user_id', 'email', 'phone']) || title}-${index}`}
                      style={styles.lookupOption}
                      onPress={() => {
                        onSelect(record);
                        setQuery('');
                        setOpen(false);
                      }}>
                      <Text style={styles.lookupTitle}>{title}</Text>
                      {subtitle ? <Text style={styles.captionTiny}>{subtitle}</Text> : null}
                    </Pressable>
                  );
                })
              ) : (
                <Text style={styles.lookupEmpty}>No matching records</Text>
              )}
              <Text style={styles.lookupEmpty}>
                {hasMoreOptions ? 'Scroll for more records' : 'All matching records loaded'}
              </Text>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export function OptionRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: [string, string][];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.formField}>
      <Text style={styles.formLabel}>{label}</Text>
      <View style={styles.optionWrap}>
        {options.map(([optionValue, optionLabel]) => {
          const active = normalize(value) === normalize(optionValue);
          return (
            <Pressable
              key={optionValue}
              style={[styles.optionPill, active && styles.activeOptionPill]}
              onPress={() => onChange(optionValue)}>
              <Text style={[styles.optionPillText, active && styles.activeOptionPillText]}>
                {optionLabel}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function InlineError({message}: {message: string | null}) {
  if (!message) {
    return null;
  }

  return (
    <View style={styles.formErrorBox}>
      <Text style={styles.formErrorTitle}>Action failed</Text>
      <Text style={styles.formErrorText}>{message}</Text>
    </View>
  );
}

export function TimelineSection({
  defaultExpanded = true,
  items,
  title,
}: {
  defaultExpanded?: boolean;
  items: ArcadiaRecord[];
  title: string;
}) {
  return (
    <CollapsibleDetailSection defaultExpanded={defaultExpanded} title={title}>
      {items.length ? (
        items.map((item, index) => (
          <View key={`${firstRecordValue(item, ['id', 'created_at', 'timestamp'])}-${index}`} style={styles.lookupOption}>
            <Text style={styles.lookupTitle}>
              {firstRecordValue(item, ['title', 'event_type', 'sender_type', 'message_type', 'id']) || `Item ${index + 1}`}
            </Text>
            <Text style={styles.caption}>
              {firstRecordValue(item, ['description', 'content', 'message_text', 'message', 'status']) || compactRecord(item)}
            </Text>
            <Text style={styles.captionTiny}>
              {compactDate(firstRecordValue(item, ['created_at', 'timestamp', 'updated_at']))}
            </Text>
          </View>
        ))
      ) : (
        <Text style={styles.caption}>No records returned from this API.</Text>
      )}
    </CollapsibleDetailSection>
  );
}

export function RecordFields({
  defaultExpanded = true,
  relationLabels = {},
  record,
  title,
}: {
  defaultExpanded?: boolean;
  relationLabels?: RelationLabels;
  record: ArcadiaRecord;
  title: string;
}) {
  const entries = Object.entries(record)
    .filter(([key, value]) => {
      if (key === 'id' || key.endsWith('_id')) {
        return false;
      }
      return value !== undefined && value !== null && text(value).trim() !== '';
    })
    .sort(([left], [right]) => left.localeCompare(right));

  if (!entries.length) {
    return null;
  }

  return (
    <CollapsibleDetailSection defaultExpanded={defaultExpanded} title={title}>
      {entries.map(([key, value]) => (
        <InfoLine key={key} label={formatKey(key)} value={formatValue(value, relationLabels)} />
      ))}
    </CollapsibleDetailSection>
  );
}
