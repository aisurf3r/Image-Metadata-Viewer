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
        
        // Add timeout for mobile devices that might need more processing time
        const timeoutPromise = new Promise<any>((_, reject) => {
          setTimeout(() => reject(new Error('EXIF extraction timeout')), 10000);
        });
        
        // Race between normal extraction and timeout
        const tags = await Promise.race([
          ExifReader.load(e.target.result, options),
          timeoutPromise
        ]).catch(err => {
          console.warn('EXIF extraction issue:', err);
          return {}; // Return empty object on error to avoid complete failure
        });
        
        // Handle case where extraction failed completely
        if (!tags || Object.keys(tags).length === 0) {
          console.warn('No EXIF data found or extraction failed');
          return resolve({ fileName: file.name });
        }
        
        // First try to extract GPS data - this is the focus of our improvement
        const gpsData = findGpsData(tags);
        
        // Extract make and model with broader approach
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
        
        // Avoid make duplication in model
        const cleanModel = model && make ? 
          (model.toLowerCase().includes(make.toLowerCase()) ? 
            model : 
            `${make} ${model}`) :
          model;
        
        // Extract all metadata
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
    
    // For all image types, use readAsArrayBuffer - it works best for EXIF extraction
    reader.readAsArrayBuffer(file);
  });
};

// Find value deeply in the tags object
function findValue(tags: any, possibleKeys: string[]): string | undefined {
  if (!tags) return undefined;
  
  // First search at root level
  for (const key of possibleKeys) {
    if (tags[key] && tags[key].description) {
      return tags[key].description;
    }
    
    if (tags[key] && typeof tags[key].value !== 'undefined') {
      return String(tags[key].value);
    }
    
    // Direct value
    if (tags[key] && (typeof tags[key] === 'string' || typeof tags[key] === 'number')) {
      return String(tags[key]);
    }
  }
  
  // Search in common subobjects
  const subObjects = ['xmp', 'exif', 'gps', 'GPS', 'ifd0', 'ifd1', 'apple', 'samsung', 
                      'canon', 'nikon', 'olympus', 'panasonic', 'sony', 'fujifilm',
                      'google', 'huawei', 'xiaomi', 'oppo', 'vivo', 'oneplus', 'asus'];
  
  for (const subObj of subObjects) {
    if (!tags[subObj]) continue;
    
    for (const key of possibleKeys) {
      if (tags[subObj][key] && tags[subObj][key].description) {
        return tags[subObj][key].description;
      }
      
      if (tags[subObj][key] && typeof tags[subObj][key].value !== 'undefined') {
        return String(tags[subObj][key].value);
      }
      
      // Direct value
      if (tags[subObj][key] && (typeof tags[subObj][key] === 'string' || typeof tags[subObj][key] === 'number')) {
        return String(tags[subObj][key]);
      }
    }
  }
  
  // Search in device-specific paths
  searchInNestedPaths(tags, possibleKeys);
  
  return undefined;
}

// Search in deeply nested paths - especially for mobile devices
function searchInNestedPaths(tags: any, possibleKeys: string[]): string | undefined {
  // Handle more deeply nested paths common in mobile devices
  const devicePaths = [
    'MakerNote.Apple', 'MakerNotes.Apple', 'apple.tags', 'Apple',
    'MakerNote.Samsung', 'MakerNotes.Samsung', 'samsung.tags', 'Samsung',
    'MakerNote.Huawei', 'MakerNotes.Huawei', 'huawei.tags', 'Huawei',
    'MakerNote.Sony', 'MakerNotes.Sony', 'sony.tags', 'Sony',
    'MakerNote.Google', 'MakerNotes.Google', 'google.tags', 'Google',
    'MakerNote.Xiaomi', 'MakerNotes.Xiaomi', 'xiaomi.tags', 'Xiaomi',
    'MakerNote.Oppo', 'MakerNotes.Oppo', 'oppo.tags', 'Oppo',
    'MakerNote.Vivo', 'MakerNotes.Vivo', 'vivo.tags', 'Vivo',
    'MakerNote.OnePlus', 'MakerNotes.OnePlus', 'oneplus.tags', 'OnePlus',
    'MakerNote.Asus', 'MakerNotes.Asus', 'asus.tags', 'Asus',
    'iphoneinfo', 'androidinfo', 'pixelinfo', 'iOS', 'Android'
  ];
  
  for (const path of devicePaths) {
    const parts = path.split('.');
    let current = tags;
    let valid = true;
    
    for (const part of parts) {
      if (!current[part]) {
        valid = false;
        break;
      }
      current = current[part];
    }
    
    if (valid) {
      for (const key of possibleKeys) {
        if (current[key]) {
          if (current[key].description) return current[key].description;
          if (typeof current[key].value !== 'undefined') return String(current[key].value);
          if (typeof current[key] === 'string' || typeof current[key] === 'number') return String(current[key]);
        }
      }
    }
  }
  
  return undefined;
}

