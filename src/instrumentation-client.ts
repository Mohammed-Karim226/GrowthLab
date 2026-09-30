// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a user loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import {
  sentryDsn,
  sentryEnvironment,
  sentryRelease,
  sentryReplayErrorSampleRate,
  sentryReplaySessionSampleRate,
  sentryTracesSampleRate,
} from "@/lib/env";

const dsn = sentryDsn();

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: sentryEnvironment(),
  release: sentryRelease(),
  sendDefaultPii: false,
  integrations: [Sentry.replayIntegration()],
  tracesSampleRate: sentryTracesSampleRate(),
  replaysSessionSampleRate: sentryReplaySessionSampleRate(),
  replaysOnErrorSampleRate: sentryReplayErrorSampleRate(),
  beforeSend(event) {
    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
      delete event.user.username;
    }

    if (event.request?.headers) {
      delete event.request.headers.authorization;
      delete event.request.headers.cookie;
      delete event.request.headers["x-forwarded-for"];
    }

    return event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
