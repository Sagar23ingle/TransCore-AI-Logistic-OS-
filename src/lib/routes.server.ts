const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

function creds() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const mapsKey = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovableKey || !mapsKey) throw new Error("Maps service is not configured on this server.");
  return { lovableKey, mapsKey };
}

async function gatewayFetch(path: string, init: RequestInit & { headers?: Record<string, string> } = {}) {
  const { lovableKey, mapsKey } = creds();
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": mapsKey,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Google Maps gateway ${path} failed [${res.status}]: ${body}`);
    if (res.status === 403) {
      throw new Error("Maps request denied. The Google Maps key restrictions need to be updated.");
    }
    throw new Error("Route lookup failed. Please try again.");
  }
  return res.json() as Promise<Record<string, unknown>>;
}

export type GeoPoint = { lat: number; lng: number; address: string };

export async function geocode(address: string): Promise<GeoPoint> {
  const json = (await gatewayFetch(
    `/maps/api/geocode/json?address=${encodeURIComponent(address)}`,
  )) as {
    status?: string;
    results?: Array<{ formatted_address: string; geometry: { location: { lat: number; lng: number } } }>;
  };
  const first = json.results?.[0];
  if (!first) throw new Error(`Could not find a location for "${address}".`);
  return {
    lat: first.geometry.location.lat,
    lng: first.geometry.location.lng,
    address: first.formatted_address,
  };
}

export type TollPoint = { name: string; lat: number; lng: number };

export type ComputedRoute = {
  kind: "fastest" | "fuel_efficient";
  distance_km: number;
  duration_min: number;
  encoded_polyline: string;
  toll_amount: number | null;
  toll_currency: string | null;
  has_tolls: boolean;
  summary: string;
  /** True when this same route is also Google's most fuel-efficient option. */
  also_fuel_efficient: boolean;
};

type RouteApiRoute = {
  routeLabels?: string[];
  distanceMeters?: number;
  duration?: string;
  description?: string;
  polyline?: { encodedPolyline?: string };
  travelAdvisory?: {
    tollInfo?: {
      estimatedPrice?: Array<{ currencyCode?: string; units?: string; nanos?: number }>;
    };
  };
};

function parseRoute(r: RouteApiRoute, kind: ComputedRoute["kind"], alsoFuelEfficient: boolean): ComputedRoute {
  const price = r.travelAdvisory?.tollInfo?.estimatedPrice?.[0];
  const toll = price
    ? Number(price.units ?? 0) + (price.nanos ?? 0) / 1e9
    : null;
  return {
    kind,
    distance_km: Math.round(((r.distanceMeters ?? 0) / 1000) * 10) / 10,
    duration_min: Math.round(Number(String(r.duration ?? "0s").replace("s", "")) / 60),
    encoded_polyline: r.polyline?.encodedPolyline ?? "",
    toll_amount: toll,
    toll_currency: price?.currencyCode ?? null,
    has_tolls: Boolean(r.travelAdvisory?.tollInfo),
    summary: r.description ?? "",
    also_fuel_efficient: alsoFuelEfficient,
  };
}

export async function computeRoutes(params: {
  origin: GeoPoint;
  destination: GeoPoint;
  avoidTolls: boolean;
}): Promise<ComputedRoute[]> {
  const json = (await gatewayFetch("/routes/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "X-Goog-FieldMask": [
        "routes.routeLabels",
        "routes.distanceMeters",
        "routes.duration",
        "routes.description",
        "routes.polyline.encodedPolyline",
        "routes.travelAdvisory.tollInfo",
      ].join(","),
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: params.origin.lat, longitude: params.origin.lng } } },
      destination: {
        location: { latLng: { latitude: params.destination.lat, longitude: params.destination.lng } },
      },
      travelMode: "DRIVE",
      // Required by the Routes API when a FUEL_EFFICIENT reference route is requested.
      routingPreference: "TRAFFIC_AWARE_OPTIMAL",
      requestedReferenceRoutes: ["FUEL_EFFICIENT"],
      computeAlternativeRoutes: true,
      extraComputations: ["TOLLS"],
      routeModifiers: {
        avoidTolls: params.avoidTolls,
        vehicleInfo: { emissionType: "DIESEL" },
      },
    }),
  })) as { routes?: RouteApiRoute[] };

  const routes = json.routes ?? [];
  if (routes.length === 0) throw new Error("No drivable route found between those places.");

  const out: ComputedRoute[] = [];
  for (const r of routes) {
    const labels = r.routeLabels ?? [];
    const isEco = labels.includes("FUEL_EFFICIENT");
    const isDefault = labels.includes("DEFAULT_ROUTE");
    const kind: ComputedRoute["kind"] = isEco && !isDefault ? "fuel_efficient" : "fastest";
    if (out.some((existing) => existing.kind === kind)) continue;
    out.push(parseRoute(r, kind, isEco));
  }
  return out;
}