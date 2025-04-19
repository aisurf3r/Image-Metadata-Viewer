import ExifReader from 'exifreader';
import { ImageMetadata } from '../types';

export const extractImageMetadata = async (file: File): Promise<ImageMetadata> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        if (!e.target?.result) {
          throw new Error('No se pudo leer el archivo');
        }
        
        // Opciones extendidas para ExifReader - crucial para cámaras modernas
        const options = {
          expanded: true,
          includeUnknown: true,
          reviveValues: true, // Importante: intenta recuperar valores en formatos no estándar
          translateKeys: true, // Traduce claves propietarias a estándar cuando sea posible
          translateValues: true, // Intenta traducir valores a formatos estándar
        };
        
        console.log("Procesando archivo:", file.name, "Tipo:", file.type, "Tamaño:", file.size);
        
        // Cargar metadatos con opciones extendidas
        const tags = await ExifReader.load(e.target.result, options);
        
        // Depuración detallada - ayuda a identificar dónde están los datos
        console.log("Tags encontrados:", Object.keys(tags));
        
        // Verificar si hay tags XMP, que a veces contienen información en cámaras modernas
        if (tags.xmp) {
          console.log("XMP tags encontrados:", Object.keys(tags.xmp));
        }
        
        // Buscar información GPS en múltiples ubicaciones posibles
        const gpsData = findGpsData(tags);
        console.log("Datos GPS encontrados:", gpsData);
        
        // Extraer make y model con un enfoque más amplio
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
        
        // Lógica para evitar la duplicación de marca en el modelo
        const cleanModel = model && make ? 
          (model.toLowerCase().includes(make.toLowerCase()) ? 
            model : 
            `${make} ${model}`) :
          model;
        
        // Extraer metadatos con un enfoque más agresivo
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
          // Nuevos campos adicionales
          software: findValue(tags, ['Software', 'ProcessingSoftware', 'Creator']),
          orientation: extractOrientation(tags),
          resolution: extractResolution(tags),
          whiteBalance: findValue(tags, ['WhiteBalance', 'WB']),
          flash: findValue(tags, ['Flash', 'FlashMode', 'FlashFired']),
          lens: findValue(tags, ['LensModel', 'Lens', 'LensInfo', 'LensMake']),
          gps: gpsData
        };
        
        console.log("Metadatos extraídos:", metadata);
        resolve(metadata);
        
      } catch (error) {
        console.error('Error al extraer metadatos EXIF:', error);
        resolve({
          fileName: file.name
        });
      }
    };
    
    reader.onerror = () => {
      console.error('Error al leer el archivo');
      resolve({
        fileName: file.name
      });
    };
    
    // Usar readAsArrayBuffer para mejor compatibilidad
    reader.readAsArrayBuffer(file);
  });
};

