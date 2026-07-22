import nodemailer from "nodemailer";

/**
 * Email delivery.
 *
 * When SMTP_HOST / SMTP_USER / SMTP_PASS are configured, mail goes out through
 * nodemailer. Otherwise every message is logged to the server console instead,
 * so password reset and invites stay fully usable in development without
 * credentials. Nothing silently fails.
 */

const isSmtpConfigured = () =>
  Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
  );

let cachedTransporter = null;

const getTransporter = () => {
  if (cachedTransporter) return cachedTransporter;

  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    // Port 465 is implicit TLS; everything else upgrades via STARTTLS
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return cachedTransporter;
};

/**
 * @returns {Promise<{ delivered: boolean }>} `delivered: false` means the mail
 * was only logged, which callers may surface to the client in development.
 */
export const sendEmail = async ({ to, subject, html, text }) => {
  if (!isSmtpConfigured()) {
    console.log("\n--- EMAIL (SMTP not configured, logged instead) ---");
    console.log(`To:      ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(text || html);
    console.log("--- END EMAIL ---\n");
    return { delivered: false };
  }

  try {
    await getTransporter().sendMail({
      from: process.env.SMTP_FROM || `"GPS Solar Admin" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html,
    });

    return { delivered: true };
  } catch (error) {
    // Never let a mail failure break the request that triggered it
    console.error("Send Email Error:", error);
    return { delivered: false };
  }
};

/* ---------------------------------------------------------------- templates */

const BRAND = "GPS Solar";

/** Minimal, client-safe HTML shell shared by both templates. */
const layout = ({ heading, body, buttonLabel, buttonUrl, footer }) => `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f8fafc;padding:32px">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e2e8f0">
      <h1 style="margin:0 0 8px;font-size:20px;color:#0f172a">${heading}</h1>
      <p style="margin:0 0 24px;font-size:14px;line-height:22px;color:#475569">${body}</p>
      <a href="${buttonUrl}"
         style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600">
        ${buttonLabel}
      </a>
      <p style="margin:24px 0 0;font-size:12px;line-height:20px;color:#94a3b8">
        ${footer}<br/><br/>
        If the button does not work, copy this link into your browser:<br/>
        <span style="color:#64748b;word-break:break-all">${buttonUrl}</span>
      </p>
    </div>
  </div>
`;

export const sendPasswordResetEmail = ({ to, name, resetUrl }) =>
  sendEmail({
    to,
    subject: `Reset your ${BRAND} password`,
    text: `Hi ${name},\n\nReset your password using this link (valid for 1 hour):\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: layout({
      heading: "Reset your password",
      body: `Hi ${name}, we received a request to reset your ${BRAND} admin password. This link is valid for one hour.`,
      buttonLabel: "Reset password",
      buttonUrl: resetUrl,
      footer:
        "If you did not request a password reset, you can safely ignore this email — your password will not change.",
    }),
  });

export const sendInviteEmail = ({ to, inviterName, role, inviteUrl }) =>
  sendEmail({
    to,
    subject: `You have been invited to ${BRAND} Admin`,
    text: `${inviterName} invited you to join the ${BRAND} admin panel as ${role}.\n\nAccept your invite (valid for 7 days):\n${inviteUrl}`,
    html: layout({
      heading: `You have been invited to ${BRAND}`,
      body: `${inviterName} invited you to join the ${BRAND} admin panel as <strong>${role}</strong>. Set your password to activate your account.`,
      buttonLabel: "Accept invitation",
      buttonUrl: inviteUrl,
      footer: "This invitation expires in 7 days.",
    }),
  });
