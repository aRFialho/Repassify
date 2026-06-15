import type { FastifyInstance } from "fastify";
import { registerAuthRoutes } from "./auth.js";
import { registerChannelRoutes } from "./channels.js";
import { registerCompanyRoutes } from "./companies.js";
import { registerFeeRuleRoutes } from "./fee-rules.js";
import { registerHelpRoutes } from "./help.js";
import { registerImportRoutes } from "./imports.js";
import { registerPayoutCenterRoutes } from "./payout-center.js";
import { registerReconciliationRoutes } from "./reconciliation.js";
import { registerRulesRoutes } from "./rules.js";
import { registerTenantRoutes } from "./tenants.js";
import { registerUserRoutes } from "./users.js";

export async function registerRoutes(app: FastifyInstance) {
  await registerAuthRoutes(app);
  await registerTenantRoutes(app);
  await registerChannelRoutes(app);
  await registerCompanyRoutes(app);
  await registerFeeRuleRoutes(app);
  await registerUserRoutes(app);
  await registerImportRoutes(app);
  await registerPayoutCenterRoutes(app);
  await registerRulesRoutes(app);
  await registerReconciliationRoutes(app);
  await registerHelpRoutes(app);
}
