import nodemailer from 'nodemailer';
import config from '@/config';
import logger from '@/utils/logger';

export class EmailService {
  private static transporter: nodemailer.Transporter | null = null;

  private static getTransporter(): nodemailer.Transporter {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.port === 465,
        auth: {
          user: config.smtp.user,
          pass: config.smtp.pass,
        },
      });
    }
    return this.transporter;
  }

  private static async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    try {
      const info = await this.getTransporter().sendMail({
        from: config.smtp.from,
        to,
        subject,
        html,
      });

      logger.info(`📧 Email sent successfully to ${to}. MessageId: ${info.messageId}`);
      return true;
    } catch (error) {
      logger.error(`❌ Failed to send email to ${to}:`, error);
      // In production, we don't throw to prevent auth flow crashes, but we return false
      return false;
    }
  }

  public static async sendVerificationEmail(to: string, token: string): Promise<boolean> {
    const verificationUrl = `${config.frontendUrl}/verify-email?token=${token}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #4F46E5; text-align: center;">Verify Your Email Address</h2>
        <p>Thank you for signing up! To complete your registration, please click the button below to verify your email address:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Verify Email Address</a>
        </div>
        <p>This verification link will expire in 24 hours.</p>
        <p>If you didn't create an account, you can safely ignore this email.</p>
        <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 20px 0;" />
        <p style="font-size: 12px; color: #888; text-align: center;">&copy; SaaS Platform, Inc. All rights reserved.</p>
      </div>
    `;

    return this.sendEmail(to, 'Verify your email address', html);
  }

  public static async sendPasswordResetEmail(to: string, token: string): Promise<boolean> {
    const resetUrl = `${config.frontendUrl}/reset-password?token=${token}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #4F46E5; text-align: center;">Reset Your Password</h2>
        <p>You requested a password reset for your account. Please click the button below to reset your password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #EF4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Reset Password</a>
        </div>
        <p>This link is valid for 1 hour. If you did not make this request, please ignore this email; your password will remain unchanged.</p>
        <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 20px 0;" />
        <p style="font-size: 12px; color: #888; text-align: center;">&copy; SaaS Platform, Inc. All rights reserved.</p>
      </div>
    `;

    return this.sendEmail(to, 'Reset your password', html);
  }
}

export default EmailService;
