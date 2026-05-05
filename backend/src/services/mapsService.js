import { env } from "../config/env.js";

export async function calculateDistanceMiles(destinationAddress) {
  const origin = encodeURIComponent(env.businessAddress);
  const destination = encodeURIComponent(destinationAddress);
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${destination}&units=imperial&key=${env.googleMapsApiKey}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to call Google Maps API");
  }

  const data = await response.json();
  const element = data?.rows?.[0]?.elements?.[0];
  if (!element || element.status !== "OK") {
    throw new Error("Invalid delivery address");
  }

  const miles = element.distance.value / 1609.344;
  return Math.round(miles * 100) / 100;
}

export async function autocompleteUsAddresses(input) {
  const query = String(input || "").trim();
  if (!query) return [];
  if (!env.googleMapsApiKey) return [];

  const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": env.googleMapsApiKey,
      "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text"
    },
    body: JSON.stringify({
      input: query,
      includedRegionCodes: ["us"],
      includeQueryPredictions: false
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Failed to call Google Places autocomplete API: ${detail || response.status}`);
  }

  const data = await response.json();
  if (data?.error?.message) {
    throw new Error(data.error.message);
  }

  const suggestions = Array.isArray(data?.suggestions) ? data.suggestions : [];
  return suggestions.slice(0, 8).map((s) => ({
    placeId: s?.placePrediction?.placeId || "",
    description: s?.placePrediction?.text?.text || ""
  })).filter((s) => s.description);
}
