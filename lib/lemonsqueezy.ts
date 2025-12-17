import { lemonSqueezySetup } from '@lemonsqueezy/lemonsqueezy.js';

// Initialize Lemon Squeezy
if (process.env.LEMONSQUEEZY_API_KEY) {
  lemonSqueezySetup({
    apiKey: process.env.LEMONSQUEEZY_API_KEY,
    onError: (error) => {
      console.error('Lemon Squeezy Error:', error);
    },
  });
}

export const LEMONSQUEEZY_CONFIG = {
  storeId: process.env.NEXT_PUBLIC_LEMONSQUEEZY_STORE_ID || '',
  // Add your product variant IDs here
  plans: {
    starter: {
      name: 'Starter',
      variantId: process.env.NEXT_PUBLIC_LEMONSQUEEZY_STARTER_VARIANT_ID || '',
      price: 29,
      description: 'Perfect for small teams',
      features: [
        'Up to 10 projects',
        'Up to 5 team members',
        'Basic reporting',
        'Email support',
      ],
    },
    professional: {
      name: 'Professional',
      variantId: process.env.NEXT_PUBLIC_LEMONSQUEEZY_PRO_VARIANT_ID || '',
      price: 79,
      description: 'For growing businesses',
      features: [
        'Unlimited projects',
        'Up to 25 team members',
        'Advanced reporting',
        'Priority support',
        'Custom roles',
      ],
    },
    enterprise: {
      name: 'Enterprise',
      variantId: process.env.NEXT_PUBLIC_LEMONSQUEEZY_ENTERPRISE_VARIANT_ID || '',
      price: 199,
      description: 'For large organizations',
      features: [
        'Unlimited everything',
        'Unlimited team members',
        'Custom integrations',
        'Dedicated support',
        'SLA guarantee',
        'Custom contract',
      ],
    },
  },
};
