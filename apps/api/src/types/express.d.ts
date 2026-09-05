import "express";
import type { AuthContext } from "../shared/context.js";

declare module "express" {
  interface Request {
    auth?: AuthContext;
  }
}