// Function specific for finding GPS data in modern cameras/phones
function findGpsData(tags: any): { latitude: number, longitude: number } | undefined {
  // First check for common mobile device location metadata formats
  
  // 1. Check for iOS location format
  if (tags.apple && tags.apple.Location) {
    const latitude = parseFloat(tags.apple.Location.Latitude?.value || tags.apple.Location.Latitude);
    const longitude = parseFloat(tags.apple.Location.Longitude?.value || tags.apple.Location.Longitude);
    
    if (!isNaN(latitude) && !isNaN(longitude)) {
      return { latitude, longitude };
    }
  }
  
  // 2. Check for Android format (various manufacturers)
  const androidManufacturers = ['samsung', 'google', 'huawei', 'xiaomi', 'oppo', 'vivo', 'oneplus', 'asus'];
  for (const manufacturer of androidManufacturers) {
    if (tags[manufacturer] && tags[manufacturer].Location) {
      const latitude = parseFloat(tags[manufacturer].Location.Latitude?.value || tags[manufacturer].Location.Latitude);
      const longitude = parseFloat(tags[manufacturer].Location.Longitude?.value || tags[manufacturer].Location.Longitude);
      
      if (!isNaN(latitude) && !isNaN(longitude)) {
        return { latitude, longitude };
      }
    }
  }
  
  // 3. Check for XMP Location format (used by some mobile apps)
  if (tags.xmp && tags.xmp.Location) {
    const latitude = parseFloat(tags.xmp.Location.Latitude?.value || tags.xmp.Location.Latitude);
    const longitude = parseFloat(tags.xmp.Location.Longitude?.value || tags.xmp.Location.Longitude);
    
    if (!isNaN(latitude) && !isNaN(longitude)) {
      return { latitude, longitude };
    }
  }
  
  // 4. Check for direct geo coordinates (some phones store them directly)
  if (tags.GPSLatitude && tags.GPSLongitude) {
    try {
      let latitude = processGpsValue(tags.GPSLatitude);
      let longitude = processGpsValue(tags.GPSLongitude);
      
      // Apply reference direction
      if (tags.GPSLatitudeRef && tags.GPSLatitudeRef.value === 'S') latitude = -latitude;
      if (tags.GPSLongitudeRef && tags.GPSLongitudeRef.value === 'W') longitude = -longitude;
      
      if (!isNaN(latitude) && !isNaN(longitude)) {
        return { latitude, longitude };
      }
    } catch (e) {
      console.warn("Error processing direct GPS coordinates:", e);
    }
  }
  
  // 5. Common GPS objects
  const possibleGpsObjects = [
    tags.GPS,
    tags.gps,
    tags.GPSInfo,
    tags['GPS Info'],
    tags.exif?.GPS,
    tags.xmp?.GPS
  ].filter(Boolean);
  
  // Also check for coordinates directly in the root
  if (tags.GPSLatitude || tags.GpsLatitude || tags.Latitude) {
    possibleGpsObjects.push(tags);
  }
  
  // Process each possible GPS object
  for (const gpsObj of possibleGpsObjects) {
    // Get latitude value
    const latValue = getGpsCoordinate(gpsObj, [
      'GPSLatitude', 'Latitude', 'GpsLatitude', 'Lat', 'LatitudeValue', 'lat'
    ]);
    
    // Get longitude value
    const lonValue = getGpsCoordinate(gpsObj, [
      'GPSLongitude', 'Longitude', 'GpsLongitude', 'Lon', 'LongitudeValue', 'lng', 'lon'
    ]);
    
    // Get reference directions
    const latRef = getGpsRef(gpsObj, [
      'GPSLatitudeRef', 'LatitudeRef', 'GpsLatitudeRef', 'LatRef', 'latRef'
    ]) || 'N';
    
    const lonRef = getGpsRef(gpsObj, [
      'GPSLongitudeRef', 'LongitudeRef', 'GpsLongitudeRef', 'LonRef', 'lngRef', 'lonRef'
    ]) || 'E';
    
    // Process values based on their type
    if (latValue !== undefined && lonValue !== undefined) {
      try {
        let lat: number;
        let lon: number;
        
        // Handle different data types
        if (typeof latValue === 'number' && typeof lonValue === 'number') {
          lat = latValue;
          lon = lonValue;
        } else if (typeof latValue === 'string' && typeof lonValue === 'string') {
          lat = convertCoordinates(latValue);
          lon = convertCoordinates(lonValue);
        } else if (Array.isArray(latValue) && Array.isArray(lonValue)) {
          lat = processCoordinateArray(latValue);
          lon = processCoordinateArray(lonValue);
        } else {
          // Skip if incompatible types
          continue;
        }
        
        // Apply reference direction
        if (latRef === 'S') lat = -Math.abs(lat);
        if (lonRef === 'W') lon = -Math.abs(lon);
        
        // Validate coordinates
        if (isValidCoordinate(lat, lon)) {
          return { latitude: lat, longitude: lon };
        }
      } catch (e) {
        console.warn("Error processing GPS coordinates:", e);
      }
    }
  }
  
  // 6. Check for LocationIQ format
  if (tags.Location || tags.location || tags.LocationIQ) {
    const locationObj = tags.Location || tags.location || tags.LocationIQ;
    
    if (locationObj.coordinates) {
      const coords = locationObj.coordinates.value || locationObj.coordinates;
      if (Array.isArray(coords) && coords.length >= 2) {
        const latitude = parseFloat(coords[1]);
        const longitude = parseFloat(coords[0]);
        
        if (isValidCoordinate(latitude, longitude)) {
          return { latitude, longitude };
        }
      }
    }
  }
  
  return undefined;
}

