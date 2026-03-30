package com.example.chatwithpdf.controller;

import com.example.chatwithpdf.service.OcrService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/ocr")
public class OcrController {

    private static final Set<String> IMAGE_TYPES = Set.of(
            "image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"
    );

    private final OcrService ocrService;

    public OcrController(OcrService ocrService) {
        this.ocrService = ocrService;
    }

    @PostMapping("/extract")
    public ResponseEntity<?> extractText(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "No file provided"));
        }

        String contentType = file.getContentType();
        if (contentType == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Unable to determine file type"));
        }

        String type = contentType.toLowerCase();
        boolean isImage = IMAGE_TYPES.contains(type);
        boolean isPdf = type.equals("application/pdf");

        if (!isImage && !isPdf) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Supported formats: PNG, JPG, WEBP, GIF, PDF"));
        }

        try {
            OcrService.OcrResult result = isPdf
                    ? ocrService.extractFromPdf(file)
                    : ocrService.extractFromImage(file);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to extract text: " + e.getMessage()));
        }
    }
}
