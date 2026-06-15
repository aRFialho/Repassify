import { env } from "./config/env.js";
import { buildServer } from "./server.js";

const app = await buildServer();
await app.listen({ port: env.PORT, host: "0.0.0.0" });
