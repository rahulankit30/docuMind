package com.example.chatwithpdf.service;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.ollama.api.OllamaOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.stereotype.Service;
import org.springframework.util.MimeType;
import org.springframework.util.MimeTypeUtils;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

@Service
public class OcrService {

    private static final Logger log = LoggerFactory.getLogger(OcrService.class);

    private final ChatClient chatClient;
    private final String visionModel;

    public OcrService(ChatClient chatClient,
                      @Value("${app.ocr.model:qwen2.5vl}") String visionModel) {
        this.chatClient = chatClient;
        this.visionModel = visionModel;
    }

    public record OcrResult(String text, String filename, int pageCount) {}

    private static final String EXTRACT_PROMPT = """
            Extract ALL text from this image. Preserve the original structure as much as possible:
            - Keep headings, paragraphs, and line breaks
            - Preserve bullet points and numbered lists
            - Recreate tables using plain text alignment
            - Maintain the reading order
            
            Return ONLY the extracted text, no commentary or explanations.
            """;

    public OcrResult extractFromImage(MultipartFile file) throws IOException {
        String filename = file.getOriginalFilename();
        log.info("Extracting text from image '{}' using model '{}'", filename, visionModel);

        byte[] imageBytes = file.getBytes();
        MimeType mimeType = MimeType.valueOf(file.getContentType());
        String extractedText = extractTextFromImageBytes(imageBytes, mimeType);

        log.info("Extracted {} characters from image '{}'", extractedText.length(), filename);
        return new OcrResult(extractedText, filename, 1);
    }

    public OcrResult extractFromPdf(MultipartFile file) throws IOException {
        String filename = file.getOriginalFilename();
        log.info("Extracting text from scanned PDF '{}' using model '{}'", filename, visionModel);

        List<String> pageTexts = new ArrayList<>();

        try (PDDocument document = Loader.loadPDF(file.getBytes())) {
            PDFRenderer renderer = new PDFRenderer(document);
            int totalPages = document.getNumberOfPages();
            log.info("PDF has {} pages, rendering each as image for OCR", totalPages);

            for (int i = 0; i < totalPages; i++) {
                log.info("Processing page {}/{}", i + 1, totalPages);
                BufferedImage image = renderer.renderImageWithDPI(i, 200);

                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                ImageIO.write(image, "png", baos);
                byte[] imageBytes = baos.toByteArray();

                String pageText = extractTextFromImageBytes(imageBytes, MimeTypeUtils.IMAGE_PNG);
                pageTexts.add(pageText);
            }
        }

        String combinedText = String.join("\n\n--- Page Break ---\n\n", pageTexts);
        log.info("Extracted {} characters from {} pages of PDF '{}'",
                combinedText.length(), pageTexts.size(), filename);

        return new OcrResult(combinedText, filename, pageTexts.size());
    }

    private String extractTextFromImageBytes(byte[] imageBytes, MimeType mimeType) {
        ByteArrayResource imageResource = new ByteArrayResource(imageBytes);

        return chatClient.prompt()
                .options(OllamaOptions.builder().model(visionModel).build())
                .user(u -> u.text(EXTRACT_PROMPT).media(mimeType, imageResource))
                .call()
                .content();
    }
}
