import { Router } from "express";
import { deploymentRouter } from "./modules/deployment/routes.js";
import { envRouter } from "./modules/env/routes.js";

const router = Router();

router.use("/deployments", deploymentRouter);
router.use("/deployments/:slug/env", envRouter);

export { router };
