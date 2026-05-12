import { Router } from "express";
import {
	deleteEnvVarHandler,
	listEnvVarsHandler,
	setEnvVarsHandler,
	upsertEnvVarHandler,
} from "./env.controller.js";

const envRouter = Router({ mergeParams: true });

envRouter.get("/", listEnvVarsHandler);
envRouter.put("/", setEnvVarsHandler);
envRouter.patch("/:key", upsertEnvVarHandler);
envRouter.delete("/:key", deleteEnvVarHandler);

export { envRouter };