// Función que busca en profundidad un valor en el objeto de tags
function findValue(tags: any, possibleKeys: string[]): string | undefined {
  // Primero buscar en la raíz
  for (const key of possibleKeys) {
    if (tags[key] && tags[key].description) {
      return tags[key].description;
    }
    
    // Buscar en formato de valor directo
    if (tags[key] && typeof tags[key].value !== 'undefined') {
      return String(tags[key].value);
    }
  }
  
  // Buscar en subobjetos (como xmp, exif, etc.)
  const subObjects = ['xmp', 'exif', 'gps', 'GPS', 'ifd0', 'ifd1', 'apple', 'samsung', 'canon', 'nikon', 'olympus', 'panasonic', 'sony', 'fujifilm'];
  for (const subObj of subObjects) {
    if (!tags[subObj]) continue;
    
    for (const key of possibleKeys) {
      if (tags[subObj][key] && tags[subObj][key].description) {
        return tags[subObj][key].description;
      }
      
      // Buscar en formato de valor directo
      if (tags[subObj][key] && typeof tags[subObj][key].value !== 'undefined') {
        return String(tags[subObj][key].value);
      }
    }
  }
  
  // Buscar en tags específicos para dispositivos móviles (Android, iPhone, etc.)
  const deviceSpecificPaths = [
    'MakerNote.Apple', 'MakerNote.Samsung', 'MakerNote.Huawei', 'MakerNote.Sony',
    'MakerNotes.Apple', 'MakerNotes.Samsung', 'MakerNotes.Huawei', 'MakerNotes.Sony',
    'apple.tags', 'samsung.tags', 'huawei.tags', 'sony.tags',
    'iphoneinfo', 'androidinfo', 'pixelinfo'
  ];
  
  for (const path of deviceSpecificPaths) {
    const parts = path.split('.');
    let current = tags;
    let valid = true;
    
    // Recorrer la ruta
    for (const part of parts) {
      if (!current[part]) {
        valid = false;
        break;
      }
      current = current[part];
    }
    
    // Si la ruta es válida, buscar en este objeto
    if (valid) {
      for (const key of possibleKeys) {
        if (current[key]) {
          if (current[key].description) return current[key].description;
          if (typeof current[key].value !== 'undefined') return String(current[key].value);
          if (typeof current[key] === 'string') return current[key];
        }
      }
    }
  }
  
  // Buscar en Android/iPhone-specific tags
  const deviceSpecificKeys = [
    'SonyModelID', 'AndroidVersion', 'AndroidManufacturer',
    'AppleModel', 'AppleMake', 'AppleDevice',
    'SamsungModel', 'SamsungDevice',
    'HuaweiModel', 'HuaweiDevice',
    'GoogleModel', 'GoogleDevice',
    'iPhone', 'iPad', 'iOS'
  ];
  
  for (const key of deviceSpecificKeys) {
    if (tags[key] && tags[key].description) {
      if (possibleKeys.includes('Make') || possibleKeys.includes('Model')) {
        return tags[key].description;
      }
    }
  }
  
  return undefined;
}

