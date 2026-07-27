declare module 'qrcode' {
  type QrModules = { size: number; data: Uint8Array };
  const QRCode: {
    create(value: string, options?: { errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H' }): { modules: QrModules };
    toDataURL(value: string, options?: { width?: number; margin?: number; errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H' }): Promise<string>;
  };
  export default QRCode;
}
