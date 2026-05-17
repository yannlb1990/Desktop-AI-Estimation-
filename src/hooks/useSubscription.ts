import { getSubscriptionStatus, SubscriptionStatus } from '@/lib/subscription';

export function useSubscription(): SubscriptionStatus {
  return getSubscriptionStatus();
}
