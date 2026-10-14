// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import {
  sentryDsn,
  sentryEnabled,
  sentryEnvironment,
  sentryRelease,
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
  tracesSampleRate: sentryTracesSampleRate(),
});
