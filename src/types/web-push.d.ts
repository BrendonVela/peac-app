// Minimal types for the `web-push` package (only what PEAC uses)
declare module 'web-push' {
  export interface PushSubscription {
    endpoint: string
    keys: { p256dh: string; auth: string }
  }
  export interface SendResult { statusCode: number; body: string }
  export interface WebPushError extends Error { statusCode: number }
  export function setVapidDetails(subject: string, publicKey: string, privateKey: string): void
  export function sendNotification(
    subscription: PushSubscription,
    payload?: string,
    options?: { TTL?: number; urgency?: 'very-low' | 'low' | 'normal' | 'high' }
  ): Promise<SendResult>
  const webpush: {
    setVapidDetails: typeof setVapidDetails
    sendNotification: typeof sendNotification
  }
  export default webpush
}
