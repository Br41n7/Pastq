// Bump VENDOR_TERMS_VERSION whenever the wording changes — every vendor is then
// asked to re-accept before they can upload, edit or withdraw again.
export const VENDOR_TERMS_VERSION = '2026-10-01';
export const PLATFORM_SHARE_PERCENT = 30;
export const VENDOR_SHARE_PERCENT = 70;
export const MIN_PAYOUT_KOBO = 100_000; // ₦1,000

export const VENDOR_DECLARATIONS = [
  {
    id: 'ownership',
    label:
      'I own the copyright in everything I upload, or I have the copyright holder\'s permission to sell it on PastQ. Where permission is needed, I can produce it on request.',
  },
  {
    id: 'no_leaks',
    label:
      'I will not upload unreleased, leaked or stolen examination material, or anything I obtained by breaking an exam body\'s or institution\'s rules.',
  },
  {
    id: 'third_party',
    label:
      'I will not copy content from textbooks, publishers, exam bodies, lecturers or other vendors\' banks without permission. Compilations I make must add original work (selection, answers, explanations).',
  },
  {
    id: 'accuracy',
    label:
      'I am responsible for the accuracy of my questions, answers and explanations and will correct errors that are reported to me.',
  },
  {
    id: 'moderation',
    label:
      'I understand PastQ may review, edit, unpublish or delete my content, and suspend my account, after a report or a copyright complaint.',
  },
  {
    id: 'revenue',
    label: `I accept the ${VENDOR_SHARE_PERCENT}% vendor / ${PLATFORM_SHARE_PERCENT}% platform revenue split and that payouts are processed manually after review.`,
  },
  {
    id: 'liability',
    label:
      'I accept responsibility for any copyright claim arising from my uploads and will cooperate with takedown requests.',
  },
] as const;

export const VENDOR_TERMS_SECTIONS: { title: string; body: string }[] = [
  {
    title: '1. What you may sell',
    body:
      'You may sell question banks you created, or that you have clear permission to sell. Past papers published by exam bodies (for example WAEC, JAMB, NECO) and questions set by lecturers or institutions are normally protected by copyright. Unless you have permission, upload your own original questions, or substantially original work such as your own worked answers and explanations.',
  },
  {
    title: '2. Licence you give PastQ',
    body:
      'You keep ownership of your content. You give PastQ a non-exclusive licence to host, display, preview, sell and deliver your content to buyers, and to hand it off to Akili for study features, for as long as it is listed and for buyers who already purchased it.',
  },
  {
    title: '3. Reports, review and takedowns',
    body:
      'Buyers can report questions and banks. PastQ may approve, edit, unpublish or delete reported content, and may suspend a vendor, while a report or copyright complaint is investigated. Taking a bank down also ends access for existing buyers of that bank.',
  },
  {
    title: '4. Earnings and payouts',
    body:
      `You receive ${VENDOR_SHARE_PERCENT}% of each sale; PastQ keeps ${PLATFORM_SHARE_PERCENT}%. Requesting a withdrawal reserves that amount from your balance. Minimum withdrawal is ₦1,000, and requests are paid by bank transfer to the account in your settings. PastQ may delay or reject a payout while a copyright or fraud issue is investigated.`,
  },
  {
    title: '5. Repeat or serious infringement',
    body:
      'Accounts that repeatedly upload infringing or leaked material may be suspended or removed, and earnings from infringing content may be withheld where the law requires it.',
  },
];
