/* downloadFile(blobOrUint8Array, filename)
   – Saves any Blob | Uint8Array to the user’s disk.
-----------------------------------------------------*/
export default function downloadFile(data, filename = "file.txt") {
  const blob =
    data instanceof Blob ? data : new Blob([data], { type: "application/octet-stream" });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 2000); // tidy
}
