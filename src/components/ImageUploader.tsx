import React, { useCallback, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

interface Props {
  onImagesUploaded: (images: File[]) => void;
}

export const ImageUploader: React.FC<Props> = ({ onImagesUploaded }) => {
  const [isUploading, setIsUploading] = useState(false);

  const handleFiles = useCallback(
    async (files: File[]) => {
      const imageFiles = Array.from(files).filter((file) =>
        file.type.startsWith("image/"),
      );

      if (imageFiles.length > 0) {
        setIsUploading(true);
        try {
          await onImagesUploaded(imageFiles);
        } finally {
          setIsUploading(false);
        }
      }
    },
    [onImagesUploaded],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      handleFiles(Array.from(e.dataTransfer.files));
    },
    [handleFiles],
  );

  const onFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        handleFiles(Array.from(e.target.files));
      }
    },
    [handleFiles],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full p-8"
    >
      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        className={`border-4 border-dashed rounded-xl p-8 text-center transition-all ${
          isUploading
            ? "border-blue-400 bg-blue-50"
            : "border-blue-200 hover:border-blue-400 hover:bg-blue-50"
        }`}
      >
        {isUploading ? (
          <div className="flex flex-col items-center">
            <Loader2 className="w-16 h-16 text-blue-500 animate-spin" />

            <h2 className="text-xl font-semibold mt-4 text-blue-700">
              Processing images...
            </h2>
            <p className="text-blue-600 mt-2">
              Please wait while we extract the metadata
            </p>
          </div>
        ) : (
          <>
            <motion.div
              whileHover={{ scale: 1.1 }}
              animate={{
                y: [0, -10, 0],
                transition: {
                  repeat: Infinity,
                  duration: 2,
                  ease: "easeInOut",
                },
              }}
            >
              <Upload className="w-16 h-16 mx-auto mb-4 text-blue-500" />
            </motion.div>

            <h2 className="text-xl font-semibold mb-2 text-blue-700">
              Drop images here
            </h2>
            <p className="text-blue-600 mb-4">or</p>
            <label className="bg-blue-500 text-white px-6 py-2 rounded-lg cursor-pointer hover:bg-blue-600 transition-colors inline-block">
              Browse Files
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={onFileSelect}
                className="hidden"
              />
            </label>
          </>
        )}
      </div>
    </motion.div>
  );
};
