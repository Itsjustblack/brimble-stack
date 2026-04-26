import { Router } from "express";
import {
	createDeploymentHandler,
	deleteDeploymentHandler,
	getDeploymentByIdHandler,
	getDeploymentsHandler,
	updateDeploymentHandler,
} from "./deployment.controller.js";

const deploymentRouter = Router();

deploymentRouter.post("/", createDeploymentHandler);
deploymentRouter.get("/", getDeploymentsHandler);
deploymentRouter.get("/:id", getDeploymentByIdHandler);
deploymentRouter.patch("/:id", updateDeploymentHandler);
deploymentRouter.delete("/:id", deleteDeploymentHandler);

export { deploymentRouter };
