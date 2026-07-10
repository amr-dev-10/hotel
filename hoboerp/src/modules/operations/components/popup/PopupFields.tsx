import {useMemo, useState} from 'react';
import {Pressable, Text, TextInput, View} from 'react-native';

import {Eye} from '../../../../components/icons';
import {colors} from '../../../../theme/colors';
import {styles} from '../../../../theme/styles';
import type {ArcadiaRecord} from '../../../../types/domain';
import {firstRecordValue} from '../../../../utils/dataUtils';

export function PasswordField({
  label,
  visible,
  onToggleVisible,
}: {
  label: string;
  visible: boolean;
  onToggleVisible: () => void;
}) {
  const [value, setValue] = useState('');

  return (
    <View style={styles.formField}>
      <Text style={styles.formLabel}>{label}</Text>
      <View style={styles.passwordInputRow}>
        <TextInput
          autoCapitalize="none"
          placeholder={label}
          placeholderTextColor={colors.disabledText}
          secureTextEntry={!visible}
          style={styles.passwordInput}
          value={value}
          onChangeText={setValue}
        />
        <Pressable style={styles.passwordEyeButton} onPress={onToggleVisible}>
          <Eye color={colors.textMuted} size={18} strokeWidth={2.1} />
        </Pressable>
      </View>
    </View>
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

export function LookupField({
  displayKeys,
  label,
  placeholder,
  records,
  selectedRecord,
  onSelect,
}: {
  displayKeys: string[];
  label: string;
  placeholder: string;
  records: ArcadiaRecord[];
  selectedRecord: ArcadiaRecord | null;
  onSelect: (record: ArcadiaRecord | null) => void;
}) {
  const [query, setQuery] = useState('');
  const selectedTitle = firstRecordValue(selectedRecord, displayKeys);
  const options = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return records
      .filter(record => {
        if (!needle) {
          return true;
        }
        return displayKeys.some(key =>
          String(record[key] ?? '').toLowerCase().includes(needle),
        );
      })
      .slice(0, 8);
  }, [displayKeys, query, records]);

  return (
    <View style={styles.formField}>
      <Text style={styles.formLabel}>{label}</Text>
      {selectedTitle ? (
        <View style={styles.selectedLookupRow}>
          <Text style={styles.lookupTitle}>{selectedTitle}</Text>
          <Pressable onPress={() => onSelect(null)}>
            <Text style={styles.inlineLinkText}>Clear</Text>
          </Pressable>
        </View>
      ) : null}
      <TextInput
        placeholder={selectedTitle || placeholder}
        placeholderTextColor={colors.disabledText}
        style={styles.formInput}
        value={query}
        onChangeText={setQuery}
      />
      {query || (!selectedTitle && options.length > 0) ? (
        <View style={styles.lookupList}>
          {options.length > 0 ? (
            options.map((record, index) => {
              const title = firstRecordValue(record, displayKeys) || `Record ${index + 1}`;
              const subtitle = firstRecordValue(record, [
                'room_type',
                'job_role',
                'phone',
                'email',
                'status',
              ]);
              return (
                <Pressable
                  key={`${title}-${index}`}
                  style={styles.lookupOption}
                  onPress={() => {
                    onSelect(record);
                    setQuery('');
                  }}>
                  <Text style={styles.lookupTitle}>{title}</Text>
                  {subtitle ? <Text style={styles.captionTiny}>{subtitle}</Text> : null}
                </Pressable>
              );
            })
          ) : (
            <Text style={styles.lookupEmpty}>No matching DB records</Text>
          )}
        </View>
      ) : null}
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
          const active = optionValue === value;
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

export function PopupActionButton({
  disabled,
  label,
  onPress,
  tone = 'primary',
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'secondary';
}) {
  return (
    <Pressable
      disabled={disabled}
      style={[
        styles.popupActionButton,
        tone === 'secondary' && styles.secondaryActionButton,
        disabled && styles.disabledActionButton,
      ]}
      onPress={onPress}>
      <Text
        style={[
          styles.popupActionText,
          tone === 'secondary' && styles.secondaryActionText,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function InlineFormError({message}: {message: string}) {
  return (
    <View style={styles.formErrorBox}>
      <Text style={styles.formErrorTitle}>Action failed</Text>
      <Text style={styles.formErrorText}>{message}</Text>
    </View>
  );
}

export function ContextBanner({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.contextBanner}>
      <Text style={styles.formLabel}>{label}</Text>
      <Text style={styles.contextBannerText}>{value || 'Current record'}</Text>
    </View>
  );
}

export function EmptyPopupText({text}: {text: string}) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateText}>{text}</Text>
    </View>
  );
}
