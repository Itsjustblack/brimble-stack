import express from "express";
import cors from "cors";
import { router } from "./routes.js";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error-handler.js";
import { logger } from "./lib/logger.js";

const app = express();

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
