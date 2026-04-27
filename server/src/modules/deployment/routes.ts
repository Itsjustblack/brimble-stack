import { Router } from "express";
import {
	createDeploymentHandler,
	deleteDeploymentHandler,
	getDeploymentByIdHandler,
	getAllDeploymentsHandler,
	streamDeploymentLogsHandler,
	updateDeploymentHandler,
} from "./deployment.controller.js";

const deploymentRouter = Router();

deploymentRouter.post("/", createDeploymentHandler);
deploymentRouter.get("/", getAllDeploymentsHandler);
deploymentRouter.get("/:id/logs", streamDeploymentLogsHandler);
deploymentRouter.get("/:id", getDeploymentByIdHandler);
deploymentRouter.patch("/:id", updateDeploymentHandler);
deploymentRouter.delete("/:id", deleteDeploymentHandler);

export { deploymentRouter };