// Función específica para encontrar datos GPS en cámaras modernas
function findGpsData(tags: any): { latitude: number, longitude: number } | undefined {
  // Lugares comunes donde podrían estar los datos GPS
  const possibleGpsObjects = [
    tags.GPS,
    tags.gps,
    tags.GPSInfo,
    tags['GPS Info'],
    tags.xmp?.GPS
  ].filter(Boolean);
  
  // También buscar por pares de coordenadas directamente en la raíz
  if (tags.GPSLatitude && tags.GPSLongitude) {
    possibleGpsObjects.push(tags);
  }
  
  // Android moderno a veces usa estos nombres
  if (tags.GPSLatitudeRef || tags.GpsLatitudeRef) {
    possibleGpsObjects.push(tags);
  }
  
  // Para dispositivos móviles específicamente
  const mobilePaths = [
    'MakerNote.Apple.GPS', 'MakerNote.Samsung.GPS', 'MakerNote.Huawei.GPS', 
    'MakerNote.Sony.GPS', 'MakerNote.Google.GPS', 'MakerNote.Xiaomi.GPS'
  ];
  
  for (const path of mobilePaths) {
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
    
    if (valid) possibleGpsObjects.push(current);
  }
  
  // Buscar en los posibles objetos
  for (const gpsObj of possibleGpsObjects) {
    console.log("Analizando objeto GPS:", gpsObj);
    
    // Extraer latitud
    const latValue = getGpsCoordinate(gpsObj, [
      'GPSLatitude', 'Latitude', 'GpsLatitude', 'Lat', 'LatitudeValue', 'lat'
    ]);
    
    // Extraer longitud
    const lonValue = getGpsCoordinate(gpsObj, [
      'GPSLongitude', 'Longitude', 'GpsLongitude', 'Lon', 'LongitudeValue', 'lng', 'lon'
    ]);
    
    // Extraer referencias (N/S/E/W)
    const latRef = getGpsRef(gpsObj, [
      'GPSLatitudeRef', 'LatitudeRef', 'GpsLatitudeRef', 'LatRef', 'latRef'
    ]) || 'N';
    
    const lonRef = getGpsRef(gpsObj, [
      'GPSLongitudeRef', 'LongitudeRef', 'GpsLongitudeRef', 'LonRef', 'lngRef', 'lonRef'
    ]) || 'E';
    
    console.log("Valores GPS brutos:", { latValue, lonValue, latRef, lonRef });
    
    // Si encontramos valores, convertirlos
    if (latValue !== undefined && lonValue !== undefined) {
      // Usar los valores crudos si ya son números
      if (typeof latValue === 'number' && typeof lonValue === 'number') {
        const lat = latRef === 'S' ? -latValue : latValue;
        const lon = lonRef === 'W' ? -lonValue : lonValue;
        return { latitude: lat, longitude: lon };
      }
      
      // Si son strings, convertirlos
      if (typeof latValue === 'string' && typeof lonValue === 'string') {
        try {
          let lat = convertCoordinates(latValue, latRef);
          let lon = convertCoordinates(lonValue, lonRef);
          
          // Verificar si son valores válidos y no cero
          if (lat !== 0 || lon !== 0) {
            return { latitude: lat, longitude: lon };
          }
        } catch (e) {
          console.warn("Error al convertir coordenadas:", e);
        }
      }
      
      // Si son arrays, procesarlos directamente
      if (Array.isArray(latValue) && Array.isArray(lonValue)) {
        try {
          const lat = processCoordinateArray(latValue, latRef);
          const lon = processCoordinateArray(lonValue, lonRef);
          return { latitude: lat, longitude: lon };
        } catch (e) {
          console.warn("Error al procesar arrays de coordenadas:", e);
        }
      }
    }
  }
  
  // Buscar en formato LocationIQ (comúnmente usado en smartphones modernos)
  if (tags.Location || tags.location || tags.LocationIQ) {
    const locationObj = tags.Location || tags.location || tags.LocationIQ;
    
    if (locationObj.coordinates) {
      const coords = locationObj.coordinates.value || locationObj.coordinates;
      if (Array.isArray(coords) && coords.length >= 2) {
        // Formato común: [longitud, latitud]
        return { latitude: coords[1], longitude: coords[0] };
      }
    }
  }
  
  // Si llegamos aquí, no encontramos datos GPS válidos
  console.warn("No se encontraron datos GPS válidos");
  return undefined;
}

// Obtener coordenada GPS de varias posibles fuentes
function getGpsCoordinate(obj: any, possibleKeys: string[]): string | number | any[] | undefined {
  if (!obj) return undefined;
  
  for (const key of possibleKeys) {
    // Comprobar si existe la clave
    if (obj[key]) {
      // Caso 1: Hay una descripción
      if (obj[key].description) {
        return obj[key].description;
      }
      // Caso 2: Hay un valor directo
      if (obj[key].value !== undefined) {
        return obj[key].value;
      }
      // Caso 3: Es un array o valor directo
      if (Array.isArray(obj[key]) || typeof obj[key] === 'number' || typeof obj[key] === 'string') {
        return obj[key];
      }
    }
  }
  
  return undefined;
}

// Obtener referencia GPS (N/S/E/W)
function getGpsRef(obj: any, possibleKeys: string[]): string | undefined {
  if (!obj) return undefined;
  
  for (const key of possibleKeys) {
    if (obj[key]) {
      // Caso 1: Hay una descripción
      if (obj[key].description) {
        return obj[key].description;
      }
      // Caso 2: Hay un valor directo
      if (typeof obj[key] === 'string') {
        return obj[key];
      }
      // Caso 3: Es un valor dentro de un objeto
      if (obj[key].value !== undefined) {
        return obj[key].value;
      }
    }
  }
  
  return undefined;
}

