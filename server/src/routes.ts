import { Router } from "express";
import { deploymentRouter } from "./modules/deployment/routes.js";

const router = Router();

router.use("/deployments", deploymentRouter);

export { router };
