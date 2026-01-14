
import Stripe from 'stripe';
import dotenv from 'dotenv';

// Load env vars
dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-12-15.clover',
});

async function checkAndManagePrice() {
  const priceId = 'price_1SoVb6GnODfeVx0fC1JVvFtc';
  
  try {
    console.log(`Retrieving price ${priceId}...`);
    const price = await stripe.prices.retrieve(priceId);
    console.log('Current Price Details:', JSON.stringify(price, null, 2));

    const productId = typeof price.product === 'string' ? price.product : price.product.id;
    console.log(`Retrieving product ${productId}...`);
    const product = await stripe.products.retrieve(productId);
    console.log('Current Product Details:', JSON.stringify(product, null, 2));

    // Check if we need to "update" (limitations apply)
    // We cannot change unit_amount, currency, etc.
    // We can update metadata, nickname, active status.
    
    if (price.unit_amount !== 25000000) {
        console.error(`CRITICAL: Cannot update price amount from ${price.unit_amount} to 25000000. Stripe prices are immutable.`);
    }

    // Update Price Metadata/Status if needed
    console.log('Updating Price metadata and status...');
    await stripe.prices.update(priceId, {
        active: true,
        metadata: {
            service_type: 'luxury_experience',
            tier: 'premium'
        },
        // tax_behavior can sometimes be updated depending on configuration, usually set at creation
    });

    // Update Product Metadata
    console.log('Updating Product details...');
    await stripe.products.update(productId, {
        name: 'The Royal Indulgence Experience',
        description: 'All-Inclusive Weekly Luxury Package. Private Jet, Superyacht, Michelin Dining.',
        metadata: {
            tier: 'luxury',
            service: 'private_chef'
        },
        images: ['https://images.unsplash.com/photo-1551632436-cbf8dd354ca8?auto=format&fit=crop&w=800&q=80']
    });

    console.log('Update complete.');

  } catch (error) {
    console.error('Error:', error);
  }
}

checkAndManagePrice();
