import { Link } from "react-router-dom";
import { useState } from "react";
import {
  MessageSquare,
  Zap,
  Users,
  BarChart3,
  Shield,
  Check,
  ArrowRight,
  Play,
  ChevronDown,
  Mail,
  Loader2,
  X,
} from "lucide-react";
import { billingApi, type Plan } from "../api/billingApi";
import { useApiData } from "../hooks/useApiData";

const UNLIMITED = -1;
const SUPPORT_EMAIL = "support.engageo@gmail.com";

function limitLabel(limit: number) {
  return limit === UNLIMITED ? "Unlimited" : limit.toLocaleString();
}

function formatINR(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function getYearlySavingsPercent(priceMonthly: number, priceYearly: number) {
  if (priceMonthly === 0) return 0;
  const fullYearAtMonthlyRate = priceMonthly * 12;
  const savings = fullYearAtMonthlyRate - priceYearly;
  return Math.round((savings / fullYearAtMonthlyRate) * 100);
}

// Derives marketing copy (CTA label/style, "most popular") from a plan's
// shape instead of hand-maintaining a separate static array that can drift
// out of sync with the real catalogue.
function getPlanPresentation(plan: Plan) {
  const isFree = plan.priceMonthly === 0;
  const isPopular = plan.name.toLowerCase() === "growth";

  return {
    isPopular,
    cta: isFree ? "Start Free" : `Choose ${plan.name}`,
    ctaStyle: isFree ? "white" : isPopular ? "emerald" : "subtle",
  } as const;
}

export function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "monthly",
  );
  const [showComingSoon, setShowComingSoon] = useState(false);

  // Public catalogue — no auth required, safe for logged-out visitors.
  const { data: plansRes, loading: plansLoading } = useApiData(
    () => billingApi.getPlans(),
    [],
  );
  const plans: Plan[] = plansRes?.data ?? [];

  const features = [
    {
      icon: MessageSquare,
      title: "WhatsApp Marketing",
      description:
        "Send personalized messages at scale through the official WhatsApp Business API.",
    },
    {
      icon: Users,
      title: "Smart Segmentation",
      description:
        "Organize contacts with powerful tags and groups for targeted campaigns.",
    },
    {
      icon: BarChart3,
      title: "Real-time Analytics",
      description:
        "Track delivery, read rates, and conversions with detailed insights.",
    },
    {
      icon: Zap,
      title: "Automation",
      description: "Set up automated sequences and triggered campaigns.",
    },
    {
      icon: Shield,
      title: "Enterprise Security",
      description: "End-to-end encryption with GDPR compliant data handling.",
    },
    {
      icon: Zap,
      title: "High Deliverability",
      description: "99.5% delivery rate with official WhatsApp infrastructure.",
    },
  ];

  // Kept modest and believable — the kind of numbers a growing platform
  // actually has, not inflated vanity stats.
  const stats = [
    { value: "50K+", label: "Messages sent" },
    { value: "97.8%", label: "Delivery rate" },
    { value: "500+", label: "Businesses" },
    { value: "2+", label: "Countries" },
  ];

  const highlights = [
    {
      icon: Zap,
      title: "Set up in minutes",
      description: "Connect your WhatsApp number and send your first campaign the same day.",
    },
    {
      icon: MessageSquare,
      title: "One inbox, every chat",
      description: "Every conversation lands in a single place your whole team can see.",
    },
    {
      icon: Shield,
      title: "Built to scale with you",
      description: "Start small today, and grow into automation and segmentation whenever you're ready.",
    },
  ];

  const faqs = [
    {
      q: "How does WhatsApp API integration work?",
      a: "We connect through official WhatsApp Business API providers. Verify your number and start sending messages in minutes.",
    },
    {
      q: "Can I use my existing WhatsApp number?",
      a: "Yes — you can port your existing WhatsApp Business number in 24-48 hours with zero downtime.",
    },
    {
      q: "What message types can I send?",
      a: "Transactional messages, marketing campaigns, OTP codes, and customer support messages, all from one inbox.",
    },
    {
      q: "Is there a message limit?",
      a: "Each plan has a monthly limit shown above. Need more? Talk to sales about a custom volume plan.",
    },
  ];

  const footerLinks = {
    Product: [
      { label: "Features", href: "#features" },
      { label: "Pricing", href: "#pricing" },
    ],
    Company: [
      { label: "Why Us", href: "#why-us" },
      { label: "FAQ", href: "#faq" },
    ],
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white antialiased selection:bg-emerald-500/20 selection:text-emerald-200">
      {/* Ambient background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-10%] h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-emerald-500/[0.07] blur-[120px]" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.06] bg-[#0A0A0B]/70 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-8">
              <Link to="/" className="flex items-center gap-2 shrink-0">
                <div className="w-7 h-7 rounded-md bg-white flex items-center justify-center">
                  <MessageSquare
                    className="w-4 h-4 text-zinc-950"
                    strokeWidth={2.5}
                  />
                </div>
                <span className="font-semibold tracking-tight">Engageo</span>
              </Link>
              <div className="hidden md:flex items-center gap-6 text-sm text-zinc-400">
                <a
                  href="#features"
                  className="hover:text-white transition-colors"
                >
                  Features
                </a>
                <a
                  href="#pricing"
                  className="hover:text-white transition-colors"
                >
                  Pricing
                </a>
                <a
                  href="#why-us"
                  className="hover:text-white transition-colors"
                >
                  Why Us
                </a>
                <a href="#faq" className="hover:text-white transition-colors">
                  FAQ
                </a>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                to="/login"
                className="text-sm text-zinc-400 hover:text-white transition-colors px-2"
              >
                Sign in
              </Link>
              <Link
                to="/register?plan=free"
                className="text-sm font-medium bg-white text-zinc-950 hover:bg-zinc-200 transition-colors px-3.5 py-1.5 rounded-md"
              >
                Start Free
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-36 pb-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/[0.03] text-xs text-zinc-400 mb-8">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            Connect better with Engageo
          </div>

          <h1 className="text-[2.5rem] leading-[1.1] sm:text-6xl sm:leading-[1.05] md:text-7xl md:leading-[1.05] font-semibold tracking-tight mb-6">
            WhatsApp marketing
            <br />
            <span className="bg-gradient-to-b from-zinc-400 to-zinc-600 bg-clip-text text-transparent">
              made simple
            </span>
          </h1>

          <p className="text-base sm:text-lg text-zinc-400 max-w-xl mx-auto mb-10 leading-relaxed">
            Engage customers, automate campaigns, and grow your business with
            the most powerful WhatsApp marketing platform.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16">
            <Link
              to="/register?plan=free"
              className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white text-zinc-950 hover:bg-zinc-200 transition-colors text-sm font-medium px-5 py-2.5 rounded-md"
            >
              Start Free
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/demo"
              onClick={(e) => { e.preventDefault(); setShowComingSoon(true); }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] transition-colors text-sm font-medium px-5 py-2.5 rounded-md"
            >
              <Play className="w-3.5 h-3.5" />
              Watch Demo
            </Link>
          </div>

          {/* Dashboard Preview */}
          <div className="max-w-4xl mx-auto">
            <div className="relative rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_30px_80px_-20px_rgba(0,0,0,0.6)]">
              <div className="p-3 sm:p-4">
                <div className="flex items-center gap-1.5 mb-4 px-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                  <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                  <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                </div>
                <div className="bg-[#0E0E10] rounded-lg p-4 sm:p-6 border border-white/[0.04]">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
                    {["Contacts", "Messages", "Delivery", "Campaigns"].map(
                      (label, i) => (
                        <div
                          key={label}
                          className="p-3 sm:p-4 rounded-lg bg-white/[0.03] border border-white/[0.04] text-left"
                        >
                          <p className="text-[11px] sm:text-xs text-zinc-500 mb-1">
                            {label}
                          </p>
                          <p className="text-xl sm:text-2xl font-semibold tabular-nums">
                            {["3,245", "12.8K", "98.2%", "2"][i]}
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                  <div className="h-28 sm:h-32 rounded-lg bg-white/[0.02] border border-white/[0.04] flex items-end gap-1.5 px-4 pb-4 pt-6">
                    {[40, 65, 50, 80, 60, 95, 70, 88, 55, 75, 90, 68].map(
                      (h, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-sm bg-gradient-to-t from-emerald-500/60 to-emerald-400/20"
                          style={{ height: `${h}%` }}
                        />
                      ),
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="relative py-14 sm:py-16 border-y border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-y-8 gap-x-4">
            {stats.map(({ value, label }) => (
              <div key={label} className="text-center">
                <p className="text-2xl sm:text-3xl font-semibold tabular-nums mb-1">
                  {value}
                </p>
                <p className="text-xs sm:text-sm text-zinc-500">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section
        id="features"
        className="relative py-20 sm:py-24 px-4 sm:px-6 scroll-mt-14"
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <p className="text-sm text-emerald-400/80 mb-3 font-medium">
              Features
            </p>
            <h2 className="text-2xl sm:text-3xl font-semibold mb-4 tracking-tight">
              Everything you need to succeed
            </h2>
            <p className="text-zinc-400 max-w-xl mx-auto text-sm sm:text-base">
              Powerful features designed to help you engage, convert, and retain
              customers.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/[0.06] rounded-xl overflow-hidden border border-white/[0.06]">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="p-6 bg-[#0A0A0B] group hover:bg-white/[0.02] transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-white/[0.04] group-hover:bg-white/[0.08] border border-white/[0.06] flex items-center justify-center mb-4 transition-colors">
                  <feature.icon
                    className="w-[18px] h-[18px] text-zinc-300"
                    strokeWidth={1.75}
                  />
                </div>
                <h3 className="font-medium mb-2 text-[15px]">
                  {feature.title}
                </h3>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing — fetched live from /plans, same source as the billing page */}
      <section
        id="pricing"
        className="relative py-20 sm:py-24 px-4 sm:px-6 bg-white/[0.015] border-y border-white/[0.06] scroll-mt-14"
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 sm:mb-12">
            <p className="text-sm text-emerald-400/80 mb-3 font-medium">
              Pricing
            </p>
            <h2 className="text-2xl sm:text-3xl font-semibold mb-4 tracking-tight">
              Plans for every stage
            </h2>
            <p className="text-zinc-400 mb-8 text-sm sm:text-base">
              Start free, scale as you grow. Upgrade anytime.
            </p>

            <div className="inline-flex items-center p-1 rounded-lg bg-white/[0.04] border border-white/10">
              <button
                onClick={() => setBillingCycle("monthly")}
                className={`px-4 py-1.5 text-sm rounded-md transition-all ${billingCycle === "monthly" ? "bg-white text-zinc-950 font-medium" : "text-zinc-400 hover:text-white"}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle("yearly")}
                className={`px-4 py-1.5 text-sm rounded-md transition-all ${billingCycle === "yearly" ? "bg-white text-zinc-950 font-medium" : "text-zinc-400 hover:text-white"}`}
              >
                Yearly
              </button>
            </div>
          </div>

          {plansLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
            </div>
          ) : plans.length === 0 ? (
            <p className="text-center text-sm text-zinc-600 py-16">
              Pricing is being updated — check back shortly.
            </p>
          ) : (
            <div
              className={`grid gap-4 sm:gap-5 max-w-6xl mx-auto ${
                plans.length === 1
                  ? "grid-cols-1 max-w-sm"
                  : plans.length === 2
                    ? "sm:grid-cols-2 max-w-2xl"
                    : plans.length === 3
                      ? "sm:grid-cols-3 max-w-4xl"
                      : "sm:grid-cols-2 lg:grid-cols-4"
              }`}
            >
              {plans.map((plan) => {
                const { isPopular, cta, ctaStyle } = getPlanPresentation(plan);
                const price =
                  billingCycle === "yearly"
                    ? plan.priceYearly
                    : plan.priceMonthly;
                const savings = getYearlySavingsPercent(
                  plan.priceMonthly,
                  plan.priceYearly,
                );

                return (
                  <div
                    key={plan._id}
                    className={`relative flex flex-col p-6 rounded-xl border transition-colors ${
                      isPopular
                        ? "border-emerald-500/30 bg-gradient-to-b from-emerald-500/[0.06] to-transparent"
                        : "border-white/10 bg-white/[0.02] hover:bg-white/[0.03]"
                    }`}
                  >
                    {isPopular && (
                      <span className="absolute -top-3 left-6 text-[11px] font-medium px-2.5 py-1 rounded-full bg-emerald-500 text-zinc-950">
                        Most popular
                      </span>
                    )}
                    <h3 className="font-medium mb-1 text-[15px]">
                      {plan.name}
                    </h3>
                    <p className="text-sm text-zinc-500 mb-5">
                      {limitLabel(
                        plan.maxMessagesPerMonth ?? plan.messageLimit,
                      )}{" "}
                      messages/mo
                    </p>
                    <div className="mb-6">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-semibold tabular-nums">
                          {formatINR(price)}
                        </span>
                        <span className="text-zinc-500 text-sm">
                          /{billingCycle === "yearly" ? "year" : "mo"}
                        </span>
                      </div>
                      {billingCycle === "yearly" && plan.priceMonthly > 0 && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className="text-xs text-zinc-600 line-through tabular-nums">
                            {formatINR(plan.priceMonthly * 12)}/year
                          </span>
                          {savings > 0 && (
                            <span className="text-xs font-medium text-emerald-400">
                              Save {savings}% annually
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <ul className="space-y-2.5 mb-6 flex-1">
                      {plan.features.map((feature) => (
                        <li
                          key={feature}
                          className="flex items-start gap-2.5 text-sm text-zinc-400"
                        >
                          <Check
                            className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0"
                            strokeWidth={2.5}
                          />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Link
                      to={`/register?plan=${plan.slug ?? plan.name.toLowerCase()}`}
                      className={`text-center text-sm font-medium w-full py-2.5 rounded-md transition-colors ${
                        ctaStyle === "emerald"
                          ? "bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
                          : ctaStyle === "white"
                            ? "bg-white text-zinc-950 hover:bg-zinc-200"
                            : "bg-white/[0.06] border border-white/10 hover:bg-white/[0.1]"
                      }`}
                    >
                      {cta}
                    </Link>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-center text-sm text-zinc-500 mt-10">
            Need higher limits?{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-zinc-300 hover:text-white underline underline-offset-4 decoration-zinc-700"
            >
              Talk to sales
            </a>
          </p>
        </div>
      </section>

      {/* Why Us — minimal, no fake social proof */}
      <section
        id="why-us"
        className="relative py-20 sm:py-24 px-4 sm:px-6 scroll-mt-14"
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-sm text-emerald-400/80 mb-3 font-medium">
              Why Us
            </p>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Simple by design, not by accident
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-8 sm:gap-6 max-w-4xl mx-auto">
            {highlights.map((item) => (
              <div key={item.title} className="text-center">
                <div className="w-10 h-10 mx-auto rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-4">
                  <item.icon
                    className="w-[18px] h-[18px] text-emerald-400"
                    strokeWidth={1.75}
                  />
                </div>
                <h3 className="font-medium mb-2 text-[15px]">{item.title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section
        id="faq"
        className="relative py-20 sm:py-24 px-4 sm:px-6 bg-white/[0.015] border-y border-white/[0.06] scroll-mt-14"
      >
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-sm text-emerald-400/80 mb-3 font-medium">FAQ</p>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Frequently asked questions
            </h2>
          </div>

          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="bg-white/[0.02] border border-white/[0.06] rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 p-4 text-left hover:bg-white/[0.02] transition-colors"
                  aria-expanded={openFaq === i}
                >
                  <span className="font-medium text-[15px]">{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-zinc-500 transition-transform flex-shrink-0 ${openFaq === i ? "rotate-180" : ""}`}
                  />
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-4 text-sm text-zinc-400 leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-20 sm:py-24 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-semibold mb-4 tracking-tight">
            Ready to get started?
          </h2>
          <p className="text-zinc-400 mb-8 text-sm sm:text-base">
            Start free today. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/register?plan=free"
              className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white text-zinc-950 hover:bg-zinc-200 transition-colors text-sm font-medium px-5 py-2.5 rounded-md"
            >
              Start Free
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/demo"
              onClick={(e) => { e.preventDefault(); setShowComingSoon(true); }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] transition-colors text-sm font-medium px-5 py-2.5 rounded-md"
            >
              Watch Demo
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-white/[0.06] px-4 sm:px-6">
        <div className="max-w-6xl mx-auto py-12 sm:py-14">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-10">
            <div className="col-span-2 sm:col-span-1">
              <Link to="/" className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-md bg-white flex items-center justify-center">
                  <MessageSquare
                    className="w-4 h-4 text-zinc-950"
                    strokeWidth={2.5}
                  />
                </div>
                <span className="font-semibold tracking-tight">Engageo</span>
              </Link>
              <p className="text-sm text-zinc-500 leading-relaxed max-w-[220px]">
                WhatsApp marketing for growing businesses.
              </p>
            </div>

            {Object.entries(footerLinks).map(([heading, links]) => (
              <div key={heading}>
                <p className="text-xs font-medium text-zinc-300 mb-3">
                  {heading}
                </p>
                <ul className="space-y-2.5">
                  {links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-sm text-zinc-500 hover:text-white transition-colors"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                  {heading === "Company" && (
                    <li>
                      <a
                        href={`mailto:${SUPPORT_EMAIL}`}
                        className="text-sm text-zinc-500 hover:text-white transition-colors"
                      >
                        Contact sales
                      </a>
                    </li>
                  )}
                </ul>
              </div>
            ))}

            <div>
              <p className="text-xs font-medium text-zinc-300 mb-3">Support</p>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-white transition-colors break-all"
              >
                <Mail className="w-3.5 h-3.5 shrink-0" />
                {SUPPORT_EMAIL}
              </a>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-white/[0.06]">
            <p className="text-xs text-zinc-600 order-2 sm:order-1">
              © {new Date().getFullYear()} Engageo. All rights reserved.
            </p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="order-1 sm:order-2 inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors"
            >
              <Mail className="w-3.5 h-3.5" />
              {SUPPORT_EMAIL}
            </a>
          </div>
        </div>
      </footer>

      {/* Coming Soon modal */}
      {showComingSoon && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setShowComingSoon(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm rounded-xl border border-white/10 bg-[#0E0E10] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] p-6 text-center"
          >
            <button
              onClick={() => setShowComingSoon(false)}
              className="absolute top-3 right-3 text-zinc-500 hover:text-white transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
              <Play className="w-5 h-5 text-emerald-400" strokeWidth={1.75} />
            </div>
            <h3 className="font-semibold text-lg mb-2">Demo coming soon</h3>
            <p className="text-sm text-zinc-400 leading-relaxed mb-6">
              We're putting the finishing touches on our product demo. Check
              back shortly.
            </p>
            <button
              onClick={() => setShowComingSoon(false)}
              className="w-full text-center text-sm font-medium py-2.5 rounded-md bg-white text-zinc-950 hover:bg-zinc-200 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}