// Convertir array de coordenadas [grados, minutos, segundos] a decimal
function processCoordinateArray(coordArray: any[], ref?: string): number {
  if (!coordArray || coordArray.length < 1) return 0;
  
  let decimal = 0;
  
  // Formato común: [grados, minutos, segundos]
  if (coordArray.length >= 3) {
    const degrees = Number(coordArray[0]);
    const minutes = Number(coordArray[1]);
    const seconds = Number(coordArray[2]);
    
    decimal = degrees + (minutes / 60) + (seconds / 3600);
  }
  // Formato alternativo: solo grados
  else if (coordArray.length === 1) {
    decimal = Number(coordArray[0]);
  }
  // Formato alternativo: grados y minutos
  else if (coordArray.length === 2) {
    const degrees = Number(coordArray[0]);
    const minutes = Number(coordArray[1]);
    
    decimal = degrees + (minutes / 60);
  }
  
  // Ajustar según referencia
  if (ref === 'S' || ref === 'W') {
    decimal = -decimal;
  }
  
  return decimal;
}

// Función mejorada para convertir coordenadas de string
function convertCoordinates(coordStr: string, ref?: string): number {
  if (!coordStr) return 0;
  
  // Si ya es un número, simplemente ajustar por referencia
  if (!isNaN(parseFloat(coordStr))) {
    let decimal = parseFloat(coordStr);
    if (ref === 'S' || ref === 'W') decimal = -decimal;
    return decimal;
  }
  
  // Formato específico para Android/Sony "XX° XX' XX.XX""
  const degMinSecRegex1 = /(\d+)°\s*(\d+)'\s*(\d+\.?\d*)"/;
  const match1 = coordStr.match(degMinSecRegex1);
  if (match1) {
    const degrees = parseFloat(match1[1]);
    const minutes = parseFloat(match1[2]);
    const seconds = parseFloat(match1[3]);
    
    let decimal = degrees + (minutes / 60) + (seconds / 3600);
    if (ref === 'S' || ref === 'W') decimal = -decimal;
    return decimal;
  }
  
  // Otros formatos posibles
  const degMinSecRegex2 = /(\d+)\s*deg\s*(\d+)'\s*(\d+\.?\d*)"/;
  const match2 = coordStr.match(degMinSecRegex2);
  if (match2) {
    const degrees = parseFloat(match2[1]);
    const minutes = parseFloat(match2[2]);
    const seconds = parseFloat(match2[3]);
    
    let decimal = degrees + (minutes / 60) + (seconds / 3600);
    if (ref === 'S' || ref === 'W') decimal = -decimal;
    return decimal;
  }
  
  // Formato de solo números separados
  const parts = coordStr.split(/[^\d\.\-]+/).filter(part => part !== '');
  if (parts.length >= 1) {
    let decimal = parseFloat(parts[0] || '0');
    if (parts.length >= 2) decimal += parseFloat(parts[1] || '0') / 60;
    if (parts.length >= 3) decimal += parseFloat(parts[2] || '0') / 3600;
    
    if (ref === 'S' || ref === 'W') decimal = -decimal;
    return decimal;
  }
  
  return 0;
}

// Extraer tiempo de exposición con soporte para múltiples formatos
function extractExposureTime(tags: any): string | undefined {
  // Buscar en múltiples ubicaciones posibles
  const exposureValue = findValue(tags, [
    'ExposureTime', 'ShutterSpeedValue', 'Exposure', 'ShutterSpeed',
    'ExpTime', 'Shutter', 'ExposureValue'
  ]);
  
  if (!exposureValue) return undefined;
  
  // Si ya es una fracción, devolverlo como está
  if (exposureValue.includes('/')) return exposureValue;
  
  // Convertir a fracción si es decimal
  const value = parseFloat(exposureValue);
  if (!isNaN(value) && value > 0 && value < 1) {
    return `1/${Math.round(1 / value)}`;
  }
  
  return exposureValue;
}