// Check if coordinates are valid
function isValidCoordinate(latitude: number, longitude: number): boolean {
  // Check if coordinates are numbers
  if (isNaN(latitude) || isNaN(longitude)) return false;
  
  // Check if coordinates are in valid range
  if (latitude < -90 || latitude > 90) return false;
  if (longitude < -180 || longitude > 180) return false;
  
  // Check if coordinates are not exactly 0,0 (often a default when no real data exists)
  if (latitude === 0 && longitude === 0) return false;
  
  return true;
}

// Process GPS value (handle both objects and direct values)
function processGpsValue(gpsData: any): number {
  if (!gpsData) return 0;
  
  // Handle object with value property
  if (gpsData.value !== undefined) {
    if (Array.isArray(gpsData.value)) {
      return processCoordinateArray(gpsData.value);
    } else if (typeof gpsData.value === 'number') {
      return gpsData.value;
    } else if (typeof gpsData.value === 'string') {
      return convertCoordinates(gpsData.value);
    }
  }
  
  // Handle direct array
  if (Array.isArray(gpsData)) {
    return processCoordinateArray(gpsData);
  }
  
  // Handle direct number
  if (typeof gpsData === 'number') {
    return gpsData;
  }
  
  // Handle direct string
  if (typeof gpsData === 'string') {
    return convertCoordinates(gpsData);
  }
  
  return 0;
}

