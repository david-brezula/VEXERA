// Notifications feature — barrel export

// Service (server-side)
export {
  createNotification,
  createNotificationForAllMembers,
  listNotifications,
  markNotificationsRead,
  countUnreadNotifications,
  type ListNotificationsOptions,
} from "./service"

// Email service (server-side)
export {
  sendEmail,
  sendNotificationEmail,
  sendDocumentReadyEmail,
  sendWeeklyDigest,
} from "./email.service"

// Email tracking (server-side)
export {
  createTracking,
  getTrackingPixelUrl,
  getTrackingPixelHtml,
  recordOpen,
  getTrackingForInvoice,
  listTracking,
  type EmailTrackingRecord,
} from "./email-tracking.service"

// Gmail OAuth2 + message fetching (server-side)
export {
  buildAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  listMessagesWithAttachments,
  getMessage,
  downloadAttachment,
  type GmailTokens,
  type GmailMessageStub,
  type GmailAttachment,
  type GmailMessage,
} from "./gmail.service"

// Client hooks
export {
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
} from "./hooks"

// Data (server-side)
export {
  getInboxDocuments,
  getInboxStats,
  type InboxDocument,
  type InboxStats,
} from "./data"

// Components
export { InboxClient } from "./components/inbox-client"
