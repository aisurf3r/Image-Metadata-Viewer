import React from "react";
import { MapPin, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadedImage } from "../types";

interface Props {
  images: UploadedImage[];
  onSelect: (image: UploadedImage) => void;
  selectedImage?: UploadedImage;
  onDelete?: (image: UploadedImage) => void;
}

export const ImageGallery: React.FC<Props> = ({
  images,
  onSelect,
  selectedImage,
  onDelete,
}) => {
  const handleDelete = (e: React.MouseEvent, image: UploadedImage) => {
    e.stopPropagation();
    if (onDelete) {
      const nextImage = images.find((img) => img.id !== image.id);
      if (nextImage) {
        onSelect(nextImage);
      }
      onDelete(image);
    }
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4 rounded-lg shadow-lg border border-blue-100 backdrop-blur-sm bg-[#00000000] pt-[19px] pb-[21px]">
      <AnimatePresence>
        {images.map((image, index) => (
          <motion.div
            key={image.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ delay: index * 0.1 }}
            className={`relative group cursor-pointer rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow aspect-square ${
              selectedImage?.id === image.id ? "ring-4 ring-blue-500" : ""
            }`}
            onClick={() => onSelect(image)}
          >
            <div className="w-full h-full">
              <img
                src={image.preview}
                alt={image.metadata.fileName}
                className="w-full h-full object-cover"
              />
            </div>

            {image.metadata.gps && (
              <div className="absolute top-2 right-2 bg-blue-500 p-1 rounded-full">
                <MapPin className="w-4 h-4 text-white" />
              </div>
            )}
            {onDelete && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 opacity-0 group-hover:opacity-100 transition-opacity">
                <motion.button
                  whileHover={{ scale: 1.2 }}
                  className="p-2 bg-red-500 rounded-full shadow-lg"
                  onClick={(e) => handleDelete(e, image)}
                >
                  <Trash2 className="w-5 h-5 text-white" />
                </motion.button>
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
