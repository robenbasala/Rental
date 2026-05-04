import sgMail from "@sendgrid/mail";
import nodemailer from "nodemailer";
import { env } from "../config/env.js";

if (env.emailProvider === "sendgrid" && env.sendGridApiKey) {
  sgMail.setApiKey(env.sendGridApiKey);
}

async function sendHtmlEmail({ to, subject, html }) {
  if (!to) return;

  if (env.emailProvider === "sendgrid") {
    await sgMail.send({
      to,
      from: env.emailFrom,
      subject,
      html
    });
    return;
  }

  const transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: {
      user: env.smtp.user,
      pass: env.smtp.pass
    }
  });

  await transporter.sendMail({
    from: env.emailFrom,
    to,
    subject,
    html
  });
}

export async function sendInvoiceEmail({ to, subject, html }) {
  return sendHtmlEmail({ to, subject, html });
}

export async function sendPasswordResetEmail({ to, resetUrl }) {
  const html = `
    <p>You requested a password reset.</p>
    <p><a href="${resetUrl}">Set a new password</a> (link expires in 1 hour).</p>
    <p>If you did not request this, you can ignore this email.</p>
  `;
  return sendHtmlEmail({
    to,
    subject: "Reset your password",
    html
  });
}
