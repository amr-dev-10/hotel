/**
 * TaskUpdate — Attendant marks a task as executed (delivered or not delivered)
 * Maps to Android's TaskUpdate.java
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  FlatList,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { RootStackParamList } from '../../types';
import { TasksService } from '../../services/firebase';
import { LoadingOverlay } from '../../components/common/LoadingOverlay';
import { COLORS } from '../../utils/constants';

type Props = NativeStackScreenProps<RootStackParamList, 'TaskUpdate'>;

// Updated reasons (replaces the old "master key / pet inside / CX extended /
// other" set). Default reasons that the attendant can pick at completion
// time without typing. Guest-asked-later puts the task in the Ongoing
// "paused" state on the dashboard.
const NOT_DELIVERED_REASONS = [
  'Guest not answering',
  'DND',
  'Guest asked to come later',
];

const YES_NO = ['Yes', 'No'];
const INSIDE_OUTSIDE = ['Inside', 'Outside'];

export function TaskUpdateScreen({ navigation, route }: Props) {
  const { task, initialPhotoUri } = route.params;

  const [deliveryMode, setDeliveryMode] = useState<'delivered' | 'not_delivered'>('delivered');
  const [photos, setPhotos] = useState<string[]>(initialPhotoUri ? [initialPhotoUri] : []);
  const [loading, setLoading] = useState(false);

  // Delivered fields
  const [question1Answer, setQuestion1Answer] = useState('');
  const [question2Answer, setQuestion2Answer] = useState('');

  // Not-delivered fields
  const [notDeliveredReason, setNotDeliveredReason] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [showOtherReason, setShowOtherReason] = useState(false);

  async function pickPhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permission is required to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotos((prev) => [...prev, result.assets[0].uri]);
    }
  }

  async function handleSubmit() {
    if (deliveryMode === 'delivered') {
      if (!question1Answer.trim() || !question2Answer.trim()) {
        Alert.alert('Error', 'Please answer both questions');
        return;
      }
    } else {
      if (!notDeliveredReason) {
        Alert.alert('Error', 'Please select a reason');
        return;
      }
      if (notDeliveredReason === 'Other Reasons' && !otherReason.trim()) {
        Alert.alert('Error', 'Please explain the reason');
        return;
      }
    }

    setLoading(true);
    try {
      // Upload photos in parallel — preserves order via Promise.all
      const uploadedUrls = await Promise.all(
        photos.map((uri, i) => TasksService.uploadTaskImage(task.TaskId, uri, i))
      );

      if (deliveryMode === 'delivered') {
        await TasksService.updateTask(task.TaskId, {
          WorkflowStep: 'Done',
          Stage: 'Executed',
          DeliveryStatus: 'Completed',
          TaskImages: uploadedUrls,
          ApprovalAppliedTime: String(Date.now()),
          Question1: 'Was the delivery completed successfully?',
          Answer1: question1Answer,
          Question2: 'Was the guest inside the room?',
          Answer2: question2Answer,
        });
        Alert.alert('Success', 'Approval request sent to manager!', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        await TasksService.updateTask(task.TaskId, {
          WorkflowStep: 'Done',
          Stage: 'Executed',
          DeliveryStatus: 'NotCompleted',
          TaskImagesUnDelivered: uploadedUrls,
          NotDeliveredTime: String(Date.now()),
          NotDeliveredReason1: notDeliveredReason,
          NotDeliveredReason2: notDeliveredReason === 'Other Reasons' ? otherReason : null,
          Reattempt: null,
          ReattemptSetById: null,
          ReattemptSetByName: null,
        } as any);
        Alert.alert('Success', 'Manager has been notified!', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Update failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Task summary */}
      <View style={styles.taskSummary}>
        <Text style={styles.taskRoom}>Room {task.RoomNo}</Text>
        {task.GuestName ? <Text style={styles.taskGuest}>Guest: {task.GuestName}</Text> : null}
        {task.Note ? <Text style={styles.taskNote}>{task.Note}</Text> : null}
      </View>

      {/* Delivery mode toggle */}
      <Text style={styles.sectionLabel}>Delivery Status</Text>
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, deliveryMode === 'delivered' && styles.toggleBtnActive]}
          onPress={() => setDeliveryMode('delivered')}
        >
          <Text style={[styles.toggleBtnText, deliveryMode === 'delivered' && styles.toggleBtnTextActive]}>
            Completed
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, deliveryMode === 'not_delivered' && styles.toggleBtnActive]}
          onPress={() => setDeliveryMode('not_delivered')}
        >
          <Text style={[styles.toggleBtnText, deliveryMode === 'not_delivered' && styles.toggleBtnTextActive]}>
            Not Completed
          </Text>
        </TouchableOpacity>
      </View>

      {/* Delivered fields */}
      {deliveryMode === 'delivered' ? (
        <View>
          <Text style={styles.sectionLabel}>Was the delivery completed successfully?</Text>
          <View style={styles.chipRow}>
            {YES_NO.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.chip, question1Answer === opt && styles.chipActive]}
                onPress={() => setQuestion1Answer(opt)}
              >
                <Text style={[styles.chipText, question1Answer === opt && styles.chipTextActive]}>
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionLabel}>Was the guest inside the room?</Text>
          <View style={styles.chipRow}>
            {INSIDE_OUTSIDE.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.chip, question2Answer === opt && styles.chipActive]}
                onPress={() => setQuestion2Answer(opt)}
              >
                <Text style={[styles.chipText, question2Answer === opt && styles.chipTextActive]}>
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : (
        /* Not-delivered fields */
        <View>
          <Text style={styles.sectionLabel}>Reason for non-delivery</Text>
          <View style={styles.reasonList}>
            {NOT_DELIVERED_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason}
                style={[styles.reasonOption, notDeliveredReason === reason && styles.reasonOptionActive]}
                onPress={() => {
                  setNotDeliveredReason(reason);
                  setShowOtherReason(reason === 'Other Reasons');
                }}
              >
                <Text style={[styles.reasonText, notDeliveredReason === reason && styles.reasonTextActive]}>
                  {reason}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {showOtherReason ? (
            <>
              <Text style={styles.sectionLabel}>Please explain</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder="Explain the reason..."
                placeholderTextColor={COLORS.GREY}
                value={otherReason}
                onChangeText={setOtherReason}
                multiline
                numberOfLines={3}
              />
            </>
          ) : null}
        </View>
      )}

      {/* Photos */}
      <Text style={styles.sectionLabel}>Photos</Text>
      <View style={styles.photoRow}>
        {photos.map((uri, i) => (
          <View key={i} style={styles.photoWrapper}>
            <Image source={{ uri }} style={styles.photo} />
            <TouchableOpacity
              style={styles.removePhoto}
              onPress={() => setPhotos(photos.filter((_, idx) => idx !== i))}
            >
              <Text style={styles.removePhotoText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addPhotoBtn} onPress={pickPhoto}>
          <Text style={styles.addPhotoBtnText}>📷{'\n'}Add Photo</Text>
        </TouchableOpacity>
      </View>

      {/* Submit */}
      <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
        <Text style={styles.submitBtnText}>
          {deliveryMode === 'delivered' ? 'Request Approval' : 'Update Manager'}
        </Text>
      </TouchableOpacity>

      <LoadingOverlay visible={loading} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BACKGROUND },
  content: { padding: 16, paddingBottom: 40 },
  taskSummary: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    elevation: 1,
  },
  taskRoom: { fontSize: 18, fontWeight: '700', color: COLORS.TEXT_PRIMARY },
  taskGuest: { fontSize: 13, color: COLORS.TEXT_SECONDARY, marginTop: 2 },
  taskNote: { fontSize: 13, color: COLORS.TEXT_SECONDARY, marginTop: 4 },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.TEXT_SECONDARY,
    marginTop: 16,
    marginBottom: 8,
  },
  toggleRow: { flexDirection: 'row', gap: 10 },
  toggleBtn: {
    flex: 1,
    borderWidth: 2,
    borderColor: COLORS.PRIMARY,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  toggleBtnActive: { backgroundColor: COLORS.PRIMARY },
  toggleBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.PRIMARY },
  toggleBtnTextActive: { color: '#fff' },
  chipRow: { flexDirection: 'row', gap: 10 },
  chip: {
    borderWidth: 1.5,
    borderColor: COLORS.PRIMARY,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: COLORS.PRIMARY },
  chipText: { fontSize: 14, fontWeight: '600', color: COLORS.PRIMARY },
  chipTextActive: { color: '#fff' },
  reasonList: { gap: 8 },
  reasonOption: {
    borderWidth: 1.5,
    borderColor: COLORS.BORDER,
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#fff',
  },
  reasonOptionActive: { borderColor: COLORS.PRIMARY, backgroundColor: '#EEF4FF' },
  reasonText: { fontSize: 14, color: COLORS.TEXT_PRIMARY },
  reasonTextActive: { color: COLORS.PRIMARY, fontWeight: '600' },
  input: {
    borderWidth: 1.5,
    borderColor: COLORS.BORDER,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: COLORS.TEXT_PRIMARY,
    backgroundColor: '#fff',
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoWrapper: { position: 'relative' },
  photo: { width: 90, height: 90, borderRadius: 8 },
  removePhoto: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: COLORS.ERROR,
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removePhotoText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  addPhotoBtn: {
    width: 90,
    height: 90,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLORS.PRIMARY,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoBtnText: { color: COLORS.PRIMARY, fontSize: 12, textAlign: 'center', lineHeight: 18 },
  submitBtn: {
    marginTop: 28,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
