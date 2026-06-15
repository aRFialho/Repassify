import { describe, expect, it } from "vitest";
import { buildServer } from "../server.js";

describe("auth routes", () => {
  it("returns a short lived access token on login", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        email: "owner@repassify.local",
        password: "password"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.accessToken).toBeTypeOf("string");
    await app.close();
  });
});