// Get GPS coordinate from various possible sources
function getGpsCoordinate(obj: any, possibleKeys: string[]): string | number | any[] | undefined {
  if (!obj) return undefined;
  
  for (const key of possibleKeys) {
    if (obj[key]) {
      // Case 1: Description property
      if (obj[key].description) {
        return obj[key].description;
      }
      // Case 2: Direct value property
      if (obj[key].value !== undefined) {
        return obj[key].value;
      }
      // Case 3: Array or direct value
      if (Array.isArray(obj[key]) || typeof obj[key] === 'number' || typeof obj[key] === 'string') {
        return obj[key];
      }
    }
  }
  
  return undefined;
}

// Get GPS reference (N/S/E/W)
function getGpsRef(obj: any, possibleKeys: string[]): string | undefined {
  if (!obj) return undefined;
  
  for (const key of possibleKeys) {
    if (obj[key]) {
      // Case 1: Description property
      if (obj[key].description) {
        return obj[key].description;
      }
      // Case 2: Direct string value
      if (typeof obj[key] === 'string') {
        return obj[key];
      }
      // Case 3: Value property
      if (obj[key].value !== undefined) {
        return obj[key].value;
      }
    }
  }
  
  return undefined;
}

// Convert coordinate array [degrees, minutes, seconds] to decimal
function processCoordinateArray(coordArray: any[]): number {
  if (!coordArray || coordArray.length < 1) return 0;
  
  // Convert all elements to numbers if they're not already
  const numericArray = coordArray.map(item => {
    if (typeof item === 'number') return item;
    if (typeof item === 'string') return parseFloat(item);
    if (item && typeof item.value === 'number') return item.value;
    if (item && typeof item.value === 'string') return parseFloat(item.value);
    return 0;
  });
  
  // Process based on array length
  if (numericArray.length >= 3) {
    // Format: [degrees, minutes, seconds]
    return numericArray[0] + (numericArray[1] / 60) + (numericArray[2] / 3600);
  } else if (numericArray.length === 2) {
    // Format: [degrees, minutes]
    return numericArray[0] + (numericArray[1] / 60);
  } else {
    // Format: [degrees] or unknown
    return numericArray[0];
  }
}

