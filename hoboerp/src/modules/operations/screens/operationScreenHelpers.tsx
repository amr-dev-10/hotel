import {useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, Text, View} from 'react-native';

import {blue, styles} from '../../../theme/styles';
import type {TicketView} from '../../dashboard';
import {firstRecordValue} from '../../../utils/dataUtils';

const PAGE_SIZE = 12;

export function useScrollPagination<T>(items: T[], pageSize = PAGE_SIZE) {
  const [visibleCount, setVisibleCount] = useState(pageSize);

  useEffect(() => {
    setVisibleCount(pageSize);
  }, [items, pageSize]);

  const visibleItems = useMemo(
    () => items.slice(0, visibleCount),
    [items, visibleCount],
  );
  const hasMore = visibleCount < items.length;
  const loadMore = () => {
    if (hasMore) {
      setVisibleCount(current => Math.min(current + pageSize, items.length));
    }
  };

  return {hasMore, loadMore, visibleItems};
}

export function ListFooter({hasMore, loading}: {hasMore: boolean; loading?: boolean}) {
  return (
    <View style={styles.listFooter}>
      {loading ? <ActivityIndicator color={blue} size="small" /> : null}
      <Text style={styles.listFooterText}>
        {loading ? 'Loading records...' : hasMore ? 'Scroll for more' : 'All records loaded'}
      </Text>
    </View>
  );
}

export function handleScrollLoadMore(loadMore: () => void) {
  return ({nativeEvent}: {nativeEvent: {contentOffset: {y: number}; contentSize: {height: number}; layoutMeasurement: {height: number}}}) => {
    const distanceFromBottom =
      nativeEvent.contentSize.height -
      (nativeEvent.contentOffset.y + nativeEvent.layoutMeasurement.height);
    if (distanceFromBottom < 72) {
      loadMore();
    }
  };
}

export function isTicketAssignedToUser(ticket: TicketView, userId: string) {
  if (!userId) {
    return false;
  }

  const assignedTo = firstRecordValue(ticket.raw, [
    'assigned_to',
    'assigned_to_id',
    'assigned_staff_id',
    'assignee_id',
    'owner_id',
  ]);
  return assignedTo === userId;
}
