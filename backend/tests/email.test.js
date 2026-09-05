const { sendMail, activeTransport } = require("../src/utils/email");

/**
 * Transport selection is what broke in production: SMTP was configured but the
 * host blocked the port, so mail silently stopped. These lock in which
 * transport gets picked and what each provider is actually sent.
 */

const clearTransports = () => {
  delete process.env.BREVO_API_KEY;
  delete process.env.RESEND_API_KEY;
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
};

const mail = {
  to: "someone@example.com",
  subject: "Subject line",
  html: "<p>body</p>",
  text: "body",
};

let realFetch;
let realLog;
let realError;

beforeEach(() => {
  clearTransports();
  realFetch = global.fetch;
  realLog = console.log;
  realError = console.error;
  console.log = () => {};
  console.error = () => {};
});

afterEach(() => {
  clearTransports();
  global.fetch = realFetch;
  console.log = realLog;
  console.error = realError;
});

describe("transport selection", () => {
  it("reports nothing configured when no provider is set", () => {
    expect(activeTransport()).toBeNull();
  });

  it("prefers Brevo over Resend and SMTP", () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "u";
    process.env.SMTP_PASS = "p";
    process.env.RESEND_API_KEY = "re_x";
    process.env.BREVO_API_KEY = "xkeysib-x";
    expect(activeTransport()).toBe("brevo");
  });

  it("prefers Resend over SMTP", () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "u";
    process.env.SMTP_PASS = "p";
    process.env.RESEND_API_KEY = "re_x";
    expect(activeTransport()).toBe("resend");
  });

  it("falls back to SMTP when only SMTP is set", () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "u";
    process.env.SMTP_PASS = "p";
    expect(activeTransport()).toBe("smtp");
  });
});

describe("sendMail", () => {
  it("logs the link instead of throwing when nothing is configured", async () => {
    const result = await sendMail(mail);
    expect(result).toEqual({ delivered: false, reason: "email-not-configured" });
  });

  it("posts to Brevo with a parsed sender and returns the message id", async () => {
    process.env.BREVO_API_KEY = "xkeysib-secret";
    process.env.MAIL_FROM = '"Expense Splitter" <billing@example.com>';

    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 201,
      text: async () => JSON.stringify({ messageId: "<brevo-1>" }),
    }));

    const result = await sendMail(mail);

    expect(result).toEqual({ delivered: true, messageId: "<brevo-1>" });
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(init.headers["api-key"]).toBe("xkeysib-secret");

    const body = JSON.parse(init.body);
    // Quotes a dashboard would keep must not leak into the sender name.
    expect(body.sender).toEqual({ name: "Expense Splitter", email: "billing@example.com" });
    expect(body.to).toEqual([{ email: mail.to }]);
    expect(body.htmlContent).toBe(mail.html);
  });

  it("posts to Resend with a bearer token", async () => {
    process.env.RESEND_API_KEY = "re_secret";
    process.env.MAIL_FROM = "billing@example.com";

    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: "resend-1" }),
    }));

    const result = await sendMail(mail);

    expect(result).toEqual({ delivered: true, messageId: "resend-1" });
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.authorization).toBe("Bearer re_secret");
    // A bare address still gets a display name.
    expect(JSON.parse(init.body).from).toBe("Expense Splitter <billing@example.com>");
  });

  it("reports the provider error rather than throwing", async () => {
    process.env.BREVO_API_KEY = "xkeysib-secret";
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 401,
      text: async () => '{"message":"Key not found"}',
    }));

    const result = await sendMail(mail);

    expect(result.delivered).toBe(false);
    expect(result.reason).toContain("401");
  });
});
