import React, { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { UploadedImage } from "../types";
import "leaflet/dist/leaflet.css";
import { Icon } from "leaflet";

// Estilos adicionales inline para arreglos móviles
const mapStyles = `
  .leaflet-container {
    touch-action: pan-x pan-y;
  }
  .leaflet-touch .leaflet-bar {
    border: none;
    box-shadow: 0 1px 5px rgba(0,0,0,0.4);
  }
`;

// Fix default marker icon issue
const defaultIcon = new Icon({
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Componente para inyectar estilos CSS
function MapStyles() {
  useEffect(() => {
    // Añadir estilos solo si no existen ya
    if (!document.getElementById('leaflet-mobile-fixes')) {
      const styleElement = document.createElement('style');
      styleElement.id = 'leaflet-mobile-fixes';
      styleElement.innerHTML = mapStyles;
      document.head.appendChild(styleElement);
      
      return () => {
        // Cleanup al desmontar
        const styleEl = document.getElementById('leaflet-mobile-fixes');
        if (styleEl) document.head.removeChild(styleEl);
      };
    }
  }, []);
  
  return null;
}

// Map resizer component mejorado para móviles
function MapResizer() {
  const map = useMap();

  useEffect(() => {
    const handleResize = () => {
      // Aumenta el tiempo de espera para dispositivos móviles
      setTimeout(() => {
        map.invalidateSize({ animate: true });
      }, 400); // Aumentado de 200 a 400ms
    };

    // Ejecutar inmediatamente al montar
    handleResize();
    
    // También refrescar el mapa cuando se completa la carga
    window.addEventListener('load', handleResize);
    window.addEventListener("resize", handleResize);
    
    // Touch events específicos para móviles
    window.addEventListener("orientationchange", handleResize);
    
    // Forzar refresco adicional para dispositivos móviles
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    if (isMobile) {
      setTimeout(handleResize, 1000); // Refresco adicional después de 1s para móviles
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener('load', handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, [map]);

  return null;
}

// Componente para actualizar el centro del mapa
function SetViewOnChange({ center }: { center: { latitude: number; longitude: number } }) {
  const map = useMap();

  useEffect(() => {
    if (center) {
      map.setView([center.latitude, center.longitude], 13);
    }
  }, [center, map]);

  return null;
}

// Componente para manejar eventos móviles específicos
function MobileFixes() {
  useEffect(() => {
    // Detectar si es dispositivo móvil
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    
    if (isMobile) {
      // Función para forzar un refresco del mapa
      const forceRefresh = () => {
        setTimeout(() => {
          window.dispatchEvent(new Event('resize'));
        }, 800);
      };
      
      // Aplicar después de la carga completa de la página
      window.addEventListener('load', forceRefresh);
      
      return () => {
        window.removeEventListener('load', forceRefresh);
      };
    }
  }, []);
  
  return null;
}

interface Props {
  images: UploadedImage[];
  selectedImage?: UploadedImage;
  onMarkerClick: (image: UploadedImage) => void;
}

export const Map: React.FC<Props> = ({
  images,
  selectedImage,
  onMarkerClick,
}) => {
  const gpsImages = images.filter((img) => img.metadata.gps);

  if (gpsImages.length === 0) return null;

  const center = selectedImage?.metadata.gps || {
    latitude: gpsImages[0].metadata.gps!.latitude,
    longitude: gpsImages[0].metadata.gps!.longitude,
  };

  return (
    <div className="w-full h-[400px] rounded-lg overflow-hidden relative z-[500]">
      <MapStyles />
      <MapContainer
        center={[center.latitude, center.longitude]}
        zoom={13}
        style={{ width: "100%", height: "100%" }}
        trackResize={true}
        zoomControl={false}
        tap={true} // Habilita explícitamente los eventos táctiles
        dragging={true} // Asegura que el arrastre está habilitado
        doubleClickZoom={true} // Habilita el zoom con doble clic/toque
        touchZoom={true} // Habilita zoom con gestos táctiles
        scrollWheelZoom={true} // Habilita zoom con rueda de ratón/gestos
      >
        <MapResizer />
        <MobileFixes />
        <SetViewOnChange center={center} />
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          crossOrigin="anonymous"
        />

        {gpsImages.map((image) => (
          <Marker
            key={image.id}
            position={[
              image.metadata.gps!.latitude,
              image.metadata.gps!.longitude,
            ]}
            icon={defaultIcon}
            eventHandlers={{
              click: () => onMarkerClick(image),
            }}
          >
            <Popup>
              <img
                src={image.preview}
                alt={image.metadata.fileName}
                className="w-32 h-32 object-cover"
                crossOrigin="anonymous"
                loading="lazy"
              />
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};
