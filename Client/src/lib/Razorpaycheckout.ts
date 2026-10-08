// ── Razorpay global types ────────────────────────────────────────────────────
// The Razorpay Checkout script attaches `window.Razorpay` at runtime; these
// types describe just the surface this module actually uses.

interface RazorpayPaymentResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayPaymentFailedError {
  code: string;
  description: string;
  source: string;
  step: string;
  reason: string;
  metadata?: {
    order_id?: string;
    payment_id?: string;
  };
}

interface RazorpayPaymentFailedResponse {
  error: RazorpayPaymentFailedError;
}

interface RazorpayPrefill {
  name?: string;
  email?: string;
  contact?: string;
}

interface RazorpayTheme {
  color?: string;
}

interface RazorpayModalOptions {
  ondismiss?: () => void;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description?: string;
  prefill?: RazorpayPrefill;
  theme?: RazorpayTheme;
  handler: (response: RazorpayPaymentResponse) => void;
  modal?: RazorpayModalOptions;
}

interface RazorpayInstance {
  open: () => void;
  on: (
    event: 'payment.failed',
    handler: (response: RazorpayPaymentFailedResponse) => void,
  ) => void;
}

interface RazorpayConstructor {
  new (options: RazorpayOptions): RazorpayInstance;
}

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

// ── Domain types ──────────────────────────────────────────────────────────────

/**
 * The `paymentOrder` object returned by POST /api/subscriptions/upgrade.
 */
export interface PaymentOrder {
  id: string;
  amount: number;
  currency: string;
  keyId: string;
}

export interface CheckoutUserInfo {
  name?: string;
  email?: string;
  contact?: string;
}

export interface OpenRazorpayCheckoutParams {
  order: PaymentOrder;
  userInfo?: CheckoutUserInfo;
  planName?: string;
  onSuccess: (response: RazorpayPaymentResponse) => void;
  onDismiss?: (error?: unknown) => void;
}

// ── Script loader ─────────────────────────────────────────────────────────────

/**
 * Loads the Razorpay Checkout script once and caches the promise, so calling
 * this multiple times (e.g. user opens the upgrade modal more than once in a
 * session) doesn't re-inject duplicate <script> tags.
 */
let razorpayScriptPromise: Promise<true> | null = null;

function loadRazorpayScript(): Promise<true> {
  if (razorpayScriptPromise) return razorpayScriptPromise;

  razorpayScriptPromise = new Promise<true>((resolve, reject) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => {
      razorpayScriptPromise = null; // allow retry on next call
      reject(new Error('Failed to load Razorpay checkout script'));
    };
    document.body.appendChild(script);
  });

  return razorpayScriptPromise;
}

// ── Checkout ───────────────────────────────────────────────────────────────────

/**
 * Opens Razorpay Checkout as an in-page modal — no navigation, no new tab.
 *
 * @param params.order      The `paymentOrder` object returned by
 *                           POST /api/subscriptions/upgrade
 *                           ({ id, amount, currency, keyId, ... }).
 * @param params.userInfo   Optional prefill: { name, email, contact }.
 * @param params.planName   Shown in the Checkout header.
 * @param params.onSuccess  Called with the payment response on success.
 * @param params.onDismiss  Called if the user closes the modal without paying.
 */
export async function openRazorpayCheckout({
  order,
  userInfo,
  planName,
  onSuccess,
  onDismiss,
}: OpenRazorpayCheckoutParams): Promise<RazorpayPaymentResponse> {
  await loadRazorpayScript();

  return new Promise<RazorpayPaymentResponse>((resolve, reject) => {
    if (!window.Razorpay) {
      reject(new Error('Razorpay checkout script did not load correctly'));
      return;
    }

    const rzp = new window.Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      order_id: order.id,
      name: 'Engageo',
      description: planName ? `${planName} plan` : 'Subscription upgrade',
      prefill: {
        name: userInfo?.name,
        email: userInfo?.email,
        contact: userInfo?.contact,
      },
      theme: {
        color: '#10b981', // emerald-500, matches the app's accent
      },
      handler: (response) => {
        onSuccess(response);
        resolve(response);
      },
      modal: {
        ondismiss: () => {
          onDismiss?.();
          reject(new Error('Checkout dismissed by user'));
        },
      },
    });

    rzp.on('payment.failed', (response) => {
      reject(response.error);
    });

    rzp.open();
  });
}