// Extraer número F con mejoras
function extractFNumber(tags: any): number | undefined {
  const fNumberStr = findValue(tags, [
    'FNumber', 'ApertureValue', 'Aperture', 'F-Stop', 
    'Fnumber', 'Aperture Value', 'FNumber Value', 'F-number'
  ]);
  
  if (!fNumberStr) return undefined;
  
  // Buscar patrón f/X.X o solo el número
  const match = fNumberStr.match(/f\/(\d+\.?\d*)|(\d+\.?\d*)/);
  if (match) {
    return parseFloat(match[1] || match[2]);
  }
  
  // Si no hay patrón, intentar parsear directamente
  const value = parseFloat(fNumberStr);
  if (!isNaN(value)) return value;
  
  return undefined;
}

// Extraer ISO con mejoras
function extractISO(tags: any): number | undefined {
  const isoStr = findValue(tags, [
    'ISOSpeedRatings', 'ISO', 'ISOSpeed', 'BaseISO',
    'ISO Value', 'ISOValue', 'ISO Speed', 'SensitivityType'
  ]);

  if (!isoStr) return undefined;

  if (typeof isoStr === 'string') {
    // Extraer solo dígitos si hay texto adicional
    const match = isoStr.match(/(\d+)/);
    if (match) {
      return parseInt(match[1]);
    }
  
    // Si no hay patrón, intentar parsear directamente
    const value = parseInt(isoStr);
    if (!isNaN(value)) return value;
  
    return undefined;
  } else if (typeof isoStr === 'number') {
    return isoStr;
  } else {
    return undefined;
  }
}

// Extraer distancia focal con mejoras
function extractFocalLength(tags: any): number | undefined {
  const focalLengthStr = findValue(tags, [
    'FocalLength', 'Focal', 'FocalLengthIn35mmFilm',
    'FocalLength35mm', 'Focal Length', 'Focal Length In 35mm Format'
  ]);
  
  if (!focalLengthStr) return undefined;
  
  // Buscar patrón XX mm o solo el número
  const match = focalLengthStr.match(/(\d+\.?\d*)\s*mm|(\d+\.?\d*)/);
  if (match) {
    return parseFloat(match[1] || match[2]);
  }
  
  // Si no hay patrón, intentar parsear directamente
  const value = parseFloat(focalLengthStr);
  if (!isNaN(value)) return value;
  
  return undefined;
}

// Nuevas funciones para campos adicionales

// Extraer orientación de la imagen
function extractOrientation(tags: any): number | undefined {
  const orientationStr = findValue(tags, ['Orientation', 'ImageOrientation', 'Image Orientation']);
  
  if (!orientationStr) return undefined;
  
  // Extraer solo dígitos si hay texto adicional
  const match = orientationStr.match(/(\d+)/);
  if (match) {
    return parseInt(match[1]);
  }
  
  // Si no hay patrón, intentar parsear directamente
  const value = parseInt(orientationStr);
  if (!isNaN(value)) return value;
  
  return undefined;
}

// Extraer resolución de la imagen
function extractResolution(tags: any): string | undefined {
  const xRes = findValue(tags, ['XResolution', 'ImageWidth', 'ExifImageWidth', 'Width']);
  const yRes = findValue(tags, ['YResolution', 'ImageHeight', 'ExifImageHeight', 'Height']);
  
  if (xRes && yRes) {
    // Extraer solo dígitos si hay texto adicional
    const xMatch = xRes.match(/(\d+)/);
    const yMatch = yRes.match(/(\d+)/);
    
    if (xMatch && yMatch) {
      return `${xMatch[1]} x ${yMatch[1]}`;
    }
    
    // Si no hay patrón, intentar parsear directamente
    const x = parseInt(xRes);
    const y = parseInt(yRes);
    
    if (!isNaN(x) && !isNaN(y)) {
      return `${x} x ${y}`;
    }
  }
  
  return undefined;
}