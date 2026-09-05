import "dotenv/config";
import { createApp } from "./app.js";

const PORT = Number(process.env.PORT ?? 4000);
const app = createApp();

app.listen(PORT, () => {
  console.log(`DealFlow360 API running on http://localhost:${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log(`API v1: http://localhost:${PORT}/api/v1`);
});
