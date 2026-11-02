import jsPDF from 'jspdf';
import { QuestionBank, Question } from '@/types';

export function downloadAsTxt(bank: QuestionBank, questions: Question[], isPurchased: boolean) {
  let content = `==================================================\n`;
  content += `${bank.title.toUpperCase()}\n`;
  content += `${bank.subject || ''} ${bank.course_code ? '(' + bank.course_code + ')' : ''}\n`;
  content += `Institution: ${(bank.school || bank.university) || 'N/A'}\n`;
  content += `Total Questions: ${questions.length}${!isPurchased ? ' (Preview)' : ''}\n`;
  content += `Downloaded from PastQ\n`;
  content += `==================================================\n\n`;

  questions.forEach((q) => {
    content += `Q${q.question_number}. ${q.year ? '[' + q.year + '] ' : ''}${q.question_text}\n`;
    ['A', 'B', 'C', 'D', 'E'].forEach((opt) => {
      const optText = q[`option_${opt.toLowerCase()}` as keyof Question] as string;
      if (optText) {
        content += `   ${opt}. ${optText}\n`;
      }
    });

    if (isPurchased && q.correct_answer) {
      content += `   Answer: ${q.correct_answer}\n`;
    }
    if (isPurchased && q.explanation) {
      content += `   Explanation: ${q.explanation}\n`;
    }
    content += `\n`;
  });

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${bank.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_questions.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadAsPdf(bank: QuestionBank, questions: Question[], isPurchased: boolean) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const checkAddPage = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(22, 101, 52); // green-800
  const titleLines = doc.splitTextToSize(bank.title, contentWidth);
  checkAddPage(titleLines.length * 7 + 15);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 7 + 2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // slate-500
  let subText = `${bank.subject || ''}`;
  if (bank.course_code) subText += ` (${bank.course_code})`;
  if ((bank.school || bank.university)) subText += ` • ${(bank.school || bank.university)}`;
  doc.text(subText, margin, y);
  y += 6;

  doc.setFontSize(9);
  doc.text(`Total Questions: ${questions.length}${!isPurchased ? ' (Preview)' : ''} • Downloaded from PastQ Marketplace`, margin, y);
  y += 8;

  // Divider line
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // Questions
  questions.forEach((q) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42); // slate-900

    const qNumText = `Q${q.question_number}. ${q.year ? '[' + q.year + '] ' : ''}`;
    const fullQText = `${qNumText}${q.question_text}`;
    const qLines = doc.splitTextToSize(fullQText, contentWidth);

    checkAddPage(qLines.length * 5 + 10);
    doc.text(qLines, margin, y);
    y += qLines.length * 5 + 2;

    // Options
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);

    ['A', 'B', 'C', 'D', 'E'].forEach((opt) => {
      const optText = q[`option_${opt.toLowerCase()}` as keyof Question] as string;
      if (!optText) return;

      const isCorrect = isPurchased && opt === q.correct_answer;
      if (isCorrect) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(22, 101, 52); // green-800
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85); // slate-700
      }

      const optLine = `${opt}. ${optText}${isCorrect ? '  (Correct Answer)' : ''}`;
      const optLines = doc.splitTextToSize(optLine, contentWidth - 5);
      checkAddPage(optLines.length * 4.5 + 2);
      doc.text(optLines, margin + 4, y);
      y += optLines.length * 4.5 + 1;
    });

    // Explanation
    if (isPurchased && q.explanation) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(79, 70, 229); // indigo-600
      const expLine = `Explanation: ${q.explanation}`;
      const expLines = doc.splitTextToSize(expLine, contentWidth - 5);
      checkAddPage(expLines.length * 4 + 2);
      doc.text(expLines, margin + 4, y);
      y += expLines.length * 4 + 2;
    }

    y += 4; // spacing between questions
  });

  doc.save(`${bank.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_questions.pdf`);
}
