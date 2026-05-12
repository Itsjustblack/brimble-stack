import axios from "axios";

export const apiClient = axios.create({
	baseURL: import.meta.env.VITE_API_URL,
	headers: {
		"Content-Type": "application/json",
	},
});

apiClient.interceptors.response.use(
	(response) => response,
	(error) => {
		const apiMessage = error?.response?.data?.message;
		if (apiMessage) {
			error.message = apiMessage;
		}
		return Promise.reject(error);
	},
);
