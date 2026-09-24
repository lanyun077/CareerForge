declare module 'pdfjs-dist/legacy/build/pdf.mjs' {
  interface TextItem {
    str?: string;
    [key: string]: unknown;
  }
  interface TextContent {
    items: TextItem[];
  }
  interface PDFPageProxy {
    getTextContent(): Promise<TextContent>;
  }
  interface PDFDocumentProxy {
    numPages: number;
    getPage(n: number): Promise<PDFPageProxy>;
    destroy(): Promise<void>;
  }
  interface GetDocumentParams {
    data: Uint8Array;
    useSystemFonts?: boolean;
    isEvalSupported?: boolean;
    [key: string]: unknown;
  }
  export function getDocument(params: GetDocumentParams): { promise: Promise<PDFDocumentProxy>; destroy(): Promise<void> };
}
