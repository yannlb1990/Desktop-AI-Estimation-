export function identify(userId: string, traits?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && (window as Window & { posthog?: { identify: (id: string, traits?: Record<string, unknown>) => void } }).posthog) {
    (window as Window & { posthog?: { identify: (id: string, traits?: Record<string, unknown>) => void } }).posthog!.identify(userId, traits)
  }
}

export function track(event: string, properties?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && (window as Window & { posthog?: { capture: (event: string, properties?: Record<string, unknown>) => void } }).posthog) {
    (window as Window & { posthog?: { capture: (event: string, properties?: Record<string, unknown>) => void } }).posthog!.capture(event, properties)
  }
}
