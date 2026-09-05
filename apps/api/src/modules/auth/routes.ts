import { Router, type Router as ExpressRouter } from "express";
import {
  loginSchema,
  signupSchema,
  Capabilities,
} from "@repo/contracts";
import { authService } from "./service.js";
import {
  asyncHandler,
  requireAuth,
  validateBody,
} from "../../middleware/validate.js";

export const authRouter: ExpressRouter = Router();

authRouter.post(
  "/signup",
  validateBody(signupSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.signup(req.body);
    authService.applySessionCookie(res, result.accessToken!);
    res.status(201).json(result);
  }),
);

authRouter.post(
  "/login",
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.login(req.body);
    authService.applySessionCookie(res, result.accessToken!);
    res.json(result);
  }),
);

authRouter.post(
  "/logout",
  requireAuth,
  asyncHandler(async (req, res) => {
    await authService.logout(req.auth?.sessionId, res);
    res.status(204).send();
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await authService.me(req.auth!.userId, req.auth!.organizationId);
    res.json({ user });
  }),
);

// Health check for auth module
authRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", module: "auth" });
});

export { Capabilities };
