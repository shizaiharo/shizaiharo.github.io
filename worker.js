importScripts("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.7.1/jszip.min.js");

self.onmessage = async function (e) {
  const { action, files, password, folderName, zipIndex, MAX_ZIP_SIZE } = e.data;

  if (action === "encryptAndZip") {
    const zip = new JSZip();
    let currentZipSize = 0;
    let partIndex = zipIndex;

    const sortedFiles = files.sort((a, b) => {
      const numA = (a.name.match(/\d+/g) || []).map(Number);
      const numB = (b.name.match(/\d+/g) || []).map(Number);
      for (let i = 0; i < Math.max(numA.length, numB.length); i++) {
        if (numA[i] !== numB[i]) return (numA[i] || 0) - (numB[i] || 0);
      }
      return 0;
    });

    for (const file of sortedFiles) {
      if (file.name === ".DS_Store") continue;

      const fileSize = file.size;
      if (fileSize > MAX_ZIP_SIZE) {
        partIndex = await encryptAndUploadLargeFile(file, password, folderName, partIndex);
        continue;
      }

      if (currentZipSize + fileSize > MAX_ZIP_SIZE) {
        await processZip(zip, password, partIndex, folderName);
        zip = new JSZip();
        currentZipSize = 0;
        partIndex++;
      }

      const fileContent = await file.arrayBuffer();
      zip.file(file.webkitRelativePath || file.name, fileContent);
      currentZipSize += fileSize;
    }

    if (currentZipSize > 0) {
      await processZip(zip, password, partIndex, folderName);
    }

    self.postMessage({ status: "complete", folderName });
  }
};

async function processZip(zip, password, zipIndex, folderName) {
  const formattedZipIndex = String(zipIndex).padStart(5, "0");
  const zipBlob = await zip.generateAsync({ type: "blob", compression: "STORE" });
  const zipArrayBuffer = await zipBlob.arrayBuffer();

  const iv = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "AES-CTR" }, false, ["encrypt"]);

  const encryptedData = await crypto.subtle.encrypt({ name: "AES-CTR", counter: iv, length: 128 }, cryptoKey, zipArrayBuffer);

  const combinedData = new Uint8Array(iv.length + encryptedData.byteLength);
  combinedData.set(iv, 0);
  combinedData.set(new Uint8Array(encryptedData), iv.length);

  const base64CombinedData = btoa(String.fromCharCode(...combinedData));

  self.postMessage({
    status: "upload",
    folderName,
    zipIndex: formattedZipIndex,
    base64CombinedData,
  });
}