// Convert coordinate string to decimal
function convertCoordinates(coordStr: string): number {
  if (!coordStr) return 0;
  
  // If already a number string, parse it
  if (!isNaN(parseFloat(coordStr))) {
    return parseFloat(coordStr);
  }
  
  // Pattern 1: "XX° XX' XX.XX""
  const degMinSecRegex1 = /(\d+(?:\.\d+)?)°\s*(\d+(?:\.\d+)?)['′]\s*(\d+(?:\.\d+)?)["″]/;
  const match1 = coordStr.match(degMinSecRegex1);
  if (match1) {
    const degrees = parseFloat(match1[1]);
    const minutes = parseFloat(match1[2]);
    const seconds = parseFloat(match1[3]);
    
    return degrees + (minutes / 60) + (seconds / 3600);
  }
  
  // Pattern 2: "XX deg XX' XX.XX""
  const degMinSecRegex2 = /(\d+(?:\.\d+)?)\s*deg\s*(\d+(?:\.\d+)?)['′]\s*(\d+(?:\.\d+)?)["″]/;
  const match2 = coordStr.match(degMinSecRegex2);
  if (match2) {
    const degrees = parseFloat(match2[1]);
    const minutes = parseFloat(match2[2]);
    const seconds = parseFloat(match2[3]);
    
    return degrees + (minutes / 60) + (seconds / 3600);
  }
  
  // Pattern 3: "XX,XX,XX" or "XX XX XX" (common in some mobile formats)
  const parts = coordStr.split(/[^\d\.\-]+/).filter(part => part !== '');
  if (parts.length >= 1) {
    let decimal = parseFloat(parts[0] || '0');
    if (parts.length >= 2) decimal += parseFloat(parts[1] || '0') / 60;
    if (parts.length >= 3) decimal += parseFloat(parts[2] || '0') / 3600;
    
    return decimal;
  }
  
  return 0;
}

// Extract exposure time with support for multiple formats
function extractExposureTime(tags: any): string | undefined {
  const exposureValue = findValue(tags, [
    'ExposureTime', 'ShutterSpeedValue', 'Exposure', 'ShutterSpeed',
    'ExpTime', 'Shutter', 'ExposureValue'
  ]);
  
  if (!exposureValue) return undefined;
  
  // If already a fraction, return as is
  if (typeof exposureValue === 'string' && exposureValue.includes('/')) {
    return exposureValue;
  }
  
  // Convert to fraction if decimal
  const value = parseFloat(exposureValue);
  if (!isNaN(value) && value > 0 && value < 1) {
    return `1/${Math.round(1 / value)}`;
  }
  
  return exposureValue;
}

// Extract F-number with improvements
function extractFNumber(tags: any): number | undefined {
  const fNumberStr = findValue(tags, [
    'FNumber', 'ApertureValue', 'Aperture', 'F-Stop', 
    'Fnumber', 'Aperture Value', 'FNumber Value', 'F-number'
  ]);
  
  if (!fNumberStr) return undefined;
  
  // Pattern: f/X.X or just the number
  const match = String(fNumberStr).match(/f\/(\d+\.?\d*)|(\d+\.?\d*)/);
  if (match) {
    return parseFloat(match[1] || match[2]);
  }
  
  // Try to parse directly
  const value = parseFloat(String(fNumberStr));
  if (!isNaN(value)) return value;
  
  return undefined;
}

// Extract ISO with improvements
function extractISO(tags: any): number | undefined {
  const isoStr = findValue(tags, [
    'ISOSpeedRatings', 'ISO', 'ISOSpeed', 'BaseISO',
    'ISO Value', 'ISOValue', 'ISO Speed', 'SensitivityType'
  ]);

  if (!isoStr) return undefined;

  // Extract only digits if there's additional text
  const match = String(isoStr).match(/(\d+)/);
  if (match) {
    return parseInt(match[1]);
  }

  // Try to parse directly
  const value = parseInt(String(isoStr));
  if (!isNaN(value)) return value;

  return undefined;
}

// Extract focal length with improvements
function extractFocalLength(tags: any): number | undefined {
  const focalLengthStr = findValue(tags, [
    'FocalLength', 'Focal', 'FocalLengthIn35mmFilm',
    'FocalLength35mm', 'Focal Length', 'Focal Length In 35mm Format'
  ]);
  
  if (!focalLengthStr) return undefined;
  
  // Pattern: XX mm or just the number
  const match = String(focalLengthStr).match(/(\d+\.?\d*)\s*mm|(\d+\.?\d*)/);
  if (match) {
    return parseFloat(match[1] || match[2]);
  }
  
  // Try to parse directly
  const value = parseFloat(String(focalLengthStr));
  if (!isNaN(value)) return value;
  
  return undefined;
}

// Extract image orientation
function extractOrientation(tags: any): number | undefined {
  const orientationStr = findValue(tags, ['Orientation', 'ImageOrientation', 'Image Orientation']);
  
  if (!orientationStr) return undefined;
  
  // Extract only digits if there's additional text
  const match = String(orientationStr).match(/(\d+)/);
  if (match) {
    return parseInt(match[1]);
  }
  
  // Try to parse directly
  const value = parseInt(String(orientationStr));
  if (!isNaN(value)) return value;
  
  return undefined;
}

// Extract image resolution
function extractResolution(tags: any): string | undefined {
  const xRes = findValue(tags, ['XResolution', 'ImageWidth', 'ExifImageWidth', 'Width']);
  const yRes = findValue(tags, ['YResolution', 'ImageHeight', 'ExifImageHeight', 'Height']);
  
  if (xRes && yRes) {
    // Extract only digits if there's additional text
    const xMatch = String(xRes).match(/(\d+)/);
    const yMatch = String(yRes).match(/(\d+)/);
    
    if (xMatch && yMatch) {
      return `${xMatch[1]} x ${yMatch[1]}`;
    }
    
    // Try to parse directly
    const x = parseInt(String(xRes));
    const y = parseInt(String(yRes));
    
    if (!isNaN(x) && !isNaN(y)) {
      return `${x} x ${y}`;
    }
  }
  
  return undefined;
}
