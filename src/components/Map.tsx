import React, { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { UploadedImage } from "../types";
import "leaflet/dist/leaflet.css";
import { Icon } from "leaflet";

// Fix default marker icon issue
const defaultIcon = new Icon({
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Map resizer component mejorado
function MapResizer() {
  const map = useMap();

  useEffect(() => {
    const handleResize = () => {
      setTimeout(() => {
        map.invalidateSize({ animate: true });
      }, 200);
    };

    // Ejecutar inmediatamente al montar
    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
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
    <div className="w-full h-[400px] rounded-lg overflow-hidden relative z-[400]">
      <MapContainer
        center={[center.latitude, center.longitude]}
        zoom={13}
        style={{ width: "100%", height: "100%" }}
        trackResize={true} // Nueva prop añadida
        zoomControl={false}
      >
        <MapResizer />
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
