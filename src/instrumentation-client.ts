// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a user loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import {
  sentryDsn,
  sentryEnabled,
  sentryEnvironment,
  sentryRelease,
  sentryReplayErrorSampleRate,
  sentryReplaySessionSampleRate,
  sentryTracesSampleRate,
} from "@/lib/env";
import { sentryPrivacyOptions } from "@/lib/observability/sentry-options";

const dsn = sentryDsn();

Sentry.init({
  dsn,
  enabled: sentryEnabled(),
  environment: sentryEnvironment(),
  release: sentryRelease(),
  ...sentryPrivacyOptions,
  integrations: [Sentry.replayIntegration({
    maskAllText: true,
    maskAllInputs: true,
    blockAllMedia: true,
    networkCaptureBodies: false,
    networkDetailAllowUrls: [],
    networkRequestHeaders: [],
    networkResponseHeaders: [],
    // DOM snapshots remain masked; custom frames can contain raw console text,
    // selectors, keystrokes or network URLs outside beforeSend's protection.
    beforeAddRecordingEvent: (event) => event.data.tag === "options" ? event : null,
  })],
  tracesSampleRate: sentryTracesSampleRate(),
  replaysSessionSampleRate: sentryReplaySessionSampleRate(),
  replaysOnErrorSampleRate: sentryReplayErrorSampleRate(),
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
