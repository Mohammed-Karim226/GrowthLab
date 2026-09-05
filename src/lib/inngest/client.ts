import { Inngest } from "inngest";

// Vercel deployments must always use Inngest Cloud. Deriving this from the
// framework environment prevents a leftover local `INNGEST_DEV=1` variable
// from sending production events to localhost.
export const inngest = new Inngest({
  id: "project0",
  isDev: process.env.NODE_ENV !== "production",
});
