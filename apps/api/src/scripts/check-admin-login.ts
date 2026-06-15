import { buildServer } from "../server.js";

const email = process.env.REPASSIFY_ADMIN_EMAIL ?? "admin@repassify.com";
const password = process.env.REPASSIFY_ADMIN_PASSWORD;

if (!password) {
  throw new Error("REPASSIFY_ADMIN_PASSWORD is required.");
}

const app = await buildServer();

try {
  const response = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: { email, password }
  });

  const body = response.json();
  console.log(
    JSON.stringify({
      statusCode: response.statusCode,
      mfaRequired: body.data?.mfaRequired ?? null,
      hasAccessToken: typeof body.data?.accessToken === "string",
      hasRefreshToken: typeof body.data?.refreshToken === "string"
    })
  );

  if (response.statusCode !== 200 || !body.data?.accessToken || !body.data?.refreshToken) {
    process.exitCode = 1;
  }
} finally {
  await app.close();
}
