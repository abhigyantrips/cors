import { Hono } from "hono";
import { cors } from "hono/cors";
import { ContentfulStatusCode } from "hono/utils/http-status";

const app = new Hono();

// Whitelist for security
const ALLOWED_ENDPOINTS = [
  "https://github.com/login/oauth/access_token",
  "https://gitlab.com/oauth/token",
  "https://bitbucket.org/site/oauth2/access_token",
];

// Apply CORS with origin restriction
app.use(
  "*",
  cors({
    origin: (origin) => {
      // Allow *.abhi.now and localhost:*
      if (
        origin.endsWith(".abhi.now") ||
        origin === "https://abhi.now" ||
        origin.startsWith("http://localhost:")
      ) {
        return origin;
      }

      // Deny others
      return "https://g.abhi.now"; // fallback
    },
    allowMethods: ["POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Accept"],
    maxAge: 86400,
    credentials: false,
  })
);

// Proxy endpoint
app.post("/oauth", async (c) => {
  const targetUrl = c.req.query("url");

  // Validate URL
  if (!targetUrl || !ALLOWED_ENDPOINTS.includes(targetUrl)) {
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

// Health check
app.get("/", (c) => {
  return c.json({
    status: "ok",
    usage: "POST /oauth?url=<encoded-oauth-endpoint>",
  });
});

export default app;