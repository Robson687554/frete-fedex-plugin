import express from 'express';
import axios from 'axios';
import { PORT, FEDEX_ACCOUNT_NUMBER } from './config.js';
import { getFedexToken } from './auth.js';

const app = express();
app.use(express.json());

app.post('/rates', async (req, res) => {
  try {
    console.log('REQ /rates =>', req.body);

    const {
      fromPostalCode,
      fromCountry,
      toPostalCode,
      toCountry,
      countryOfManufacture,
      hsCode,
      description,
      weightKg,
      itemValue
    } = req.body;

    const token = await getFedexToken();

    const fedexBody = {
      accountNumber: { value: FEDEX_ACCOUNT_NUMBER },
      rateRequestControlParameters: {
        returnTransitTimes: true
      },
      requestedShipment: {
        shipper: {
          address: {
            postalCode: fromPostalCode,
            countryCode: fromCountry
          }
        },
        recipient: {
          address: {
            postalCode: toPostalCode,
            countryCode: toCountry
          }
        },
        shipDateStamp: new Date().toISOString().slice(0, 10),
        pickupType: "USE_SCHEDULED_PICKUP",
        packagingType: "YOUR_PACKAGING",
        shippingChargesPayment: { paymentType: "SENDER" },
        rateRequestType: ["ACCOUNT"],
        edtRequestType: "ALL",
        preferredCurrency: "USD",
        customsClearanceDetail: {
          dutiesPayment: {
            paymentType: "SENDER"
          },
          commodities: [
            {
              countryOfManufacture: countryOfManufacture || fromCountry,
              harmonizedCode: hsCode || "847130",
              description: description || "Laptop computer",
              quantity: 1,
              quantityUnits: "PCS",
              weight: {
                units: "KG",
                value: weightKg || 1.5
              },
              unitPrice: {
                amount: itemValue || 1200,
                currency: "USD"
              },
              customsValue: {
                amount: itemValue || 1200,
                currency: "USD"
              },
              groupPackageCount: 1
            }
          ]
        },
        requestedPackageLineItems: [
          {
            weight: {
              units: "KG",
              value: weightKg || 1.5
            }
          }
        ]
      }
    };

    const r = await axios.post(
      'https://apis.fedex.com/rate/v1/rates/quotes',
      fedexBody,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.dir(r.data, { depth: null });

    const detail = r.data.output?.rateReplyDetails?.[0];
    if (!detail) {
      console.log('Sem rateReplyDetails');
      return res.json({ rates: [] });
    }

    const rated = detail.ratedShipmentDetails?.[0];
    if (!rated) {
      console.log('Sem ratedShipmentDetails');
      return res.json({ rates: [] });
    }

    const net = rated.totalNetCharge;
    if (!net && net !== 0) {
      console.log('Sem totalNetCharge');
      return res.json({ rates: [] });
    }

    const currency = rated.currency || rated.shipmentRateDetail?.currency || 'USD';
    const transitTime = detail.commit?.committedTransitTime || detail.transitTime || null;
    const totalDutiesAndTaxes = rated.totalDutiesAndTaxes ?? null;

    const customerMessages = detail.customerMessages || [];
    const hasEdtMissing = customerMessages.some(
      m => m.code === 'EDT.DETAILS.MISSING'
    );

    const estimateDutiesExternally =
      (totalDutiesAndTaxes === 0 || totalDutiesAndTaxes === null) && hasEdtMissing;

    const cents = Math.round(net * 100);

    // FORMATO CORRETO PARA SHOPIFY
    const response = {
      rates: [
        {
          service_name: `FedEx (${transitTime || 'A confirmar'})`,
          service_code: 'FEDEX_INTL',
          total_price: String(cents),
          currency: currency,
          description: `${detail.serviceDescription?.names?.[0]?.value || 'FedEx Internacional'} | Tempo: ${transitTime || 'Não informado'}${estimateDutiesExternally ? ' | Impostos: A calcular' : ''}`
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

app.listen(PORT, () => console.log(`FedEx proxy na porta ${PORT}`));
