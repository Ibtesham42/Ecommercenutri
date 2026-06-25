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
};

export const isConfigured = {
  google: () => Boolean(env.googleId && env.googleSecret),
  resend: () => Boolean(env.resendApiKey),
  razorpay: () => Boolean(env.razorpayKeyId && env.razorpayKeySecret),
  cloudinary: () =>
    Boolean(
      env.cloudinaryCloudName && env.cloudinaryApiKey && env.cloudinaryApiSecret,
    ),
  groq: () => Boolean(env.groqApiKey),
  redis: () => Boolean(env.upstashUrl && env.upstashToken),
  analytics: () => Boolean(env.analyticsSrc && env.analyticsDomain),
};
