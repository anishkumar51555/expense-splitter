import API from "./api";

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

let loader;

/** Pull in Razorpay's checkout script once, on first use. */
const loadCheckout = () => {
  if (window.Razorpay) return Promise.resolve(true);

  if (!loader) {
    loader = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = CHECKOUT_SRC;
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => {
        loader = null; // let a later attempt retry
        reject(new Error("Could not load the payment window. Check your connection."));
      };
      document.body.appendChild(script);
    });
  }

  return loader;
};

/**
 * Run a full settlement through Razorpay.
 *
 * Creates the order server-side, opens checkout, then hands the result back to
 * the server for signature verification. The share is only marked paid once
 * that verification passes, so a cancelled or failed payment changes nothing.
 *
 * @returns {Promise<{status: "paid"|"dismissed", amount?: number}>}
 */
export const payViaRazorpay = async ({ expenseId, user, onFailure }) => {
  await loadCheckout();

  const { data: order } = await API.post("/payments/order", { expenseId });

  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      order_id: order.orderId,
      name: "Expense Splitter",
      description: `${order.description || "Expense"} — paying ${order.payeeName || "group member"}`,
      theme: { color: "#8b5cf6" },
      prefill: {
        name: user?.name || "",
        email: user?.email || "",
      },
      handler: async (response) => {
        try {
          const { data } = await API.post("/payments/verify", {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
          resolve({ status: "paid", amount: data.amount });
        } catch (err) {
          reject(new Error(err.response?.data?.msg || "We couldn't confirm that payment."));
        }
      },
      modal: {
        // Closing the window is a normal outcome, not an error.
        ondismiss: () => resolve({ status: "dismissed" }),
      },
    });

    rzp.on("payment.failed", (response) => {
      const reason = response?.error?.description || "The payment failed.";
      if (onFailure) onFailure(reason);
      reject(new Error(reason));
    });

    rzp.open();
  });
};

/** Ask the server whether online payments are switched on. */
export const fetchPaymentConfig = async () => {
  try {
    const { data } = await API.get("/payments/config");
    return data;
  } catch {
    return { enabled: false };
  }
};
