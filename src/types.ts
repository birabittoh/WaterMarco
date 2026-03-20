export interface WatermarkInstance {
  x: number;
  y: number;
  scale: number;
  opacity: number;
  negative: boolean;
}

export interface ImageItem {
  id: string;
  name: string;
  dataUrl: string;
  selected: boolean;
  watermarkPosition: WatermarkInstance | null;
  compress: boolean;
  maxSize?: number;
  quality?: number;
}

export interface AppState {
  images: ImageItem[];
  watermark: string | null;
  maxSize: number;
  quality: number;
  watermarkScale: number;
  watermarkOpacity: number;
  watermarkNegative: boolean;
}
