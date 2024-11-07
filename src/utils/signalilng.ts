export function encodeSignalingData(data: any): string {
  return btoa(JSON.stringify(data));
}

export function decodeSignalingData(encodedData: string): any {
  return JSON.parse(atob(encodedData));
}

// Additional utilities for QR code generation and scanning can be added here
