import { Resend } from 'resend';
import config from '../config/config.js';

const resend = new Resend(config.RESEND_API_KEY);

export const sendVerificationEmail = async (email, name, token) => {
  const link = `${config.CLIENT_URL}/verify-email?token=${token}`;
  await resend.emails.send({
    from: config.EMAIL_FROM,
    to: email,
    subject: 'Verify your email — Engageo',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Verify your email</title>
      </head>
      <body style="margin:0;padding:0;background-color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0f;padding:40px 16px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#13131a;border:1px solid #232330;border-radius:16px;overflow:hidden;">

                <!-- Brand Header -->
                <tr>
                  <td align="center" style="padding:36px 32px 0 32px;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">
                          Engageo
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Divider -->
                <tr>
                  <td style="padding:24px 32px 0 32px;">
                    <div style="height:1px;background-color:#232330;width:100%;"></div>
                  </td>
                </tr>

                <!-- Main Content -->
                <tr>
                  <td style="padding:36px 32px 8px 32px;">
                    <h1 style="margin:0 0 16px 0;font-size:22px;line-height:30px;font-weight:600;color:#ffffff;letter-spacing:-0.01em;">
                      Welcome to Engageo, ${name}
                    </h1>
                    <p style="margin:0 0 12px 0;font-size:15px;line-height:24px;color:#a1a1aa;">
                      Your account has been created successfully. To get started, please verify your email address.
                    </p>
                    <p style="margin:0;font-size:15px;line-height:24px;color:#a1a1aa;">
                      This verification link will expire in <span style="color:#e4e4e7;font-weight:500;">24 hours</span>.
                    </p>
                  </td>
                </tr>

                <!-- CTA Button -->
                <tr>
                  <td align="center" style="padding:28px 32px 8px 32px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="center" style="border-radius:8px;background-color:#6366f1;">
                          <a href="${link}" target="_blank" style="display:block;padding:14px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
                            Verify Email
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Security Note -->
                <tr>
                  <td style="padding:24px 32px 36px 32px;">
                    <div style="height:1px;background-color:#232330;width:100%;margin-bottom:24px;"></div>
                    <p style="margin:0;font-size:13px;line-height:20px;color:#71717a;">
                      If you did not create this account, you can safely ignore this email.
                    </p>
                  </td>
                </tr>

              </table>

              <!-- Footer -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
                <tr>
                  <td align="center" style="padding:24px 32px;">
                    <p style="margin:0 0 4px 0;font-size:13px;color:#52525b;">
                      Engageo — Engagement, simplified.
                    </p>
                    <p style="margin:0;font-size:12px;color:#3f3f46;">
                      © ${new Date().getFullYear()} Engageo. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  });
};

export const sendPasswordResetEmail = async (email, name, token) => {
  const link = `${config.CLIENT_URL}/reset-password?token=${token}`;
  await resend.emails.send({
    from: config.EMAIL_FROM,
    to: email,
    subject: 'Reset your password — Engageo',
    html: `
      <h2>Hey ${name},</h2>
      <p>Click below to reset your password. This link expires in 1 hour.</p>
      <a href="${link}" style="background:#4f46e5;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Reset Password</a>
      <p style="margin-top:16px;color:#666;">If you didn't request this, ignore this email.</p>
    `,
  });
};