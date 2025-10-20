# CORS Proxy Cloudflare Worker

This is a proxy built on [Hono](https://hono.dev/) as a part of the [GitDigest](https://g.abhi.now) project to handle CORS for GitHub, GitLab, and (potentially) Bitbucket.

## Setup

To test Cloudflare Workers, you need to have [Wrangler](https://developers.cloudflare.com/workers/wrangler/) installed and configured. After that, you can run the following commands to get started.

```txt
pnpm install
pnpm dev
```

## Deployment

To deploy the Worker to Cloudflare, run:

```txt
pnpm run deploy
```

You'll have to change some of the origin URLs in `src/index.ts` to point to your deployed Worker URL.

## Logging

Logs are non-intrusive and do not use emojis. Messages are prefixed by level:

- INFO | message
- WARNING | message
- ERROR | message

```ts
const logger = {
  info: (...args: unknown[]) => {
    // INFO level
    console.log("INFO |", ...args);
  },
  warn: (...args: unknown[]) => {
    // WARNING level
    console.warn("WARNING |", ...args);
  },
  error: (...args: unknown[]) => {
    // ERROR level
    console.error("ERROR |", ...args);
  },
};

logger.info("Starting server");
logger.warn("Rate limit approaching");
logger.error("Unexpected failure", err);
```
