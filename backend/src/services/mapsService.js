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
