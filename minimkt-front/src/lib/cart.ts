import { CartItem } from "@/types/cart";

const CART_STORAGE_KEY = "minimkt:cart:v1";

function notifyCartUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("cart:updated"));
}

export function getCartItems(): CartItem[] {
  if (typeof window === "undefined") return [];

  const raw = localStorage.getItem(CART_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as CartItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setCartItems(items: CartItem[]) {
  if (typeof window === "undefined") return;

  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  notifyCartUpdated();
}

export function clearCart() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CART_STORAGE_KEY);
  notifyCartUpdated();
}

export function addToCart(item: Omit<CartItem, "quantity">, quantity = 1) {
  const current = getCartItems();
  const existing = current.find((cartItem) => cartItem.productId === item.productId);

  if (existing) {
    existing.quantity += quantity;
    setCartItems([...current]);
    return;
  }

  setCartItems([...current, { ...item, quantity }]);
}

export function removeFromCart(productId: string) {
  const next = getCartItems().filter((item) => item.productId !== productId);
  setCartItems(next);
}

export function updateCartItemQuantity(productId: string, quantity: number) {
  if (quantity <= 0) {
    removeFromCart(productId);
    return;
  }

  const next = getCartItems().map((item) =>
    item.productId === productId ? { ...item, quantity } : item,
  );

  setCartItems(next);
}

export function getCartCount() {
  return getCartItems().reduce((acc, item) => acc + item.quantity, 0);
}

export function getCartTotal() {
  return getCartItems().reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
}

export function toOrderItemsPayload(items: CartItem[]) {
  return items.map((item) => ({
    product_id: item.productId,
    quantity: item.quantity,
  }));
}
