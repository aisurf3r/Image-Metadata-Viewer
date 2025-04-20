import ExifReader from 'exifreader';
import { ImageMetadata } from '../types';

export const extractImageMetadata = async (file: File): Promise<ImageMetadata> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        if (!e.target?.result) {
          throw new Error('Failed to read file');
        }
        
        const options = {
          expanded: true,
          includeUnknown: true,
          reviveValues: true,
          translateKeys: true,
          translateValues: true,
        };
        
        const timeoutPromise = new Promise<any>((_, reject) => {
          setTimeout(() => reject(new Error('EXIF extraction timeout')), 10000);
        });
        
        const tags = await Promise.race([
          ExifReader.load(e.target.result, options),
          timeoutPromise
        ]).catch(err => {
          console.warn('EXIF extraction issue:', err);
          return {};
        });

        // Log temporal para diagnóstico en móviles
        console.log('Raw EXIF Tags:', JSON.stringify(tags, null, 2));
        
        if (!tags || Object.keys(tags).length === 0) {
          console.warn('No EXIF data found or extraction failed');
          return resolve({ fileName: file.name });
        }
        
        const gpsData = findGpsData(tags);
        
        const make = findValue(tags, [
          'Make', 'Manufacturer', 'CameraManufacturer', 'xmp:Make',
          'Software', 'DeviceManufacturer', 'MakerNote', 'Brand',
          'Producer', 'CameraMake', 'Vendor'
        ])?.trim();

        const model = findValue(tags, [
          'Model', 'CameraModel', 'DeviceModel', 'xmp:Model',
          'CameraModelName', 'CameraType', 'HandlerType',
          'DeviceName', 'PhoneModel'
        ])?.trim();
        
        const cleanModel = model && make ? 
          (model.toLowerCase().includes(make.toLowerCase()) ? 
            model : 
            `${make} ${model}`) :
          model;
        
        const metadata: ImageMetadata = {
          fileName: file.name,
          dateTime: findValue(tags, [
            'DateTimeOriginal', 'DateTime', 'CreateDate', 'ModifyDate', 
            'xmp:CreateDate', 'MediaCreateDate', 'DateCreated', 'ContentCreateDate'
          ]),
          make,
          model: cleanModel,
          exposure: extractExposureTime(tags),
          fNumber: extractFNumber(tags),
          iso: extractISO(tags),
          focalLength: extractFocalLength(tags),
          software: findValue(tags, ['Software', 'ProcessingSoftware', 'Creator']),
          orientation: extractOrientation(tags),
          resolution: extractResolution(tags),
          whiteBalance: findValue(tags, ['WhiteBalance', 'WB']),
          flash: findValue(tags, ['Flash', 'FlashMode', 'FlashFired']),
          lens: findValue(tags, ['LensModel', 'Lens', 'LensInfo', 'LensMake']),
          gps: gpsData
        };
        
        resolve(metadata);
        
      } catch (error) {
        console.error('Error extracting EXIF metadata:', error);
        resolve({
          fileName: file.name
        });
      }
    };
    
    reader.onerror = () => {
      console.error('Error reading file');
      resolve({
        fileName: file.name
      });
    };
    
    reader.readAsArrayBuffer(file);
  });
};

function findValue(tags: any, possibleKeys: string[]): string | undefined {
  if (!tags) return undefined;
  
  for (const key of possibleKeys) {
    if (tags[key]?.description) return tags[key].description;
    if (tags[key]?.value !== undefined) return String(tags[key].value);
    if (typeof tags[key] === 'string' || typeof tags[key] === 'number') return String(tags[key]);
  }
  
  const subObjects = ['xmp', 'exif', 'gps', 'GPS', 'ifd0', 'ifd1', 'apple', 'samsung', 
                     'google', 'huawei', 'xiaomi', 'oppo', 'vivo', 'motorola', 'lg'];
  
  for (const subObj of subObjects) {
    if (!tags[subObj]) continue;
    
    for (const key of possibleKeys) {
      if (tags[subObj][key]?.description) return tags[subObj][key].description;
      if (tags[subObj][key]?.value !== undefined) return String(tags[subObj][key].value);
      if (typeof tags[subObj][key] === 'string' || typeof tags[subObj][key] === 'number') {
        return String(tags[subObj][key]);
      }
    }
  }
  
  return searchInNestedPaths(tags, possibleKeys);
}

