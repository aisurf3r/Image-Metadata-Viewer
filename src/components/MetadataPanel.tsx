import React from "react";
import { Download, Camera, Calendar, MapPin, Sliders } from "lucide-react";
import { motion } from "framer-motion";
import { UploadedImage } from "../types";

interface Props {
  image?: UploadedImage;
}

export const MetadataPanel: React.FC<Props> = ({ image }) => {
  if (!image) return null;

  const downloadMetadata = () => {
    const blob = new Blob([JSON.stringify(image.metadata, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${image.metadata.fileName}-metadata.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="rounded-lg shadow-lg border border-blue-100 backdrop-blur-sm bg-[#00000000] p-[1.5em] m-px pt-0 pb-[15px] w-auto h-auto mt-[16px]"
    >
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-blue-900">Image Metadata</h2>
        <button
          onClick={downloadMetadata}
          className="bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 transition-colors"
          title="Download Metadata"
        >
          <Download className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-6">
        <div className="bg-blue-50/80 backdrop-blur-sm p-4 rounded-lg">
          <div className="flex items-center mb-2">
            <Calendar className="w-5 h-5 text-blue-600 mr-2" />

            <h3 className="font-medium text-blue-900">File Information</h3>
          </div>
          <p className="text-blue-800">{image.metadata.fileName}</p>
          <p className="text-blue-700">{image.metadata.dateTime}</p>
        </div>

        <div className="bg-indigo-50/80 backdrop-blur-sm p-4 rounded-lg">
          <div className="flex items-center mb-2">
            <Camera className="w-5 h-5 text-indigo-600 mr-2" />

            <h3 className="font-medium text-indigo-900">Camera Information</h3>
          </div>
          <p className="text-indigo-800">
            {image.metadata.make || "Unknown make"}
          </p>
          <p className="text-indigo-700">
            {image.metadata.model || "Unknown model"}
          </p>
        </div>

        <div className="bg-purple-50/80 backdrop-blur-sm p-4 rounded-lg">
          <div className="flex items-center mb-2">
            <Sliders className="w-5 h-5 text-purple-600 mr-2" />

            <h3 className="font-medium text-purple-900">Settings</h3>
          </div>
          <p className="text-purple-800">
            Exposure: {image.metadata.exposure || "N/A"}
          </p>
          <p className="text-purple-800">
            F-Number: {image.metadata.fNumber || "N/A"}
          </p>
          <p className="text-purple-800">ISO: {image.metadata.iso || "N/A"}</p>
          <p className="text-purple-800">
            Focal Length:{" "}
            {image.metadata.focalLength
              ? `${image.metadata.focalLength}mm`
              : "N/A"}
          </p>
        </div>

        {image.metadata.gps && (
          <div className="bg-green-50/80 backdrop-blur-sm p-4 rounded-lg">
            <div className="flex items-center mb-2">
              <MapPin className="w-5 h-5 text-green-600 mr-2" />

              <h3 className="font-medium text-green-900">Location</h3>
            </div>
            <p className="text-green-800">
              Latitude: {image.metadata.gps.latitude.toFixed(6)}
            </p>
            <p className="text-green-800">
              Longitude: {image.metadata.gps.longitude.toFixed(6)}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
};
