// Gumroad Configuration
// No SDK initialization needed - Gumroad uses simple webhook-based integration

export const GUMROAD_CONFIG = {
  // Single product with multiple tiers
  productPermalink: process.env.NEXT_PUBLIC_GUMROAD_PRODUCT_PERMALINK || 'zxjxzj',
  
  // Tier names from Gumroad (used to identify which tier was purchased in webhook)
  tierNames: {
    personal: 'Personal',
    starter: 'Business Starter',
    professional: 'Business Pro',
  },
  
  plans: {
    starter: {
      name: 'Personal',
      tierName: 'Personal', // Must match Gumroad tier name
      permalink: process.env.NEXT_PUBLIC_GUMROAD_PRODUCT_PERMALINK || 'zxjxzj',
      price: 99,
      billingPeriod: 'month',
      description: 'Perfect for solopreneurs',
      tagline: 'Ideal for individual contractors',
      features: [
        '✅ 2 clients',
        '✅ 4 projects/month',
        '✅ Custom rate cards',
        '✅ Time tracking & logs',
        '✅ Basic financial reports',
        '✅ Role-based access control',
        '✅ Email support',
      ],
      limits: {
        clients: 2,
        subcontractors: 4,
        projects: -1, // unlimited
        canInviteSubcontractors: true,
      },
      bestFor: [
        'Solopreneurs',
        'Individual contractors',
        'Small freelance businesses',
      ],
    },
    professional: {
      name: 'Business Starter',
      tierName: 'Business Starter', // Must match Gumroad tier name
      permalink: process.env.NEXT_PUBLIC_GUMROAD_PRODUCT_PERMALINK || 'zxjxzj',
      price: 199,
      billingPeriod: 'month',
      description: 'For growing businesses',
      tagline: 'Scale your operations',
      features: [
        '✅ 4 clients',
        '✅ 10 projects/month',
        '✅ Invite subcontractors to platform',
        '✅ Advanced rate card management',
        '✅ Time tracking & logs',
        '✅ Advanced financial reports',
        '✅ Project profit margins',
        '✅ Role-based access control',
        '✅ Priority email support',
      ],
      limits: {
        clients: 4,
        subcontractors: 10,
        projects: -1, // unlimited
        canInviteSubcontractors: true,
      },
      bestFor: [
        'Growing contractor businesses',
        'Companies managing multiple projects',
        'Businesses with multiple subcontractors',
      ],
    },
    enterprise: {
      name: 'Business Pro',
      tierName: 'Business Pro', // Must match Gumroad tier name
      permalink: process.env.NEXT_PUBLIC_GUMROAD_PRODUCT_PERMALINK || 'zxjxzj',
      price: 349,
      billingPeriod: 'month',
      description: 'For established teams',
      tagline: 'Complete solution for professional operations',
      features: [
        '✅ 10 clients',
        '✅ Up to 50 projects/month',
        '✅ Invite unlimited subcontractors',
        '✅ Advanced rate card management',
        '✅ Comprehensive time tracking',
        '✅ Advanced financial reports',
        '✅ Project profit analysis',
        '✅ Multi-shift rate management',
        '✅ Custom role permissions',
        '✅ Multi-company support',
        '✅ Priority support',
        '✅ Dedicated account manager',
      ],
      limits: {
        clients: 10,
        subcontractors: -1, // unlimited
        projects: -1, // unlimited
        canInviteSubcontractors: true,
      },
      bestFor: [
        'Established contractor organizations',
        'Companies managing 50+ projects',
        'Businesses with many subcontractors',
        'Organizations requiring dedicated support',
      ],
    },
  },
};

/**
 * Get plan details by name
 */
export function getPlanDetails(planName: 'starter' | 'professional' | 'enterprise') {
  return GUMROAD_CONFIG.plans[planName];
}

/**
 * Get all available plans
 */
export function getAllPlans() {
  return Object.values(GUMROAD_CONFIG.plans);
}

/**
 * Generate Gumroad checkout URL with custom data and tier selection
 * @param tierName - Tier name (Personal, Business Starter, Business Pro)
 * @param userId - User ID to pass as custom field
 * @param email - Optional email to prefill
 * @returns Full Gumroad checkout URL
 */
export function generateGumroadCheckoutUrl(
  tierName: string,
  userId: string,
  email?: string
): string {
  const permalink = GUMROAD_CONFIG.productPermalink;
  const baseUrl = `https://dunehunter.gumroad.com/l/${permalink}`;
  const params = new URLSearchParams({
    // Pass user_id as custom field for webhook processing
    wanted: 'true',
  });

  // Add tier selection if Gumroad supports variant selection via URL
  // Note: For memberships with tiers, the user selects the tier on Gumroad's page
  
  if (email) {
    params.append('email', email);
  }

  // Add user_id to URL hash for retrieval after checkout
  return `${baseUrl}?${params.toString()}#user_id=${userId}`;
}

/**
 * Map Gumroad tier name to app subscription plan
 */
export function mapTierToPlan(tierName: string): 'starter' | 'professional' | 'enterprise' {
  const normalizedTier = tierName.toLowerCase().trim();
  
  if (normalizedTier.includes('personal')) {
    return 'starter';
  } else if (normalizedTier.includes('business starter')) {
    return 'professional';
  } else if (normalizedTier.includes('business pro')) {
    return 'enterprise';
  }
  
  // Default to starter if tier name doesn't match
  console.warn(`Unknown tier name: ${tierName}, defaulting to starter`);
  return 'starter';
}

/**
 * Verify Gumroad license key (for license-based products)
 * @param licenseKey - License key from customer
 * @param productPermalink - Product permalink
 * @returns License verification result
 */
export async function verifyGumroadLicense(
  licenseKey: string,
  productPermalink: string
): Promise<{
  success: boolean;
  purchase?: any;
  message?: string;
}> {
  try {
    const response = await fetch('https://api.gumroad.com/v2/licenses/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        product_permalink: productPermalink,
        license_key: licenseKey,
        increment_uses_count: 'false',
      }),
    });

    const data = await response.json();

    if (data.success) {
      return {
        success: true,
        purchase: data.purchase,
      };
    } else {
      return {
        success: false,
        message: data.message || 'License verification failed',
      };
    }
  } catch (error) {
    console.error('Error verifying Gumroad license:', error);
    return {
      success: false,
      message: 'Failed to verify license',
    };
  }
}
