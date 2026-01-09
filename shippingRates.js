// shippingRate.js
import express from 'express';
import axios from 'axios';
import { PORT, FEDEX_ACCOUNT_NUMBER } from './config.js';
import { getFedexToken } from './auth.js';

const app = express();
app.use(express.json());

// ---------------------------
// Endpoint para Shopify Rates
// ---------------------------
app.post('/rates', async (req, res) => {
  try {
    console.log('REQ /rates =>', JSON.stringify(req.body, null, 2));

    const { cart, destination } = req.body;
    if (!cart || !destination) {
      console.warn('Cart ou destination não informados');
      return res.json({ rates: [] });
    }

    const toPostalCode = destination.postalCode || '';
    const toCountry = destination.countryCode || '';
    const items = cart.lines || [];

    // Calcula peso total (kg) e valor total (USD)
    let totalWeightKg = 0;
    let totalValue = 0;
    items.forEach(item => {
      const weightKg = (item.grams || 0) / 1000;
      const quantity = item.quantity || 1;
      totalWeightKg += weightKg * quantity;
      totalValue += (item.price || 0) * quantity;
    });

    // Obtem token FedEx
    const token = await getFedexToken();

    // Payload FedEx
    const fedexBody = {
      accountNumber: { value: FEDEX_ACCOUNT_NUMBER },
      requestedShipment: {
        shipper: { address: { postalCode: '33126', countryCode: 'US' } },
        recipient: { address: { postalCode: toPostalCode, countryCode: toCountry } },
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
              unitPrice: { amount: totalValue || 0, currency: 'USD' },
              customsValue: { amount: totalValue || 0, currency: 'USD' },
              groupPackageCount: 1
            }
          ]
        },
        requestedPackageLineItems: [
          { weight: { units: 'KG', value: totalWeightKg || 1 } }
        ]
      }
    };

    console.log('Payload FedEx =>', JSON.stringify(fedexBody, null, 2));

    // Chama FedEx API
    const fedexResponse = await axios.post(
      'https://apis.fedex.com/rate/v1/rates/quotes',
      fedexBody,
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );

    console.log('FedEx RAW RESPONSE =>', JSON.stringify(fedexResponse.data, null, 2));

    // Extrai informações da resposta
    const detail = fedexResponse.data.output?.rateReplyDetails?.[0];
    const rated = detail?.ratedShipmentDetails?.[0];
    const net = rated?.totalNetCharge || 0;
    const currency = rated?.currency || 'USD';
    const transitTime = detail?.commit?.committedTransitTime || 'N/A';
    const cents = Math.round(net * 100);

    // Monta resposta para Shopify
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

    console.log('RESPONSE /rates =>', JSON.stringify(response, null, 2));
    res.json(response);

  } catch (e) {
    console.error('ERRO /rates =>', e.response?.data || e.message || e);
    res.status(500).json({ rates: [] });
  }
});

// ---------------------------
// Inicializa servidor
// ---------------------------
app.listen(PORT, () => console.log(`FedEx proxy rodando na porta ${PORT}`));
