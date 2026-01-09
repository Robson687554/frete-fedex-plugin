// index.js
import { extend } from "@shopify/shopify-app-extension-api";

extend("purchase.shipping-rate-definitions.render-api", async (api) => {
  try {
    const { cart, destination } = api;

    if (!cart || !destination) return { rates: [] };

    const payload = { cart, destination };

    // Endpoint configurado no TOML ou localhost
    const endpoint = api.settings.endpoint_url || "https://frete-fedex-plugin.onrender.com/rates";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();

    return {
      rates: (data.rates || []).map(rate => ({
        title: rate.service_name || "FedEx",
        price: { amount: rate.total_price, currency: rate.currency || "USD" },
        description: rate.description,
      }))
    };

  } catch (err) {
    console.error("Erro Shopify extension =>", err);
    return { rates: [] };
  }
});
