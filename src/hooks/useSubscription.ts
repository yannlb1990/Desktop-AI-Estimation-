import { useState, useEffect } from 'react';
import { getSubscriptionStatus, SubscriptionStatus } from '@/lib/subscription';

export function useSubscription(): SubscriptionStatus {
  const [status, setStatus] = useState<SubscriptionStatus>(() => getSubscriptionStatus());

  useEffect(() => {
    const refresh = () => setStatus(getSubscriptionStatus());

    // Cross-tab: storage events fire when another tab writes localStorage
    window.addEventListener('storage', refresh);

    // Same-tab: poll every 10s to catch in-tab writes (e.g. post-checkout sync)
    const interval = setInterval(refresh, 10_000);

    return () => {
      window.removeEventListener('storage', refresh);
      clearInterval(interval);
    };
  }, []);

  return status;
}