function searchInNestedPaths(tags: any, possibleKeys: string[]): string | undefined {
  const devicePaths = [
    'MakerNote.Apple', 'apple.tags', 'Apple',
    'MakerNote.Samsung', 'samsung.tags', 'Samsung',
    'MakerNote.Huawei', 'huawei.tags', 'Huawei',
    'MakerNote.Google', 'google.tags', 'Google',
    'geo', 'location', 'coordinates',
    'Composite.GPSPosition'
  ];
  
  for (const path of devicePaths) {
    const parts = path.split('.');
    let current = tags;
    
    for (const part of parts) {
      if (!current[part]) break;
      current = current[part];
      
      for (const key of possibleKeys) {
        if (current[key]?.description) return current[key].description;
        if (current[key]?.value !== undefined) return String(current[key].value);
        if (typeof current[key] === 'string' || typeof current[key] === 'number') {
          return String(current[key]);
        }
      }
    }
  }
  
  return undefined;
}

function findGpsData(tags: any): { latitude: number, longitude: number } | undefined {
  // 1. Check for iOS location format
  if (tags.apple?.Location) {
    const lat = parseFloat(tags.apple.Location.Latitude?.value || tags.apple.Location.Latitude);
    const lon = parseFloat(tags.apple.Location.Longitude?.value || tags.apple.Location.Longitude);
    if (isValidCoordinate(lat, lon)) return { latitude: lat, longitude: lon };
  }

  // 2. Check for Android manufacturers
  const androidManufacturers = ['samsung', 'google', 'huawei', 'xiaomi', 'oppo', 'vivo', 'motorola', 'lg'];
  for (const manufacturer of androidManufacturers) {
    if (tags[manufacturer]?.Location) {
      const lat = parseFloat(tags[manufacturer].Location.Latitude?.value || tags[manufacturer].Location.Latitude);
      const lon = parseFloat(tags[manufacturer].Location.Longitude?.value || tags[manufacturer].Location.Longitude);
      if (isValidCoordinate(lat, lon)) return { latitude: lat, longitude: lon };
    }
  }

  // 3. Check for XMP Location
  if (tags.xmp?.Location) {
    const lat = parseFloat(tags.xmp.Location.Latitude?.value || tags.xmp.Location.Latitude);
    const lon = parseFloat(tags.xmp.Location.Longitude?.value || tags.xmp.Location.Longitude);
    if (isValidCoordinate(lat, lon)) return { latitude: lat, longitude: lon };
  }

  // 4. Check Composite.GPSPosition (common in mobile)
  if (tags.Composite?.GPSPosition?.description) {
    const coords = tags.Composite.GPSPosition.description.split(/, |,/);
    if (coords.length === 2) {
      const lat = parseFloat(coords[0]);
      const lon = parseFloat(coords[1]);
      if (isValidCoordinate(lat, lon)) return { latitude: lat, longitude: lon };
    }
  }

  // 5. Check standard GPS tags
  if (tags.GPSLatitude && tags.GPSLongitude) {
    try {
      let lat = processGpsValue(tags.GPSLatitude);
      let lon = processGpsValue(tags.GPSLongitude);
      
      if (tags.GPSLatitudeRef?.value === 'S') lat = -lat;
      if (tags.GPSLongitudeRef?.value === 'W') lon = -lon;
      
      if (isValidCoordinate(lat, lon)) return { latitude: lat, longitude: lon };
    } catch (e) {
      console.warn("Error processing direct GPS coordinates:", e);
    }
  }

  // 6. Check for nested GPS objects
  const possibleGpsObjects = [tags.GPS, tags.gps, tags.GPSInfo, tags['GPS Info'], tags.exif?.GPS];
  for (const gpsObj of possibleGpsObjects.filter(Boolean)) {
    const latValue = getGpsCoordinate(gpsObj, ['GPSLatitude', 'Latitude', 'GpsLatitude', 'lat']);
    const lonValue = getGpsCoordinate(gpsObj, ['GPSLongitude', 'Longitude', 'GpsLongitude', 'lon']);
    
    if (latValue !== undefined && lonValue !== undefined) {
      try {
        let lat = typeof latValue === 'number' ? latValue : convertCoordinates(String(latValue));
        let lon = typeof lonValue === 'number' ? lonValue : convertCoordinates(String(lonValue));
        
        const latRef = getGpsRef(gpsObj, ['GPSLatitudeRef', 'LatitudeRef']) || 'N';
        const lonRef = getGpsRef(gpsObj, ['GPSLongitudeRef', 'LongitudeRef']) || 'E';
        
        if (latRef === 'S') lat = -Math.abs(lat);
        if (lonRef === 'W') lon = -Math.abs(lon);
        
        if (isValidCoordinate(lat, lon)) return { latitude: lat, longitude: lon };
      } catch (e) {
        console.warn("Error processing GPS coordinates:", e);
      }
    }
  }

  // 7. Check for array-style coordinates
  if (tags.location?.coordinates || tags.coordinates) {
    const coords = tags.location?.coordinates || tags.coordinates;
    if (Array.isArray(coords) {
      const lon = parseFloat(coords[0]);
      const lat = parseFloat(coords[1]);
      if (isValidCoordinate(lat, lon)) return { latitude: lat, longitude: lon };
    }
  }

  return undefined;
}

function isValidCoordinate(latitude: number, longitude: number): boolean {
  if (isNaN(latitude) || isNaN(longitude)) return false;
  if (latitude < -90 || latitude > 90) return false;
  if (longitude < -180 || longitude > 180) return false;
  
  // Allow 0,0 only if there's explicit GPS tags
  if (latitude === 0 && longitude === 0) {
    return tags?.GPSLatitude !== undefined && tags?.GPSLongitude !== undefined;
  }
  
  return true;
}

function processGpsValue(gpsData: any): number {
  if (!gpsData) return 0;
  
  if (gpsData.value !== undefined) {
    if (Array.isArray(gpsData.value)) return processCoordinateArray(gpsData.value);
    if (typeof gpsData.value === 'number') return gpsData.value;
    if (typeof gpsData.value === 'string') return convertCoordinates(gpsData.value);
  }
  
  if (Array.isArray(gpsData)) return processCoordinateArray(gpsData);
  if (typeof gpsData === 'number') return gpsData;
  if (typeof gpsData === 'string') return convertCoordinates(gpsData);
  
  return 0;
}

function getGpsCoordinate(obj: any, possibleKeys: string[]): string | number | any[] | undefined {
  if (!obj) return undefined;
  
  for (const key of possibleKeys) {
    if (obj[key]?.description) return obj[key].description;
    if (obj[key]?.value !== undefined) return obj[key].value;
    if (Array.isArray(obj[key]) || typeof obj[key] === 'number' || typeof obj[key] === 'string') {
      return obj[key];
    }
  }
  
  return undefined;
}

function getGpsRef(obj: any, possibleKeys: string[]): string | undefined {
  if (!obj) return undefined;
  
  for (const key of possibleKeys) {
    if (obj[key]?.description) return obj[key].description;
    if (typeof obj[key] === 'string') return obj[key];
    if (obj[key]?.value !== undefined) return obj[key].value;
  }
  
  return undefined;
}

function processCoordinateArray(coordArray: any[]): number {
  if (!coordArray?.length) return 0;
  
  const numericArray = coordArray.map(item => {
    if (typeof item === 'number') return item;
    if (typeof item === 'string') return parseFloat(item);
    if (item?.value !== undefined) return parseFloat(item.value);
    return 0;
  });
  
  if (numericArray.length >= 3) {
    return numericArray[0] + (numericArray[1] / 60) + (numericArray[2] / 3600);
  }
  if (numericArray.length === 2) {
    return numericArray[0] + (numericArray[1] / 60);
  }
  return numericArray[0];
}

function convertCoordinates(coordStr: string): number {
  if (!coordStr) return 0;
  
  // Try simple number first
  if (!isNaN(parseFloat(coordStr))) return parseFloat(coordStr);
  
  // Check bracket format [lat, lon]
  const bracketMatch = coordStr.match(/\[?\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*\]?/);
  if (bracketMatch) return parseFloat(bracketMatch[1]);
  
  // Check comma decimal format (e.g., "52,5163")
  const commaMatch = coordStr.match(/^(-?\d+),(\d+)$/);
  if (commaMatch) return parseFloat(commaMatch[1] + "." + commaMatch[2]);
  
  // Standard DMS formats
  const dmsFormats = [
    /(\d+(?:\.\d+)?)°\s*(\d+(?:\.\d+)?)['′]\s*(\d+(?:\.\d+)?)["″]/,
    /(\d+(?:\.\d+)?)\s*deg\s*(\d+(?:\.\d+)?)['′]\s*(\d+(?:\.\d+)?)["″]/,
    /(\d+)\s*(\d+)\s*(\d+(?:\.\d+)?)/
  ];
  
  for (const format of dmsFormats) {
    const match = coordStr.match(format);
    if (match) {
      const degrees = parseFloat(match[1]);
      const minutes = parseFloat(match[2]);
      const seconds = match[3] ? parseFloat(match[3]) : 0;
      return degrees + (minutes / 60) + (seconds / 3600);
    }
  }
  
  // Fallback to splitting any numbers
  const numbers = coordStr.split(/[^\d.-]+/).filter(Boolean);
  if (numbers.length >= 1) {
    return parseFloat(numbers[0]);
  }
  
  return 0;
}

// Resto de funciones auxiliares (extractExposureTime, extractFNumber, etc.) permanecen iguales
function extractExposureTime(tags: any): string | undefined {
  const exposureValue = findValue(tags, [
    'ExposureTime', 'ShutterSpeedValue', 'Exposure', 'ShutterSpeed',
    'ExpTime', 'Shutter', 'ExposureValue'
  ]);
  
  if (!exposureValue) return undefined;
  
  if (typeof exposureValue === 'string' && exposureValue.includes('/')) {
    return exposureValue;
  }
  
  const value = parseFloat(exposureValue);
  if (!isNaN(value) && value > 0 && value < 1) {
    return `1/${Math.round(1 / value)}`;
  }
  
  return exposureValue;
}

function extractFNumber(tags: any): number | undefined {
  const fNumberStr = findValue(tags, [
    'FNumber', 'ApertureValue', 'Aperture', 'F-Stop', 
    'Fnumber', 'Aperture Value', 'FNumber Value', 'F-number'
  ]);
  
  if (!fNumberStr) return undefined;
  
  const match = String(fNumberStr).match(/f\/(\d+\.?\d*)|(\d+\.?\d*)/);
  if (match) return parseFloat(match[1] || match[2]);
  
  const value = parseFloat(String(fNumberStr));
  return isNaN(value) ? undefined : value;
}

function extractISO(tags: any): number | undefined {
  const isoStr = findValue(tags, [
    'ISOSpeedRatings', 'ISO', 'ISOSpeed', 'BaseISO',
    'ISO Value', 'ISOValue', 'ISO Speed', 'SensitivityType'
  ]);

  if (!isoStr) return undefined;

  const match = String(isoStr).match(/(\d+)/);
  if (match) return parseInt(match[1]);

  const value = parseInt(String(isoStr));
  return isNaN(value) ? undefined : value;
}

function extractFocalLength(tags: any): number | undefined {
  const focalLengthStr = findValue(tags, [
    'FocalLength', 'Focal', 'FocalLengthIn35mmFilm',
    'FocalLength35mm', 'Focal Length', 'Focal Length In 35mm Format'
  ]);
  
  if (!focalLengthStr) return undefined;
  
  const match = String(focalLengthStr).match(/(\d+\.?\d*)\s*mm|(\d+\.?\d*)/);
  if (match) return parseFloat(match[1] || match[2]);
  
  const value = parseFloat(String(focalLengthStr));
  return isNaN(value) ? undefined : value;
}

function extractOrientation(tags: any): number | undefined {
  const orientationStr = findValue(tags, ['Orientation', 'ImageOrientation', 'Image Orientation']);
  
  if (!orientationStr) return undefined;
  
  const match = String(orientationStr).match(/(\d+)/);
  if (match) return parseInt(match[1]);
  
  const value = parseInt(String(orientationStr));
  return isNaN(value) ? undefined : value;
}

function extractResolution(tags: any): string | undefined {
  const xRes = findValue(tags, ['XResolution', 'ImageWidth', 'ExifImageWidth', 'Width']);
  const yRes = findValue(tags, ['YResolution', 'ImageHeight', 'ExifImageHeight', 'Height']);
  
  if (xRes && yRes) {
    const xMatch = String(xRes).match(/(\d+)/);
    const yMatch = String(yRes).match(/(\d+)/);
    
    if (xMatch && yMatch) return `${xMatch[1]} x ${yMatch[1]}`;
    
    const x = parseInt(String(xRes));
    const y = parseInt(String(yRes));
    
    if (!isNaN(x) && !isNaN(y)) return `${x} x ${y}`;
  }
  
  return undefined;
}
