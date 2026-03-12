import { ReactNode } from "react";

type PaymentLayoutProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  maxWidthClass?: string;
};

export default function PaymentLayout({
  title,
  subtitle,
  children,
  maxWidthClass = "max-w-2xl",
}: PaymentLayoutProps) {
  return (
    <div className="payment-screen">
      <div className={`payment-card mx-auto w-full ${maxWidthClass}`}>
        <header className="mb-6">
          <h1 className="payment-title">{title}</h1>
          {subtitle && <p className="payment-subtitle">{subtitle}</p>}
        </header>
        {children}
      </div>
    </div>
  );
}
