export interface ImageMetadata {
  fileName: string;
  dateTime?: string;
  make?: string;
  model?: string;
  exposure?: string;
  fNumber?: number;
  iso?: number;
  focalLength?: number;
  gps?: {
    latitude: number;
    longitude: number;
  };
  thumbnail?: string;
}

export interface UploadedImage {
  id: string;
  file: File;
  metadata: ImageMetadata;
  preview: string;
}