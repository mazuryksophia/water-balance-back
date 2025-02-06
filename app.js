import express from "express";
import morgan from "morgan";
import cors from "cors";
import "dotenv/config";
import cookieParser from "cookie-parser";

import waterRouter from "./routes/water.js";
import usersRouter from "./routes/users.js";

const corsOptions = {
  origin: ["https://mazuryksophia.github.io", "https://water-balance-back.onrender.com", "http://localhost:5173"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
};

if (process.env.NODE_ENV === "production") {
  console.log("Running in production mode");
} else {
  console.log("Running in development mode");
}

export const app = express();

app.use(morgan("tiny"));
app.use(cors(corsOptions));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Credentials", "true");
  next();
});
app.options("*", cors(corsOptions));
app.use(cookieParser());
app.use(express.json());

app.use("/api/users", usersRouter);
app.use("/api/water", waterRouter);

app.get("/", (req, res) => {
  res.json({ message: "Welcome to Water Balance API!" });
});

app.use((_, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((err, req, res, next) => {
  const { status = 500, message = "Server error" } = err;
  res.status(status).json({ message });
});
