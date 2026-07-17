export type MakeKey =
  | "Tata Motors"
  | "Ashok Leyland"
  | "Mahindra"
  | "Eicher"
  | "BharatBenz"
  | "Force Motors"
  | "Maruti Suzuki Commercial"
  | "SML Isuzu";

export const VEHICLE_MAKES: string[] = [
  "Tata Motors",
  "Ashok Leyland",
  "Mahindra",
  "Eicher",
  "BharatBenz",
  "Force Motors",
  "Maruti Suzuki Commercial",
  "SML Isuzu",
];

export type ModelPreset = {
  name: string;
  fuel: string;
  capacityTons: number;
};

export const MODELS_BY_MAKE: Record<string, ModelPreset[]> = {
  "Tata Motors": [
    { name: "Ace Gold", fuel: "Diesel", capacityTons: 0.75 },
    { name: "Intra V30", fuel: "Diesel", capacityTons: 1.3 },
    { name: "407 Gold", fuel: "Diesel", capacityTons: 2.5 },
    { name: "709G", fuel: "Diesel", capacityTons: 4.5 },
    { name: "Signa 2823.K", fuel: "Diesel", capacityTons: 25 },
  ],
  "Ashok Leyland": [
    { name: "Dost+", fuel: "Diesel", capacityTons: 1.5 },
    { name: "Bada Dost", fuel: "Diesel", capacityTons: 1.7 },
    { name: "Partner", fuel: "Diesel", capacityTons: 3.5 },
    { name: "Ecomet 1015", fuel: "Diesel", capacityTons: 6.2 },
    { name: "Boss 1616", fuel: "Diesel", capacityTons: 10 },
  ],
  Mahindra: [
    { name: "Jeeto", fuel: "Diesel", capacityTons: 0.7 },
    { name: "Supro", fuel: "Diesel", capacityTons: 0.9 },
    { name: "Bolero Pickup", fuel: "Diesel", capacityTons: 1.5 },
    { name: "Furio 17", fuel: "Diesel", capacityTons: 11 },
  ],
  Eicher: [
    { name: "Pro 2049", fuel: "Diesel", capacityTons: 2.5 },
    { name: "Pro 3015", fuel: "Diesel", capacityTons: 8 },
    { name: "Pro 6028", fuel: "Diesel", capacityTons: 18 },
  ],
  BharatBenz: [
    { name: "1015R", fuel: "Diesel", capacityTons: 6 },
    { name: "1217C", fuel: "Diesel", capacityTons: 8 },
    { name: "2823R", fuel: "Diesel", capacityTons: 18 },
  ],
  "Force Motors": [
    { name: "Trump 40", fuel: "Diesel", capacityTons: 2.5 },
    { name: "Traveller Delivery Van", fuel: "Diesel", capacityTons: 1.5 },
  ],
  "Maruti Suzuki Commercial": [
    { name: "Super Carry", fuel: "Diesel", capacityTons: 0.74 },
    { name: "Eeco Cargo", fuel: "Petrol", capacityTons: 0.6 },
  ],
  "SML Isuzu": [
    { name: "Sartaj GS", fuel: "Diesel", capacityTons: 5.5 },
    { name: "Global Series", fuel: "Diesel", capacityTons: 9 },
  ],
};

export const FUEL_TYPES = ["Diesel", "Petrol", "CNG", "LNG", "Electric", "Hybrid"];

export const INDIAN_STATE_CODES = [
  "AN","AP","AR","AS","BR","CH","CG","DD","DL","DN","GA","GJ","HR","HP","JK","JH","KA","KL","LA","LD","MH","ML","MN","MP","MZ","NL","OD","PB","PY","RJ","SK","TN","TG","TR","UK","UP","WB",
];