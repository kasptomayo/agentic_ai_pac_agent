import { useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

interface PdfUploaderProps {
  onTextExtracted: (text: string) => void;
}

function PdfUploader({ onTextExtracted }: PdfUploaderProps) {
  const [status, setStatus] = useState('📄 Ready to upload PDF');
  const [fileName, setFileName] = useState('');

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setFileName(file.name);
    setStatus('⏳ Reading PDF…');
    
    try {
      const buffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      const pageCount = pdf.numPages;
      const textChunks: string[] = [];

      for (let pageIndex = 1; pageIndex <= pageCount; pageIndex += 1) {
        const page = await pdf.getPage(pageIndex);
        const content = await page.getTextContent();
        const pageText = content.items.map((item: any) => item.str).join(' ');
        textChunks.push(`Page ${pageIndex}: ${pageText}`);
      }

      const text = textChunks.join('\n\n');
      onTextExtracted(text);
      setStatus(`✅ Loaded ${pageCount} page${pageCount !== 1 ? 's' : ''} from "${file.name}"`);
    } catch (err) {
      setStatus(`❌ Error: ${(err as Error).message}`);
    }
  };

  return (
    <section className="panel">
      <h2>PDF Bank Loan Rules</h2>
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
        <input 
          type="file" 
          accept="application/pdf" 
          onChange={handleFileChange}
          style={{ flex: 1 }}
        />
      </div>
      <div className="status">{status}</div>
    </section>
  );
}

export default PdfUploader;
