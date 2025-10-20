import { Hono } from "hono";
import { cors } from "hono/cors";
import { ContentfulStatusCode } from "hono/utils/http-status";

type Bindings = {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GITLAB_CLIENT_ID: string;
  GITLAB_CLIENT_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

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

const logger = {
  info: (...args: unknown[]) => {
    // INFO level
    // eslint-disable-next-line no-console
    console.log("INFO |", ...args);
  },
  warn: (...args: unknown[]) => {
    // WARNING level
    // eslint-disable-next-line no-console
    console.warn("WARNING |", ...args);
  },
  error: (...args: unknown[]) => {
    // ERROR level
    // eslint-disable-next-line no-console
    console.error("ERROR |", ...args);
  },
};

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

// Config endpoint - provides client IDs to frontend
app.get("/config", (c) => {
  return c.json({
    github: {
      clientId: c.env.GITHUB_CLIENT_ID,
    },
    gitlab: {
      clientId: c.env.GITLAB_CLIENT_ID,
    },
  });
});

// OAuth token proxy - handles client_secret injection
app.post("/oauth", async (c) => {
  const targetUrl = c.req.query("url");

  if (!targetUrl || !ALLOWED_OAUTH_ENDPOINTS.includes(targetUrl)) {
    return c.json({ error: "Invalid or unauthorized URL" }, 400);
  }

  try {
    const body = await c.req.text();
    const params = new URLSearchParams(body);

    // Determine provider and inject credentials
    if (targetUrl.includes("github.com")) {
      params.set("client_id", c.env.GITHUB_CLIENT_ID);
      params.set("client_secret", c.env.GITHUB_CLIENT_SECRET);
    } else if (targetUrl.includes("gitlab.com")) {
      params.set("client_id", c.env.GITLAB_CLIENT_ID);
      params.set("client_secret", c.env.GITLAB_CLIENT_SECRET);
    }

  logger.info("Token exchange for:", targetUrl);

    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: params.toString(),
    });

    const data = await response.json();

    if (!response.ok || (data as { error?: string }).error) {
      logger.error("Token exchange failed:", data);
    } else {
      logger.info("Token exchange successful");
    }

    return c.json(data, response.status as ContentfulStatusCode);
  } catch (err) {
    const error = err as Error;
    logger.error("Proxy error:", error);
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

  const isAllowed = ALLOWED_API_ENDPOINTS.some((endpoint) =>
    targetUrl.startsWith(endpoint)
  );

  if (!isAllowed) {
    return c.json({ error: "Invalid or unauthorized URL" }, 400);
  }

  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": "GitDigest-App/1.0",
    };

    if (authHeader) {
      headers["Authorization"] = authHeader;
    }

    const response = await fetch(targetUrl, {
      method: "GET",
      headers,
    });

  const text = await response.text();
  logger.info("Response (first 200 chars):", text.substring(0, 200));

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      logger.error("Non-JSON response");
      return c.json(
        {
          error: "Invalid response type", 
          details: text.substring(0, 500),
          status: response.status 
        },
        500
      );
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      logger.error("JSON parse failed");
      return c.json(
        { 
          error: "Failed to parse JSON", 
          details: text.substring(0, 500) 
        },
        500
      );
    }

    if (!response.ok) {
      logger.error("API error:", data);
      return c.json(
        { 
          error: "API request failed", 
          details: data.message || JSON.stringify(data),
          status: response.status 
        },
        response.status as ContentfulStatusCode
      );
    }

    logger.info("API success");
    return c.json(data, response.status as ContentfulStatusCode);
  } catch (err) {
    const error = err as Error;
    logger.error("Error:", error);
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
      config: "GET /config",
      oauth: "POST /oauth?url=<encoded-oauth-endpoint>",
      api: "GET /apis?url=<encoded-api-endpoint>",
    },
  });
});

export default app;