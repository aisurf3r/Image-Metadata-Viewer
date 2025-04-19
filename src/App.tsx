import React, { useState, useCallback } from "react";
import { ImageUploader } from "./components/ImageUploader";
import { ImageGallery } from "./components/ImageGallery";
import { MetadataPanel } from "./components/MetadataPanel";
import { Map } from "./components/Map";
import { Camera, Trash2, Palette, Github } from "lucide-react";
import { motion } from "framer-motion";
import { UploadedImage } from "./types";
import { extractImageMetadata } from "./utils/exifUtils";

const themes = [
  {
    name: "Ocean",
    from: "from-blue-400",
    via: "via-green-200",
    to: "to-blue-300",
  },
  {
    name: "Sunset",
    from: "from-orange-400",
    via: "via-pink-200",
    to: "to-purple-300",
  },
  {
    name: "Forest",
    from: "from-green-400",
    via: "via-emerald-200",
    to: "to-teal-300",
  },
  {
    name: "Lavender",
    from: "from-purple-400",
    via: "via-pink-200",
    to: "to-indigo-300",
  },
];

function App() {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<UploadedImage>();
  const [currentTheme, setCurrentTheme] = useState(0);
  const [showThemes, setShowThemes] = useState(false);

  const handleImagesUploaded = useCallback(async (files: File[]) => {
    const newImages = await Promise.all(
      files.map(async (file) => {
        const metadata = await extractImageMetadata(file);
        return {
          id: Math.random().toString(36).substr(2, 9),
          file,
          metadata,
          preview: URL.createObjectURL(file),
        };
      }),
    );

    setImages((prev) => [...prev, ...newImages]);
    if (newImages.length > 0) {
      setSelectedImage(newImages[0]);
    }
  }, []);

  const handleDeleteImage = useCallback(
    (imageToDelete: UploadedImage) => {
      URL.revokeObjectURL(imageToDelete.preview);
      const remainingImages = images.filter(
        (img) => img.id !== imageToDelete.id,
      );
      setImages(remainingImages);

      if (selectedImage?.id === imageToDelete.id) {
        setSelectedImage(
          remainingImages.length > 0 ? remainingImages[0] : undefined,
        );
      }
    },
    [images, selectedImage],
  );

  const handleClear = useCallback(() => {
    images.forEach((image) => URL.revokeObjectURL(image.preview));
    setImages([]);
    setSelectedImage(undefined);
  }, [images]);

  const handleThemeChange = (index: number) => {
    setCurrentTheme(index);
    setShowThemes(false);
  };

  return (
    <div
      className={`min-h-screen bg-gradient-to-br ${themes[currentTheme].from} ${themes[currentTheme].via} ${themes[currentTheme].to} flex flex-col`}
      data-oid="w66jeh3"
    >
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="shadow-lg bg-[#00000000] border-[#00000000] border-0"
        data-oid="s70.1oc"
      >
        <div
          className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between"
          data-oid="0nin432"
        >
          <div className="flex items-center text-[#000000]" data-oid="nlxnywg">
            <Camera
              className="w-8 h-8 mr-3 bg-none text-[16px] text-[#676767]"
              data-oid="lpa3l7_"
            />

            <h1
              className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-start capitalize font-semibold text-[23px] text-[#737373]"
              data-oid="9jmy1xr"
            >
              Image Metadata Viewer
            </h1>
          </div>
          <div className="flex items-center gap-4" data-oid="o28mr9r">
            <div className="relative" data-oid="da1fnot">
              {showThemes && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute right-0 top-12 bg-white rounded-lg shadow-xl p-2 z-50 min-w-[150px]"
                  data-oid="--.5a7m"
                >
                  {themes.map((theme, index) => (
                    <button
                      key={theme.name}
                      className={`w-full text-left px-4 py-2 rounded hover:bg-gray-100 ${currentTheme === index ? "bg-gray-50 text-blue-600" : ""}`}
                      onClick={() => handleThemeChange(index)}
                      data-oid="ct0vool"
                    >
                      {theme.name}
                    </button>
                  ))}
                </motion.div>
              )}
              <motion.button
                whileHover={{ scale: 1.05 }}
                className="p-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md flex items-center gap-2"
                onClick={() => setShowThemes(!showThemes)}
                data-oid="8zi2fv4"
              >
                <Palette className="w-5 h-5" data-oid="6l9p4:m" />
                <span className="hidden sm:inline" data-oid="q0cdm4l">
                  Theme
                </span>
              </motion.button>
            </div>
            {images.length > 0}
          </div>
        </div>
      </motion.header>
      <main className="max-w-7xl mx-auto px-4 py-8" data-oid="oxnc.0y">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-6"
          data-oid="zxckspw"
        >
          <h2
            className="text-xl font-semibold text-gray-800"
            data-oid="bs4gtcp"
          >
            Analyze Your Images
          </h2>
          <p className="text-gray-600 mt-1" data-oid="kfmvdkz">
            Upload photos to extract and view embedded metadata
          </p>
        </motion.div>

        <ImageUploader
          onImagesUploaded={handleImagesUploaded}
          data-oid="e4hz6qg"
        />

        {images.length === 0 && (
          <div
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10"
            data-oid="ogywusp"
          >
            {[
              {
                title: "Step 1: Upload",
                description:
                  "Drag and drop your images or click to browse files",
                icon: "📁",
              },
              {
                title: "Step 2: View",
                description:
                  "Browse through your uploaded images in the gallery",
                icon: "🖼️",
              },
              {
                title: "Step 3: Analyze",
                description:
                  "Explore detailed metadata and location information",
                icon: "🔍",
              },
            ].map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                whileHover={{
                  scale: 1.03,
                  boxShadow:
                    "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
                }}
                className="bg-white bg-opacity-90 backdrop-blur-sm rounded-xl p-6 shadow-md transition-all duration-300"
                data-oid="8l4:rve"
              >
                <div className="text-4xl mb-3" data-oid="cxs::l3">
                  {step.icon}
                </div>
                <h3
                  className="text-lg font-semibold text-blue-700 mb-2"
                  data-oid="dehkxkf"
                >
                  {step.title}
                </h3>
                <p className="text-gray-600" data-oid="8hp0z60">
                  {step.description}
                </p>
              </motion.div>
            ))}
          </div>
        )}

        {images.length > 0 && (
          <div
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
            data-oid="dt.-ju8"
          >
            <div className="md:col-span-2 space-y-8" data-oid="rd:fe4r">
              {selectedImage?.metadata.gps && (
                <Map
                  images={images}
                  selectedImage={selectedImage}
                  onMarkerClick={setSelectedImage}
                  data-oid="l92iev6"
                />
              )}
              <div className="relative" data-oid="v23ehm9">
                <ImageGallery
                  images={images}
                  onSelect={setSelectedImage}
                  selectedImage={selectedImage}
                  onDelete={handleDeleteImage}
                  data-oid="74m-s9:"
                />

                {images.length > 0 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -bottom-0 right-0"
                    data-oid="kbb-y-u"
                  >
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      className="flex items-center px-2 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-lg"
                      onClick={handleClear}
                      data-oid="kikc8nw"
                    >
                      <Trash2 className="w-4 h-4 mr-2" data-oid="h.s30bj" />
                      Clear All
                    </motion.button>
                  </motion.div>
                )}
              </div>
            </div>
            <div data-oid="kpvqil3">
              <MetadataPanel image={selectedImage} data-oid="q:3_7s4" />
            </div>
          </div>
        )}
      </main>

      <motion.footer
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white bg-opacity-80 backdrop-blur-sm border-t border-blue-100 py-4 mt-auto sticky bottom-0"
        data-oid="af3vmlx"
      >
        <div
          className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center"
          data-oid="5ts481q"
        >
          <div className="flex items-center" data-oid="va6f.3g">
            <p className="text-sm text-gray-600 mr-2" data-oid="qaor92y">
              &copy; {new Date().getFullYear()} Image Metadata Viewer
            </p>
            <span
              className="text-sm text-gray-600 flex items-center"
              data-oid="443wa9o"
            >
              • Made with ❤️
              <a
                href="https://github.com/aisurf3r/Metadata-Viewer"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-gray-700 hover:text-blue-600 transition-colors"
                title="GitHub Repository"
                data-oid="w_denlr"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  data-oid="7tlbfj-"
                >
                  <path
                    d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"
                    data-oid="1eoh-to"
                  ></path>
                </svg>
              </a>
            </span>
          </div>
          <div
            className="flex space-x-4 mt-2 md:mt-0 items-center"
            data-oid="9uaw_:8"
          >
            <a
              href="#"
              className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
              data-oid="qh4r9hs"
            >
              Privacy
            </a>
            <a
              href="#"
              className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
              data-oid="ejyovqq"
            >
              Terms
            </a>
            <a
              href="#"
              className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
              data-oid="nmbx6a3"
            >
              Contact
            </a>
          </div>
        </div>
      </motion.footer>
    </div>
  );
}
export default App;
