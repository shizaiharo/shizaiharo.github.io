// Import JSZip in the worker context
importScripts(
  "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.7.1/jszip.min.js"
);

self.onmessage = async function (e) {
  const { files } = e.data;
  const zip = new JSZip();

  files.forEach((file) => {
    zip.file(file.fileName, file.fileData);
  });

  const startTime = Date.now();

  const zipBlob = await zip.generateAsync(
    { type: "blob", compression: "STORE" },
    (metadata) => {
      self.postMessage({
        type: "progress",
        percent: metadata.percent,
        startTime,
      });
    }
  );

  self.postMessage({ type: "done", zipBlob }, [zipBlob]);
};
