import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

type PageOrientation = 'portrait' | 'landscape';

interface ExportPdfOptions {
  element: HTMLElement;
  filename: string;
  orientation?: PageOrientation;
  marginMm?: number;
  scale?: number;
}

interface PrintPreviewOptions {
  element: HTMLElement;
  title: string;
  orientation?: PageOrientation;
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const collectHeadMarkup = () =>
  Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map(node => node.outerHTML)
    .join('\n');

const getPrintOverrides = (orientation: PageOrientation) => `
  <style>
    @page {
      size: A4 ${orientation};
      margin: 10mm;
    }

    html, body, #root, main, section, article, div {
      height: auto !important;
      max-height: none !important;
    }

    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #000000 !important;
      overflow: visible !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    #print-root {
      padding: 0;
      margin: 0;
    }

    .no-print {
      display: none !important;
    }

    .overflow-hidden,
    .overflow-x-auto,
    .overflow-y-auto {
      overflow: visible !important;
    }

    .shadow-sm,
    .shadow-lg,
    .shadow-xl,
    .shadow-2xl {
      box-shadow: none !important;
    }

    table {
      width: 100% !important;
      border-collapse: collapse !important;
      page-break-inside: auto;
    }

    thead {
      display: table-header-group !important;
    }

    tfoot {
      display: table-footer-group !important;
    }

    tr,
    img,
    svg,
    .break-inside-avoid {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
  </style>
`;

const createRenderableClone = (element: HTMLElement) => {
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-10000px';
  host.style.top = '0';
  host.style.opacity = '0';
  host.style.pointerEvents = 'none';
  host.style.background = '#ffffff';
  host.style.padding = '0';
  host.style.margin = '0';
  host.style.zIndex = '-1';

  const clone = element.cloneNode(true) as HTMLElement;
  clone.classList.add('pdf-export');
  clone.style.width = `${Math.max(element.scrollWidth, element.clientWidth, 1024)}px`;
  clone.style.maxWidth = 'none';
  clone.style.overflow = 'visible';
  clone.querySelectorAll('.no-print').forEach(node => node.remove());
  clone
    .querySelectorAll<HTMLElement>('.overflow-hidden, .overflow-x-auto, .overflow-y-auto')
    .forEach(node => {
      node.style.overflow = 'visible';
      node.style.maxHeight = 'none';
      node.style.height = 'auto';
    });

  host.appendChild(clone);
  document.body.appendChild(host);

  return {
    clone,
    cleanup: () => {
      host.remove();
    },
  };
};

export async function exportElementToPdf({
  element,
  filename,
  orientation = 'portrait',
  marginMm = 10,
  scale = 2,
}: ExportPdfOptions) {
  const { clone, cleanup } = createRenderableClone(element);

  try {
    if ('fonts' in document) {
      await (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
    }

    await wait(150);

    const canvas = await html2canvas(clone, {
      scale,
      useCORS: true,
      backgroundColor: '#ffffff',
      windowWidth: clone.scrollWidth,
      windowHeight: clone.scrollHeight,
      scrollX: 0,
      scrollY: 0,
    });

    const pdf = new jsPDF(orientation === 'landscape' ? 'l' : 'p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const renderWidth = pageWidth - marginMm * 2;
    const renderHeight = pageHeight - marginMm * 2;
    const imageHeight = (canvas.height * renderWidth) / canvas.width;
    const imageData = canvas.toDataURL('image/png', 1);

    let remainingHeight = imageHeight;
    let positionY = marginMm;

    pdf.addImage(imageData, 'PNG', marginMm, positionY, renderWidth, imageHeight, undefined, 'FAST');
    remainingHeight -= renderHeight;

    while (remainingHeight > 0) {
      pdf.addPage();
      positionY = marginMm - (imageHeight - remainingHeight);
      pdf.addImage(imageData, 'PNG', marginMm, positionY, renderWidth, imageHeight, undefined, 'FAST');
      remainingHeight -= renderHeight;
    }

    pdf.save(filename);
  } finally {
    cleanup();
  }
}

export function openElementPrintPreview({
  element,
  title,
  orientation = 'portrait',
}: PrintPreviewOptions) {
  const printWindow = window.open('', '_blank', 'width=1280,height=900');
  if (!printWindow) {
    throw new Error('Browser memblokir jendela print preview.');
  }

  const clone = element.cloneNode(true) as HTMLElement;
  clone.classList.add('pdf-export');
  clone.querySelectorAll('.no-print').forEach(node => node.remove());

  const html = `
    <!doctype html>
    <html lang="id">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title}</title>
        ${collectHeadMarkup()}
        ${getPrintOverrides(orientation)}
      </head>
      <body>
        <div id="print-root">${clone.outerHTML}</div>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  const triggerPrint = () => {
    printWindow.focus();
    printWindow.print();
  };

  printWindow.onload = () => {
    window.setTimeout(triggerPrint, 400);
  };
}
