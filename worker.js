importScripts(
  "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.7.1/jszip.min.js"
);

worker.onmessage = async function (e) {
  if (e.data.status === "upload") {
    await uploadToGitHub(
      e.data.folderName,
      e.data.zipIndex,
      e.data.base64CombinedData
    );
  } else if (e.data.status === "complete") {
    activeWorkers--;
    worker.isBusy = false; // Mark worker as free
    assignWork(); // Assign new work
  }
};

self.onmessage = async function (e) {
  const { action, folderName, zip, zipIndex, password } = e.data;

  if (action === "ZipEncrypt") {
    await processZip(zip, password, zipIndex, folderName);

    self.postMessage({ status: "complete", folderName, zipIndex });
    worker.isBusy = false;
    assignWork();
  }
};

async function processZip(zip, password, zipIndex, folderName) {
  const formattedZipIndex = String(zipIndex).padStart(5, "0");
  const zipBlob = await zip.generateAsync({
    type: "blob",
    compression: "STORE",
  });
  const zipArrayBuffer = await zipBlob.arrayBuffer();

  const iv = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(password)
  );
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "AES-CTR" },
    false,
    ["encrypt"]
  );

  const encryptedData = await crypto.subtle.encrypt(
    { name: "AES-CTR", counter: iv, length: 128 },
    cryptoKey,
    zipArrayBuffer
  );

  const combinedData = new Uint8Array(iv.length + encryptedData.byteLength);
  combinedData.set(iv, 0);
  combinedData.set(new Uint8Array(encryptedData), iv.length);

  const base64CombinedData = bufferToBase64(combinedData);

  self.postMessage({
    status: "upload",
    folderName,
    zipIndex: formattedZipIndex,
    base64CombinedData,
  });
}

function bufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// async function encryptAndUploadLargeFile(
//   file,
//   password,
//   folderName,
//   zipIndex,
//   MAX_ZIP_SIZE
// ) {
//   const chunkSize = MAX_ZIP_SIZE;
//   let start = 0;

//   while (start < file.size) {
//     const end = Math.min(start + chunkSize, file.size);
//     const chunk = file.slice(start, end);

//     let zip = new JSZip();
//     const chunkName = `${file.name}.part${zipIndex}`;
//     zip.file(chunkName, chunk); // Add this chunk as a single file in ZIP

//     console.warn(`Split file to part${zipIndex}: ${file.name}`);
//     await processZip(zip, password, zipIndex, folderName);

//     start = end;
//     zipIndex++;
//   }

//   return zipIndex;
// }
