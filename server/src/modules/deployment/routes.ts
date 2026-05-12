import { Router } from "express";
import {
	createDeploymentHandler,
	deleteDeploymentHandler,
	getDeploymentBySlugHandler,
	startDeploymentHandler,
	stopDeploymentHandler,
	streamDeploymentLogsHandler,
	streamDeploymentsHandler,
	updateDeploymentHandler,
} from "./deployment.controller.js";

const deploymentRouter = Router();

deploymentRouter.post("/", createDeploymentHandler);
deploymentRouter.get("/", streamDeploymentsHandler);
deploymentRouter.get("/:slug/logs", streamDeploymentLogsHandler);
deploymentRouter.get("/:slug", getDeploymentBySlugHandler);
deploymentRouter.post("/:slug/start", startDeploymentHandler);
deploymentRouter.post("/:slug/stop", stopDeploymentHandler);
deploymentRouter.patch("/:slug", updateDeploymentHandler);
deploymentRouter.delete("/:slug", deleteDeploymentHandler);

export { deploymentRouter };
