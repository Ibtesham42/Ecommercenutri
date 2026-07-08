/**
 * Central place to check which integrations are configured.
 * Every integration in Nutriyet has a graceful keyless fallback, so these
 * helpers let feature code decide between "live" and "stub" behavior.
 *
 * NOTE: only reference *server* secrets in server code. NEXT_PUBLIC_* values
 * are safe on the client.
 */

export const env = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",

  databaseUrl: process.env.DATABASE_URL ?? "",

  authSecret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "",
  googleId: process.env.AUTH_GOOGLE_ID ?? "",
  googleSecret: process.env.AUTH_GOOGLE_SECRET ?? "",

  resendApiKey: process.env.RESEND_API_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "Nutriyet <noreply@nutriyet.in>",

  // Custom SMTP (preferred over Resend when configured).
  smtpHost: process.env.SMTP_HOST ?? "",
  smtpPort: process.env.SMTP_PORT ?? "",
  smtpSecure: process.env.SMTP_SECURE ?? "",
  smtpUser: process.env.SMTP_USER ?? "",
  smtpPass: process.env.SMTP_PASS ?? "",

  razorpayKeyId: process.env.RAZORPAY_KEY_ID ?? "",
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET ?? "",
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? "",

  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME ?? "",
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY ?? "",
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET ?? "",
  cloudinaryUploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET ?? "nutriyet",

  groqApiKey: process.env.GROQ_API_KEY ?? "",
  groqModel: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",

  upstashUrl: process.env.UPSTASH_REDIS_REST_URL ?? "",
  upstashToken: process.env.UPSTASH_REDIS_REST_TOKEN ?? "",

  // Privacy-friendly analytics (Plausible / Umami-compatible). All optional.
  analyticsSrc: process.env.NEXT_PUBLIC_ANALYTICS_SRC ?? "",
  analyticsDomain: process.env.NEXT_PUBLIC_ANALYTICS_DOMAIN ?? "",

  // Marketing channels (all optional — each adapter no-ops until configured).
  // Web Push (VAPID). Generate a keypair with `npx web-push generate-vapid-keys`.
  vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ?? "",
  vapidSubject: process.env.VAPID_SUBJECT ?? "mailto:support@nutriyet.in",

  // WhatsApp Cloud API (Meta).
  whatsappToken: process.env.WHATSAPP_TOKEN ?? "",
  whatsappPhoneId: process.env.WHATSAPP_PHONE_ID ?? "",

  // SMS via Twilio.
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? "",
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? "",
  twilioFrom: process.env.TWILIO_FROM ?? "",

  // Login OTP SMS via MSG91 (India, DLT-approved OTP template).
  msg91AuthKey: process.env.MSG91_AUTH_KEY ?? "",
  msg91TemplateId: process.env.MSG91_TEMPLATE_ID ?? "",

  // AI Marketing — Instagram publishing via the Meta Graph API. Optional: the
  // social automation degrades to draft/mock-publish until these are set. The
  // token belongs to an Instagram Business/Creator account. Aliases accept the
  // older key names too. See docs/social-automation.md.
  instagramAccessToken:
    process.env.INSTAGRAM_ACCESS_TOKEN ?? process.env.INSTA_AUTOGRAPH_TOKEN ?? "",
  instagramBusinessId:
    process.env.INSTAGRAM_BUSINESS_ID ?? process.env.INSTAGRAM_ACCOUNT_ID ?? "",
  instagramApiVersion: process.env.INSTAGRAM_API_VERSION ?? "v21.0",
  // Optional override for the Graph host. When unset it's auto-detected from the
  // token: IGAA… (Instagram Login) → graph.instagram.com, else graph.facebook.com.
  instagramApiBase: process.env.INSTAGRAM_API_BASE ?? "",

  // Shared secret guarding the social cron endpoint (GitHub Actions sends it as
  // `Authorization: Bearer <CRON_SECRET>`). Reused by the marketing cron too.
  cronSecret: process.env.CRON_SECRET ?? "",
};

export const isConfigured = {
  google: () => Boolean(env.googleId && env.googleSecret),
  resend: () => Boolean(env.resendApiKey),
  smtp: () => Boolean(env.smtpHost && env.smtpUser && env.smtpPass),
  // Either transport means transactional email can actually be delivered.
  email: () => Boolean(env.smtpHost && env.smtpUser && env.smtpPass) || Boolean(env.resendApiKey),
  razorpay: () => Boolean(env.razorpayKeyId && env.razorpayKeySecret),
  cloudinary: () =>
    Boolean(
      env.cloudinaryCloudName && env.cloudinaryApiKey && env.cloudinaryApiSecret,
    ),
  groq: () => Boolean(env.groqApiKey),
  redis: () => Boolean(env.upstashUrl && env.upstashToken),
  analytics: () => Boolean(env.analyticsSrc && env.analyticsDomain),
  webPush: () => Boolean(env.vapidPublicKey && env.vapidPrivateKey),
  whatsapp: () => Boolean(env.whatsappToken && env.whatsappPhoneId),
  sms: () => Boolean(env.twilioAccountSid && env.twilioAuthToken && env.twilioFrom),
  msg91: () => Boolean(env.msg91AuthKey && env.msg91TemplateId),
  instagram: () => Boolean(env.instagramAccessToken && env.instagramBusinessId),
};
