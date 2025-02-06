import mongoose from "mongoose";
import { app } from "./app.js";

mongoose.set("strictQuery", true);

const { DB_HOST, PORT = 4444} = process.env;

mongoose
  .connect(DB_HOST)
  .then(() => {
    app.listen(PORT);
    console.log("Database connection successful, port:", `${PORT}`);
  })
  .catch((error) => {
    console.log(error.message);
    process.exit(1);
  });
