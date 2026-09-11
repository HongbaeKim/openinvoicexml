import { useState, type JSX } from "react";
import { useTranslation } from "../000-core/i18n";
import { faqDict } from "./Faq.i18n";

function FaqRow({
  index,
  question,
  answer,
  isOpen,
  onToggle,
}: {
  index: number;
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={index > 0 ? "border-t border-border" : ""}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-4 bg-transparent px-5 py-4 text-left"
      >
        <span className="text-sm font-semibold text-text">{question}</span>
        <span
          aria-hidden="true"
          className={`flex-none text-text-muted transition-transform duration-200 ${
            isOpen ? "rotate-45" : ""
          }`}
        >
          +
        </span>
      </button>
      <div className="grid transition-all duration-200" style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}>
        <div className="overflow-hidden">
          <p className="px-5 pb-4 text-sm text-text-muted">{answer}</p>
        </div>
      </div>
    </div>
  );
}

export function Faq(): JSX.Element {
  const { t: items } = useTranslation(faqDict);
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="rounded-[10px] border border-border bg-surface">
      {items.map((item, i) => (
        <FaqRow
          key={item.question}
          index={i}
          question={item.question}
          answer={item.answer}
          isOpen={openIndex === i}
          onToggle={() => setOpenIndex(openIndex === i ? null : i)}
        />
      ))}
    </div>
  );
}
