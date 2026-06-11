import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils.js';

const DEFAULT_FAQS = [
  { id: 'd1', question: 'How do I register for a seat?', answer: "Click the 'Register' button and fill out our simple registration form. Once submitted, the admin will review and approve your application." },
  { id: 'd2', question: 'What documents do I need to bring?', answer: 'You need a valid government ID (Aadhaar/PAN), one passport photo, and your first month\'s fee payment.' },
  { id: 'd3', question: 'Can I change my seat?', answer: 'Yes! You can request a seat change from your student portal. Submit a request with your reason and the admin will process it.' },
  { id: 'd4', question: 'What payment methods are accepted?', answer: 'We accept both Cash and UPI payments. You can pay directly or upload a UPI screenshot with your UTR number.' },
  { id: 'd5', question: 'What are the hall timings?', answer: 'Please check the hall timings on our homepage or contact us directly. We strive to offer extended hours for your convenience.' },
  { id: 'd6', question: 'Is there a trial period available?', answer: 'Contact us to enquire about any trial or introductory offers. We occasionally have special rates for new members.' },
];

export default function HallFAQs() {
  const { slug } = useParams();
  const [open, setOpen] = useState(null);

  const { data: hall } = useQuery({
    queryKey: ['public', 'hall', slug],
    queryFn: () => api.get(`/public/${slug}`).then((r) => r.data),
  });

  const { data: faqsData } = useQuery({
    queryKey: ['public', 'faqs', slug],
    queryFn: () => api.get(`/public/${slug}/faqs`).then((r) => r.data),
    staleTime: 1000 * 60 * 10,
  });

  const themeColor = hall?.tenant?.theme_color || '#2563EB';
  const faqs = faqsData && faqsData.length > 0 ? faqsData : DEFAULT_FAQS;

  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-gray-900 font-display">Frequently Asked Questions</h1>
        <p className="text-gray-500 mt-2">Got questions? We've got answers.</p>
      </div>

      <div className="space-y-3">
        {faqs.map((faq, i) => {
          const key = faq.id || i;
          const isOpen = open === key;
          return (
            <div key={key} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-card">
              <button
                className="w-full flex items-center justify-between px-5 py-4 text-left"
                onClick={() => setOpen(isOpen ? null : key)}
                aria-expanded={isOpen}
              >
                <p className="text-sm font-semibold text-gray-900 pr-4">{faq.question}</p>
                <ChevronDown
                  className={cn('h-5 w-5 text-gray-400 flex-shrink-0 transition-transform', isOpen && 'rotate-180')}
                  style={isOpen ? { color: themeColor } : {}}
                />
              </button>
              {isOpen && (
                <div className="px-5 pb-4 pt-0 border-t border-gray-50">
                  <p className="text-sm text-gray-600 leading-relaxed pt-3">{faq.answer}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
