import { useMemo } from 'react';
import { getSubscriptionStatus, SubscriptionStatus } from '@/lib/subscription';

export function useSubscription(): SubscriptionStatus {
  // Re-compute on every render — localStorage reads are cheap and this avoids
  // needing a context provider while keeping reactivity on navigation.
  return useMemo(() => getSubscriptionStatus(), []);
}
