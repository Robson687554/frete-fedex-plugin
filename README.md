(Invoke-WebRequest -Uri "http://localhost:3000/rates" -Method POST -ContentType "application/json" -Body '{
  "fromPostalCode": "33126",
  "fromCountry": "US",
  "toPostalCode": "22640-100",
  "toCountry": "BR",
  "hsCode": "847150",
  "weightKg": 1.5
}').Content



(Invoke-WebRequest -Uri "http://localhost:3000/rates" -Method POST -ContentType "application/json" -Body '{
  "fromPostalCode": "22640-100",
  "fromCountry": "BR",
  "toPostalCode": "33126",
  "toCountry": "US",
  "countryOfManufacture":"BR",
  "hsCode": "847130",
  "description":"Laptop computer",
  "weightKg": 1.5,
  "itemValue":1200
}').Content

(Invoke-WebRequest -Uri "http://localhost:3000/rates" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{
    "fromPostalCode": "22640-100",
    "fromCountry": "BR",
    "toPostalCode": "33126",
    "toCountry": "US",
    "countryOfManufacture": "BR",
    "hsCode": "847130",
    "description": "Laptop computer",
    "weightKg": 1.5,
    "itemValue": 1200
  }').Content

# frete-fedex-plugin
