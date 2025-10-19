import { Hono } from "hono";
import { cors } from "hono/cors";
import { ContentfulStatusCode } from "hono/utils/http-status";

const app = new Hono();

// OAuth token endpoints
const ALLOWED_OAUTH_ENDPOINTS = [
  "https://github.com/login/oauth/access_token",
  "https://gitlab.com/oauth/token",
  "https://bitbucket.org/site/oauth2/access_token",
];

// API endpoints for user/repo fetching
const ALLOWED_API_ENDPOINTS = [
  "https://api.github.com/user",
  "https://api.github.com/user/repos",
  "https://gitlab.com/api/v4/user",
  "https://gitlab.com/api/v4/projects",
  "https://api.bitbucket.org/2.0/user",
  "https://api.bitbucket.org/2.0/repositories",
];

// Apply CORS
app.use(
  "*",
  cors({
    origin: (origin) => {
      if (
        origin.endsWith(".abhi.now") ||
        origin === "https://abhi.now" ||
        origin.startsWith("http://localhost:")
      ) {
        return origin;
      }
      return "https://g.abhi.now";
    },
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Accept", "Authorization"],
    maxAge: 86400,
    credentials: false,
  })
);

// OAuth token proxy
app.post("/oauth", async (c) => {
  const targetUrl = c.req.query("url");

  if (!targetUrl || !ALLOWED_OAUTH_ENDPOINTS.includes(targetUrl)) {
    return c.json({ error: "Invalid or unauthorized URL" }, 400);
  }

  try {
    const body = await c.req.text();

    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body,
    });

    const data = await response.json();
    return c.json(data, response.status as ContentfulStatusCode);
  } catch (err) {
    const error = err as Error;
    return c.json(
      { error: "Proxy request failed", details: error.message },
      500
    );
  }
});

// API proxy (for user/repo fetching)
app.get("/apis", async (c) => {
  const targetUrl = c.req.query("url");
  const authHeader = c.req.header("Authorization");

  if (!targetUrl) {
    return c.json({ error: "Missing url parameter" }, 400);
  }

  // Check if URL starts with any allowed API endpoint
  const isAllowed = ALLOWED_API_ENDPOINTS.some((endpoint) =>
    targetUrl.startsWith(endpoint)
  );

  if (!isAllowed) {
    return c.json({ error: "Invalid or unauthorized URL" }, 400);
  }

  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (authHeader) {
      headers["Authorization"] = authHeader;
    }

    const response = await fetch(targetUrl, {
      method: "GET",
      headers,
    });

    const data = await response.json();
    return c.json(data, response.status as ContentfulStatusCode);
  } catch (err) {
    const error = err as Error;
    return c.json(
      { error: "API request failed", details: error.message },
      500
    );
  }
});

// Health check
app.get("/", (c) => {
  return c.json({
    status: "ok",
    endpoints: {
      oauth: "POST /oauth-proxy?url=<encoded-oauth-endpoint>",
      api: "GET /api-proxy?url=<encoded-api-endpoint>",
    },
  });
});

export default app;