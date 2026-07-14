import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Switch,
  ToastAndroid,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { InventoryService } from '../../services/backend';
import { InventoryItem } from '../../types';
import { COLORS } from '../../utils/constants';
import { useAuthStore } from '../../store/useAuthStore';
import { ScreenHeader } from '../../components/common/ScreenHeader';

function showToast(msg: string) {
  if (Platform.OS === 'android') {
    ToastAndroid.show(msg, ToastAndroid.SHORT);
  } else {
    Alert.alert('', msg);
  }
}

export function InventoryScreen() {
  const insets = useSafeAreaInsets();
  const { jobRole } = useAuthStore();
  const normalizeRole = (r?: string | null) => (r ?? '').toString().trim().toLowerCase().replace(/[\s_-]+/g, '');
  const isManager = normalizeRole(jobRole) === 'manager' || normalizeRole(jobRole) === 'owner' || normalizeRole(jobRole) === 'frontdesk';

  if (!isManager) {
    return (
      <View style={styles.comingSoonContainer}>
        <ScreenHeader title="Inventory" topInset={insets.top} />
        <View style={styles.comingSoonContent}>
          <Text style={styles.comingSoonIcon}>🚧</Text>
          <Text style={styles.comingSoonTitle}>Coming Soon</Text>
          <Text style={styles.comingSoonSubtitle}>Inventory is available for managers only</Text>
        </View>
      </View>
    );
  }

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = InventoryService.subscribeToInventory(setItems);
    return unsub;
  }, []);

  async function handleAdd() {
    if (!newItemName.trim()) return;
    setLoading(true);
    try {
      await InventoryService.addInventoryItem(newItemName.trim());
      showToast('Added SuccessFully');
      setNewItemName('');
      setShowAdd(false);
    } catch (e: any) {
      const msg = (e?.message ?? '').toString().toLowerCase();
      Alert.alert('Error', msg.includes('already') ? 'Already Exist' : 'Failed to add item');
    } finally {
      setLoading(false);
    }
  }

  async function toggleAvailability(item: InventoryItem) {
    if (!isManager) {
      showToast('Manager Can Update Only');
      return;
    }
    try {
      await InventoryService.updateAvailability(item.id, !item.Available);
      showToast(`${item.Name || item.id} Updated`);
    } catch (e: any) {
      showToast(e?.message ?? 'Update failed');
    }
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Inventory" topInset={insets.top} />

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const displayName = item.Name || (item as any).name || item.id;
          const isAvailable = item.Available ?? (item as any).available ?? false;
          return (
            <View style={styles.itemRow}>
              <Text style={styles.itemName}>{displayName}</Text>
              <View style={styles.itemRight}>
                <Switch
                  value={isAvailable}
                  onValueChange={() => toggleAvailability(item)}
                  trackColor={{ false: '#BDBDBD', true: '#A5D6A7' }}
                  thumbColor={isAvailable ? '#43A047' : '#fff'}
                />
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No inventory items</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.rowDivider} />}
        contentContainerStyle={styles.list}
      />

      {isManager ? (
        <View style={styles.bottomAddWrap}>
          <TouchableOpacity style={styles.bottomAddBtn} onPress={() => setShowAdd(true)}>
            <Text style={styles.bottomAddBtnText}>Add Item</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Add Item Modal — only accessible to managers */}
      {isManager ? (
        <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Add item to Inventory</Text>
              <Text style={styles.modalSubtitle}>Name your item to be added</Text>
              <TextInput
                style={styles.input}
                placeholder="Name of Item"
                placeholderTextColor={COLORS.GREY}
                value={newItemName}
                onChangeText={setNewItemName}
                autoFocus
              />
              <TouchableOpacity
                style={[styles.modalBtn, loading && styles.modalBtnDisabled]}
                onPress={handleAdd}
                disabled={loading}
              >
                <Text style={styles.modalBtnText}>{loading ? 'Adding...' : 'Confirm'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAdd(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  comingSoonContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  comingSoonContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  comingSoonIcon: { fontSize: 56, marginBottom: 16 },
  comingSoonTitle: { fontSize: 24, fontWeight: '700', color: '#1A1A2E', marginBottom: 8 },
  comingSoonSubtitle: { fontSize: 14, color: '#888', textAlign: 'center' },
  list: { paddingHorizontal: 20, paddingTop: 26, paddingBottom: 86 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    minHeight: 60,
    paddingVertical: 5,
  },
  rowDivider: { height: 0 },
  itemName: { fontSize: 16, fontWeight: '500', color: '#22253A', flex: 1 },
  itemRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: COLORS.GREY, fontSize: 15 },
  bottomAddWrap: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 8,
  },
  bottomAddBtn: {
    height: 50,
    borderRadius: 12,
    backgroundColor: COLORS.PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomAddBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 10,
    padding: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8, color: '#171928' },
  modalSubtitle: { fontSize: 16, color: '#8B90A1', marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#D7DBE8',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 12,
    height: 50,
  },
  modalBtn: {
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 12,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  modalBtnDisabled: { backgroundColor: '#BDBDBD' },
  modalBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  cancelBtn: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DDE0EA',
    borderRadius: 12,
  },
  cancelBtnText: { color: COLORS.PRIMARY, fontWeight: '700', fontSize: 14 },
});
