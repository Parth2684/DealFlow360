import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { HttpError } from "./errors.js";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}
export type EmailSender = (
  message: EmailMessage,
  deliveryKey: string,
) => Promise<void>;
export const emailConfigured = () => Boolean(env.SMTP_USER && env.SMTP_PASS);

export function createEmailSender(config: {
  host: string;
  port: number;
  from: string;
  user?: string;
  password?: string;
  requireTLS?: boolean;
}): EmailSender {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    requireTLS: config.requireTLS ?? true,
    auth:
      config.user && config.password
        ? { user: config.user, pass: config.password }
        : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    logger: false,
    debug: false,
  });
  return async (message, deliveryKey) => {
    try {
      const result = await transport.sendMail({
        ...message,
        from: config.from,
        messageId: `<${deliveryKey}@dealflow360.local>`,
        disableFileAccess: true,
        disableUrlAccess: true,
      });
      if (!result.accepted?.length || result.rejected?.length)
        throw new Error("Recipient rejected");
    } catch {
      throw new HttpError(
        503,
        "Email unavailable",
        "The email could not be sent. Check SMTP settings and retry.",
        { code: "EMAIL_UNAVAILABLE" },
      );
    }
  };
}

let sender: EmailSender | undefined;
export const deliverEmail: EmailSender = async (message, deliveryKey) => {
  if (!emailConfigured())
    throw new HttpError(
      503,
      "Email unavailable",
      "Set SMTP_USER and SMTP_PASS in the API environment before sending emails.",
      { code: "EMAIL_UNAVAILABLE" },
    );
  sender ??= createEmailSender({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    from: env.SMTP_FROM || env.SMTP_USER!,
    user: env.SMTP_USER,
    password: env.SMTP_PASS,
  });
  await sender(message, deliveryKey);
};
