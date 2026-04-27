import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { httpLogger, logger } from "./lib/logger.js";
import { errorHandler } from "./middleware/error-handler.js";
import { router } from "./routes.js";

const app = express();

app.use(httpLogger);
app.use(cors());
app.use(express.json());
app.use("/api", router);

app.get("/health", (_request, response) => {
	response.status(200).json({ message: "OK" });
});

app.use(errorHandler);

const PORT = env.PORT;

app.listen(PORT, () => {
	logger.info(`Server running on port ${PORT}`);
});
