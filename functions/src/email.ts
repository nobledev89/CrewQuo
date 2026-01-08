import { Resend } from 'resend';
import { defineSecret } from 'firebase-functions/params';

// Define Firebase secrets for email configuration
export const resendApiKey = defineSecret('RESEND_API_KEY');
export const appUrl = defineSecret('APP_URL');

// Create Resend client - called at runtime when secret is available
function getResendClient(): Resend {
  const apiKey = resendApiKey.value();
  if (!apiKey || apiKey === 'not-set') {
    console.error('RESEND_API_KEY secret not set! Emails will not be sent.');
    throw new Error('Email service not configured: RESEND_API_KEY is missing');
  }
  return new Resend(apiKey);
}

const FROM_EMAIL = 'support@crewquo.com';
const COMPANY_NAME = 'CrewQuo';

function getAppUrl(): string {
  try {
    const url = appUrl.value();
    return url && url !== 'not-set' ? url : 'https://crewquo.com';
  } catch {
    return 'https://crewquo.com';
  }
}

/**
 * Email Templates
 */

const getEmailHeader = () => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <div style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); padding: 30px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px;">${COMPANY_NAME}</h1>
      <p style="color: #e0e7ff; margin: 10px 0 0 0; font-size: 14px;">Subcontractor Management Platform</p>
    </div>
`;

const getEmailFooter = (baseUrl: string) => `
    <div style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0;">
        This email was sent from ${COMPANY_NAME}
      </p>
      <p style="color: #6b7280; font-size: 12px; margin: 0;">
        ${COMPANY_NAME} • Streamline your subcontractor management
      </p>
      <div style="margin-top: 15px;">
        <a href="${baseUrl}" style="color: #2563eb; text-decoration: none; font-size: 12px; margin: 0 10px;">Visit Website</a>
        <a href="${baseUrl}/login" style="color: #2563eb; text-decoration: none; font-size: 12px; margin: 0 10px;">Login</a>
      </div>
    </div>
  </div>
