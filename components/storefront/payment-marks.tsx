import { Landmark, Wallet } from "lucide-react";

/**
 * Accepted-payment badges for the footer. Simplified inline marks (no image
 * requests, crisp at any DPR) for what Razorpay checkout takes: UPI, the
 * Visa / Mastercard / RuPay card networks, net banking and wallets — keep in
 * sync with the checkout copy.
 */

function UpiMark() {
  return (
    <svg viewBox="0 0 44 18" className="h-[18px] w-auto" aria-hidden>
      <text x="0" y="14.5" fontFamily="Arial, Helvetica, sans-serif" fontSize="15" fontWeight="800" fontStyle="italic" fill="#5F6368">
        UPI
      </text>
      <path d="M33 2l6 7-6 7z" fill="#F47B20" />
      <path d="M37 2l6 7-6 7z" fill="#0F8B45" />
    </svg>
  );
}

function VisaMark() {
  return (
    <svg viewBox="0 0 44 16" className="h-4 w-auto" aria-hidden>
      <text x="1" y="14" fontFamily="Arial, Helvetica, sans-serif" fontSize="16.5" fontWeight="900" fontStyle="italic" letterSpacing="0.3" fill="#1A1F71">
        VISA
      </text>
    </svg>
  );
}

function MastercardMark() {
  return (
    <svg viewBox="0 0 40 24" className="h-6 w-auto" aria-hidden>
      <circle cx="15" cy="12" r="9" fill="#EB001B" />
      <circle cx="25" cy="12" r="9" fill="#F79E1B" />
      <path d="M20 4.52a9 9 0 0 1 0 14.96a9 9 0 0 1 0-14.96z" fill="#FF5F00" />
    </svg>
  );
}

function RupayMark() {
  return (
    <svg viewBox="0 0 56 18" className="h-4 w-auto sm:h-[18px]" aria-hidden>
      <text x="0" y="14" fontFamily="Arial, Helvetica, sans-serif" fontSize="14.5" fontWeight="800" fontStyle="italic" fill="#1B3F8B">
        RuPay
      </text>
      <path d="M47 3l5 6-5 6z" fill="#F47B20" />
      <path d="M51 3l5 6-5 6z" fill="#0F8B45" />
    </svg>
  );
}

const marks = [
  { label: "UPI", Mark: UpiMark },
  { label: "Visa", Mark: VisaMark },
  { label: "Mastercard", Mark: MastercardMark },
  { label: "RuPay", Mark: RupayMark },
];

const tileClass =
  "flex h-9 items-center justify-center rounded-md bg-surface-deep-foreground px-1 sm:px-2.5 shadow-[0_1px_0_rgb(0_0_0/0.08)]";

export function PaymentMarks() {
  return (
    <ul aria-label="Accepted payment methods" className="grid grid-cols-4 gap-2 sm:flex sm:flex-wrap sm:items-center">
      {marks.map(({ label, Mark }) => (
        <li key={label} className={tileClass}>
          <Mark />
          <span className="sr-only">{label}</span>
        </li>
      ))}
      <li className={`${tileClass} col-span-2 gap-1.5 text-[12px] font-semibold text-surface-deep`}>
        <Landmark className="size-4" strokeWidth={1.9} aria-hidden />
        Net banking
      </li>
      <li className={`${tileClass} col-span-2 gap-1.5 text-[12px] font-semibold text-surface-deep`}>
        <Wallet className="size-4" strokeWidth={1.9} aria-hidden />
        Wallets
      </li>
    </ul>
  );
}
