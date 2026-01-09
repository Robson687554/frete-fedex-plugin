// server.js
import express from 'express';
import axios from 'axios';
import { PORT, FEDEX_ACCOUNT_NUMBER } from './config.js';
import { getFedexToken } from './auth.js';

const app = express();
app.use(express.json());

// Shopify envia este POST para o endpoint_url configurado no toml
app.post('/rates', async (req, res) => {
  try {
    // Shopify envia o carrinho e destino dentro de req.body.rate
    const shopifyRate = req.body.rate;
    if (!shopifyRate) {
      return res.json({ rates: [] });
    }

    const toPostalCode = shopifyRate.destination?.postal_code || '';
    const toCountry = shopifyRate.destination?.country || '';
    const items = shopifyRate.items || [];

    // Para simplificar, vamos somar peso e valor total do carrinho
    let totalWeightKg = 0;
    let totalValue = 0;
    items.forEach(item => {
      const weightKg = (item.grams || 0) / 1000; // g → kg
      totalWeightKg += weightKg;
      totalValue += item.price * item.quantity;
    });

    // Token FedEx
    const token = await getFedexToken();

    // Payload para FedEx API
    const fedexBody = {
      accountNumber: { value: FEDEX_ACCOUNT_NUMBER },
      requestedShipment: {
        shipper: {
          address: { postalCode: '33126', countryCode: 'US' } // Exemplo
        },
        recipient: {
          address: { postalCode: toPostalCode, countryCode: toCountry }
        },
        shipDateStamp: new Date().toISOString().slice(0, 10),
        pickupType: 'USE_SCHEDULED_PICKUP',
        packagingType: 'YOUR_PACKAGING',
        shippingChargesPayment: { paymentType: 'SENDER' },
        rateRequestType: ['ACCOUNT'],
        preferredCurrency: 'USD',
        customsClearanceDetail: {
          dutiesPayment: { paymentType: 'SENDER' },
          commodities: [
            {
              description: 'Produtos do carrinho',
              quantity: 1,
              quantityUnits: 'PCS',
              weight: { units: 'KG', value: totalWeightKg || 1 },
              unitPrice: { amount: totalValue, currency: 'USD' },
              customsValue: { amount: totalValue, currency: 'USD' },
              groupPackageCount: 1
            }
          ]
        },
        requestedPackageLineItems: [
          { weight: { units: 'KG', value: totalWeightKg || 1 } }
        ]
      }
    };

    const fedexResponse = await axios.post(
      'https://apis.fedex.com/rate/v1/rates/quotes',
      fedexBody,
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );

    const detail = fedexResponse.data.output?.rateReplyDetails?.[0];
    const rated = detail?.ratedShipmentDetails?.[0];
    const net = rated?.totalNetCharge || 0;
    const currency = rated?.currency || 'USD';
    const transitTime = detail?.commit?.committedTransitTime || 'N/A';

    const cents = Math.round(net * 100);

    // Resposta formatada para Shopify checkout
    const response = {
      rates: [
        {
          service_name: `FedEx Internacional (${transitTime})`,
          service_code: 'FEDEX_INTL',
          total_price: String(cents),
          currency,
          description: transitTime !== 'N/A'
            ? `Entrega estimada: ${transitTime}`
            : 'Cálculo direto na API FedEx',
          duties_note: null
        }
      ]
    };

    console.log('RESPONSE /rates =>', response);
    res.json(response);

  } catch (e) {
    console.error('ERRO /rates =>', e.response?.data || e.message || e);
    res.status(500).json({ rates: [] });
  }
});

app.listen(PORT, () => console.log(`FedEx proxy rodando na porta ${PORT}`));