`;

/**
 * Send Subcontractor Invite Email
 */
export async function sendSubcontractorInviteEmail(
  recipientEmail: string,
  recipientName: string,
  companyName: string,
  inviteToken: string,
  inviterName?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const baseUrl = getAppUrl();
    const inviteLink = `${baseUrl}/signup/subcontractor?token=${inviteToken}`;
    
    const html = `
      ${getEmailHeader()}
      <div style="padding: 40px 30px;">
        <h2 style="color: #111827; margin: 0 0 20px 0; font-size: 24px;">You've Been Invited!</h2>
        
        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
          Hi ${recipientName},
        </p>
        
        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
          ${inviterName ? `${inviterName} from` : 'You have been invited by'} <strong>${companyName}</strong> to join their team on ${COMPANY_NAME}.
        </p>
        
        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
          ${COMPANY_NAME} makes it easy to track your work, manage projects, and stay connected with your team.
        </p>
        
        <div style="text-align: center; margin: 40px 0;">
          <a href="${inviteLink}" style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">
            Accept Invitation & Create Account
          </a>
        </div>
        
        <div style="background-color: #f3f4f6; border-left: 4px solid #2563eb; padding: 20px; margin: 30px 0;">
          <p style="color: #374151; font-size: 14px; margin: 0 0 10px 0; font-weight: 600;">
            What happens next?
          </p>
          <ol style="color: #6b7280; font-size: 14px; margin: 0; padding-left: 20px;">
            <li style="margin-bottom: 8px;">Click the button above to create your account</li>
            <li style="margin-bottom: 8px;">Set up your password and profile</li>
            <li style="margin-bottom: 8px;">Start accessing your projects and timesheets</li>
          </ol>
        </div>
        
        <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">
          <strong>Note:</strong> This invite link is unique to you and will expire after use. If you have any questions, please contact ${companyName} directly.
        </p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
        
        <p style="color: #9ca3af; font-size: 12px; line-height: 1.6; margin: 0;">
          If you did not expect this invitation, you can safely ignore this email. If the button doesn't work, copy and paste this link into your browser:<br/>
          <a href="${inviteLink}" style="color: #2563eb; word-break: break-all;">${inviteLink}</a>
        </p>
      </div>
      ${getEmailFooter(baseUrl)}
    `;

    const { data, error } = await getResendClient().emails.send({
      from: FROM_EMAIL,
      to: recipientEmail,
      subject: `You've been invited to join ${companyName} on ${COMPANY_NAME}`,
      html,
    });

    if (error) {
      console.error('Error sending invite email:', error);
      return { success: false, error: error.message };
    }

    console.log('Invite email sent successfully:', data);
    return { success: true };
  } catch (error: any) {
    console.error('Error sending invite email:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

/**
 * Send Registration Confirmation Email
 */
export async function sendRegistrationConfirmationEmail(
  recipientEmail: string,
  firstName: string,
  companyName: string,
  trialEndsAt: Date
): Promise<{ success: boolean; error?: string }> {
  try {
    const baseUrl = getAppUrl();
    const loginLink = `${baseUrl}/login`;
    const dashboardLink = `${baseUrl}/dashboard`;
    const trialEndDate = trialEndsAt.toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
    
    const html = `
      ${getEmailHeader()}
      <div style="padding: 40px 30px;">
        <h2 style="color: #111827; margin: 0 0 20px 0; font-size: 24px;">Welcome to ${COMPANY_NAME}! 🎉</h2>
        
        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
          Hi ${firstName},
        </p>
        
        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
          Congratulations! Your ${COMPANY_NAME} account for <strong>${companyName}</strong> has been successfully created.
        </p>
        
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px; padding: 25px; margin: 30px 0; text-align: center;">
          <div style="color: #ffffff; font-size: 18px; font-weight: 600; margin-bottom: 10px;">
            🎁 Your 7-Day Free Trial is Active
          </div>
          <div style="color: #d1fae5; font-size: 14px;">
            Trial ends on ${trialEndDate}
          </div>
        </div>
        
        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
          You now have full access to all ${COMPANY_NAME} features. Start streamlining your subcontractor management today!
        </p>
        
        <div style="text-align: center; margin: 40px 0;">
          <a href="${dashboardLink}" style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">
            Go to Your Dashboard
          </a>
        </div>
        
        <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 20px; margin: 30px 0;">
          <p style="color: #374151; font-size: 14px; margin: 0 0 10px 0; font-weight: 600;">
            🚀 Get Started in 3 Steps:
          </p>
          <ol style="color: #1e40af; font-size: 14px; margin: 0; padding-left: 20px; font-weight: 500;">
            <li style="margin-bottom: 8px;">Add your clients and projects</li>
            <li style="margin-bottom: 8px;">Invite your subcontractors to join</li>
            <li style="margin-bottom: 8px;">Set up rate cards for accurate billing</li>
          </ol>
        </div>
        
        <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 30px 0;">
          <p style="color: #374151; font-size: 14px; margin: 0 0 15px 0; font-weight: 600;">
            📚 Helpful Resources:
          </p>
          <ul style="color: #6b7280; font-size: 14px; margin: 0; padding-left: 20px; list-style: none;">
            <li style="margin-bottom: 8px;">
              ✓ <a href="${baseUrl}/introduction" style="color: #2563eb; text-decoration: none;">Getting Started Guide</a>
            </li>
            <li style="margin-bottom: 8px;">
              ✓ <a href="${baseUrl}/pricing" style="color: #2563eb; text-decoration: none;">View Pricing Plans</a>
            </li>
            <li style="margin-bottom: 8px;">
              ✓ Need help? Reply to this email for support
            </li>
          </ul>
        </div>
        
        <div style="background-color: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 20px; margin: 30px 0;">
          <p style="color: #92400e; font-size: 14px; margin: 0; line-height: 1.6;">
            <strong>💡 Pro Tip:</strong> Remember to upgrade before your trial ends on <strong>${trialEndDate}</strong> to continue using all features without interruption.
          </p>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
        
        <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0 0 15px 0;">
          If you have any questions or need assistance, don't hesitate to reach out. We're here to help!
        </p>
        
        <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0;">
          Best regards,<br/>
          <strong>The ${COMPANY_NAME} Team</strong>
        </p>
        
        <p style="color: #9ca3af; font-size: 12px; line-height: 1.6; margin: 30px 0 0 0;">
          Your login URL: <a href="${loginLink}" style="color: #2563eb;">${loginLink}</a>
        </p>
      </div>
      ${getEmailFooter(baseUrl)}
    `;

    const { data, error } = await getResendClient().emails.send({
      from: FROM_EMAIL,
      to: recipientEmail,
      subject: `Welcome to ${COMPANY_NAME}! Your account is ready 🎉`,
      html,
    });

    if (error) {
      console.error('Error sending registration email:', error);
      return { success: false, error: error.message };
    }

    console.log('Registration email sent successfully:', data);
    return { success: true };
  } catch (error: any) {
    console.error('Error sending registration email:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

/**
 * Send Invite Acceptance Notification to Company
 */
export async function sendInviteAcceptedNotificationEmail(
  companyEmail: string,
  companyName: string,
  subcontractorName: string,
  subcontractorEmail: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const baseUrl = getAppUrl();
    const html = `
      ${getEmailHeader()}
      <div style="padding: 40px 30px;">
        <h2 style="color: #111827; margin: 0 0 20px 0; font-size: 24px;">Invitation Accepted! ✅</h2>
        
        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
          Great news! <strong>${subcontractorName}</strong> has accepted your invitation and created their account on ${COMPANY_NAME}.
        </p>
        
        <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin: 30px 0;">
          <p style="color: #374151; font-size: 14px; margin: 0 0 10px 0; font-weight: 600;">
            Subcontractor Details:
          </p>
          <p style="color: #6b7280; font-size: 14px; margin: 0;">
            <strong>Name:</strong> ${subcontractorName}<br/>
            <strong>Email:</strong> ${subcontractorEmail}
          </p>
        </div>
        
        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
          They can now access their projects, log time, and collaborate with your team.
        </p>
        
        <div style="text-align: center; margin: 40px 0;">
          <a href="${baseUrl}/dashboard/subcontractors" style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">
            View Subcontractors
          </a>
        </div>
      </div>
      ${getEmailFooter(baseUrl)}
    `;

    const { data, error } = await getResendClient().emails.send({
      from: FROM_EMAIL,
      to: companyEmail,
      subject: `${subcontractorName} has joined your ${COMPANY_NAME} team`,
      html,
    });

    if (error) {
      console.error('Error sending notification email:', error);
      return { success: false, error: error.message };
    }

    console.log('Notification email sent successfully:', data);
    return { success: true };
  } catch (error: any) {
    console.error('Error sending notification email:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}
