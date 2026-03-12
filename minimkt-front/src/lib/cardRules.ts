import creditCardType from "credit-card-type";

export type CardBrand =
  | "visa"
  | "mastercard"
  | "amex"
  | "elo"
  | "hipercard"
  | "discover"
  | "diners"
  | "jcb"
  | "aura"
  | "desconhecida";

type CardRule = {
  lengths: number[];
  cvvLength: number;
};

export const CARD_RULES: Record<CardBrand, CardRule> = {
  visa: { lengths: [13, 16, 19], cvvLength: 3 },
  mastercard: { lengths: [16], cvvLength: 3 },
  amex: { lengths: [15], cvvLength: 4 },
  elo: { lengths: [16], cvvLength: 3 },
  hipercard: { lengths: [13, 16, 19], cvvLength: 3 },
  discover: { lengths: [16, 19], cvvLength: 3 },
  diners: { lengths: [14, 16], cvvLength: 3 },
  jcb: { lengths: [16, 19], cvvLength: 3 },
  aura: { lengths: [16], cvvLength: 3 },
  desconhecida: { lengths: [16], cvvLength: 3 },
};

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function mapCardTypeToBrand(type: string): CardBrand {
  if (type === "visa") return "visa";
  if (type === "mastercard") return "mastercard";
  if (type === "american-express") return "amex";
  if (type === "elo") return "elo";
  if (type === "hipercard" || type === "hiper") return "hipercard";
  if (type === "discover") return "discover";
  if (type === "diners-club") return "diners";
  if (type === "jcb") return "jcb";
  return "desconhecida";
}

export function detectCardBrand(number: string): CardBrand {
  const digits = onlyDigits(number);
  if (!digits) return "desconhecida";

  const card = creditCardType(digits)[0];
  if (card) return mapCardTypeToBrand(card.type);

  if (/^50/.test(digits)) return "aura";
  return "desconhecida";
}

export function formatCardNumber(value: string, brand: CardBrand) {
  const max = brand === "amex" ? 15 : brand === "diners" ? 14 : 19;
  const digits = onlyDigits(value).slice(0, max);

  if (brand === "amex") {
    return [digits.slice(0, 4), digits.slice(4, 10), digits.slice(10, 15)].filter(Boolean).join(" ");
  }

  if (brand === "diners") {
    return [digits.slice(0, 4), digits.slice(4, 10), digits.slice(10, 14)].filter(Boolean).join(" ");
  }

  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
}

export function getCardExpectedLengths(brand: CardBrand) {
  return CARD_RULES[brand].lengths;
}

export function getCardExpectedCvvLength(brand: CardBrand) {
  return CARD_RULES[brand].cvvLength;
}

export function cardBrandLabel(brand: CardBrand) {
  if (brand === "desconhecida") return "Bandeira nao identificada";
  if (brand === "amex") return "Amex";
  return brand.charAt(0).toUpperCase() + brand.slice(1);
}

export function passesLuhn(number: string) {
  let sum = 0;
  let shouldDouble = false;
  for (let i = number.length - 1; i >= 0; i -= 1) {
    let digit = Number(number[i]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}
