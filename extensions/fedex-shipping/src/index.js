import { extend } from "@shopify/shopify-app-extension-api";

extend("purchase.shipping-rate-definitions.render-api", async (api) => {
  try {
    // Extrai dados do carrinho e destino
    const { destination, cart } = api;

    if (!destination || !cart) {
      console.error("Dados insuficientes para calcular frete");
      return { rates: [] };
    }

    // Monta payload para seu endpoint Node.js
    const payload = {
      fromPostalCode: senderPostalCode, // seu CEP padrão de saída (Brazil)
      fromCountry: senderCountryCode, // seu país padrão de saída (BR)
      toPostalCode: destination.postalCode || "",
      toCountry: destination.countryCode || "",
      weightKg: (cart.weight?.value || 1500) / 1000, // converte de grama para kg
      hsCode: "847130", // padrão: laptop (você pode variar por produto)
      description: Title,
      itemValue: cart.subtotal?.amount || Price,
    };

    console.log("Chamando endpoint FedEx com:", payload);

    // Chama seu endpoint Node.js
    const response = await fetch(api.settings.endpoint_url || "http://localhost:3000/rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    // Converte resposta do seu backend para formato Shopify
    return {
      rates: (data.rates || []).map((rate) => ({
        title: rate.service_name || "FedEx",
        price: {
          amount: (parseInt(rate.total_price) / 100).toString(), // converte centavos para valor
          currency: rate.currency || "BRL",
        },
        description: rate.duties_note
          ? `${rate.description}\n ${rate.duties_note}`
          : rate.description,
      })),
    };
  } catch (error) {
    console.error("Erro ao calcular frete FedEx:", error);
    return { rates: [] };
  }
});
