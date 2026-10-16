/**
 * Messaging core used by the Vercel routes (WhatsApp Cloud API) and the
 * Vercel functions (WhatsApp Cloud API, production). Transports plug in behind Transport.
 */
export * from './ports';
export * from './templates';
export * from './gemini';
export * from './supabase-adapter';
export * from './jobs/outbox';
export * from './jobs/fanout';
export * from './jobs/inbound';
export * from './jobs/digest';
export * from './jobs/schedule';
export * from './transport-cloud';
export * from './webhook';
export * from './jobs/checks';
export * from './jobs/checks-adapter';
export * from './tick';
export * from './runtime';
