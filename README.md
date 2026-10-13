# JPG・PNG ⇄ DICOM 轉換器

線上把 JPG／PNG 轉成 DICOM 或 DICOMDIR，也能把 DICOM 轉回 PNG／JPG。所有處理都在瀏覽器內完成，檔案不會上傳到任何伺服器。

**線上使用：** https://ron55663-bot.github.io/dicom-converter/

## 功能
- **圖片 → DICOM**：多張圖片、資料夾或 ZIP；可填病患／檢查資料；輸出 DICOMDIR 資料夾或個別 .dcm（ZIP 打包）。Secondary Capture、Explicit VR Little Endian、UTF-8 字元集。
- **DICOM → 圖片**：單檔、DICOMDIR 資料夾或 ZIP；PNG／JPG；窗寬窗位；多影格。支援未壓縮、RLE、JPEG Baseline、Deflate。

## 限制
JPEG 2000、JPEG-LS、JPEG Lossless 壓縮的 DICOM 視瀏覽器而定，通常無法解碼。轉出的影像為二次擷取，不適合作為正式診斷依據。
