const nodemailer = require("nodemailer");

function mailConfigured() {
  return Boolean(process.env.RESEND_API_KEY || process.env.SMTP_HOST);
}

function fromAddress() {
  return process.env.MAIL_FROM || process.env.SMTP_USER || "Gigachad TCG <noreply@localhost>";
}

async function sendMail({ to, subject, text, html }) {
  if (process.env.RESEND_API_KEY) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: [to],
        subject,
        text,
        html: html || undefined
      })
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Resend failed (${res.status}): ${body.slice(0, 200)}`);
    }
    return;
  }

  if (!process.env.SMTP_HOST) {
    throw new Error("Mail is not configured");
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined
  });

  await transporter.sendMail({
    from: fromAddress(),
    to,
    subject,
    text,
    html
  });
}

async function sendPasswordResetEmail(to, url) {
  const subject = "Reset your Gigachad TCG password";
  const text = [
    "Someone asked to reset the password for this Gigachad TCG account.",
    "",
    `Open this link within 1 hour to choose a new password:`,
    url,
    "",
    "If you did not ask for this, you can ignore this email."
  ].join("\n");
  const html = `<p>Someone asked to reset the password for this Gigachad TCG account.</p>
<p><a href="${url}">Choose a new password</a> (link expires in 1 hour).</p>
<p>If you did not ask for this, you can ignore this email.</p>`;
  await sendMail({ to, subject, text, html });
}

module.exports = { mailConfigured, sendMail, sendPasswordResetEmail, fromAddress };
