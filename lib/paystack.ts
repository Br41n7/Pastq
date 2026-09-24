const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY!;
const BASE_URL = 'https://api.paystack.co';

async function paystackRequest(method: string, path: string, body?: object) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!data.status) throw new Error(data.message || 'Paystack request failed');
  return data.data;
}

// Initialize a payment — returns authorization_url for redirect
export async function initializePayment(params: {
  email: string;
  amount: number;       // in kobo (multiply naira by 100)
  reference: string;
  metadata?: object;
  callback_url: string;
}) {
  return paystackRequest('POST', '/transaction/initialize', params);
}

// Verify a payment after redirect callback
export async function verifyPayment(reference: string) {
  return paystackRequest('GET', `/transaction/verify/${reference}`);
}

// Get all transactions (admin)
export async function listTransactions(params?: { page?: number; perPage?: number }) {
  const q = new URLSearchParams(params as any).toString();
  return paystackRequest('GET', `/transaction?${q}`);
}

// Convert naira to kobo
export const toKobo = (naira: number) => Math.round(naira * 100);

// Convert kobo to naira
export const toNaira = (kobo: number) => kobo / 100;

// Format as Nigerian currency
export const formatNaira = (kobo: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(kobo / 100);
