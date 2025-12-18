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
      yearlyPrice: 1008,
      billingPeriod: 'month',
      description: 'Perfect for solopreneurs',
      tagline: 'Ideal for individual contractors',
      features: [
        '1 user account',
        '1 client',
        '3 projects/month',
        '1 subcontractor',
        'Standard rate card template',
        'Time tracking & logs',
        'Basic financial reports',
        'Standard support (1-3 days response)',
      ],
      limits: {
        users: 1,
        clients: 1,
        projectsPerMonth: 3,
        subcontractors: 1,
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
      price: 249,
      yearlyPrice: 2390,
      billingPeriod: 'month',
      description: 'For growing businesses',
      tagline: 'Scale your operations',
      features: [
        '4 user accounts',
        '3 clients',
        '15 projects/month',
        '4 subcontractor accounts',
        'Full rate card customization',
        'Time tracking & logs',
        'Advanced financial reports',
        'Project profit margins',
        'Multi-shift rate management',
        'Standard support (1-3 days response)',
      ],
      limits: {
        users: 4,
        clients: 3,
        projectsPerMonth: 15,
        subcontractors: 4,
        canInviteSubcontractors: true,
      },
      bestFor: [
        'Growing contractor businesses',
        'Companies with multiple team members',
        'Businesses managing multiple clients',
      ],
    },
    enterprise: {
      name: 'Business Pro',
      tierName: 'Business Pro', // Must match Gumroad tier name
      permalink: process.env.NEXT_PUBLIC_GUMROAD_PRODUCT_PERMALINK || 'zxjxzj',
      price: 499,
      yearlyPrice: 4790,
      billingPeriod: 'month',
      description: 'For established teams',
      tagline: 'Complete solution for professional operations',
      features: [
        '10 user accounts',
        '10 clients',
        '40 projects/month',
        '10 subcontractor accounts',
        'Full rate card customization',
        'Advanced time tracking',
        'Advanced financial reports',
        'Project profit analysis',
        'Invoice/Reporting Export',
        'Performance Tracking',
        'Multi-shift rate management',
        'Custom role permissions',
        'Multi-company support',
        'Premium support (1-3 hours response)',
      ],
      limits: {
        users: 10,
        clients: 10,
        projectsPerMonth: 40,
        subcontractors: 10,
        canInviteSubcontractors: true,
      },
      bestFor: [
        'Established contractor organizations',
        'Companies with large teams',
        'Businesses managing many projects',
        'Organizations requiring fast support',
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
    wanted: 'true',
    // Pass user_id as query parameter - Gumroad will include it in webhook
    user_id: userId,
  });

  // Add tier selection if Gumroad supports variant selection via URL
  // Note: For memberships with tiers, the user selects the tier on Gumroad's page
  
  if (email) {
    params.append('email', email);
  }

  return `${baseUrl}?${params.toString()}`;
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
