package com.example.chatwithpdf.service;

import com.example.chatwithpdf.model.PdfDocument;
import com.example.chatwithpdf.repository.PdfDocumentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.document.Document;
import org.springframework.ai.reader.pdf.PagePdfDocumentReader;
import org.springframework.ai.transformer.splitter.TokenTextSplitter;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.core.io.FileSystemResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class PdfIngestionService {

    private static final Logger log = LoggerFactory.getLogger(PdfIngestionService.class);

    private final VectorStore vectorStore;
    private final TokenTextSplitter textSplitter;
    private final PdfDocumentRepository documentRepository;

    public PdfIngestionService(VectorStore vectorStore, TokenTextSplitter textSplitter,
                               PdfDocumentRepository documentRepository) {
        this.vectorStore = vectorStore;
        this.textSplitter = textSplitter;
        this.documentRepository = documentRepository;
    }

    public PdfDocument ingest(MultipartFile file) throws IOException {
        String documentId = UUID.randomUUID().toString();
        log.info("Ingesting PDF '{}' with documentId={}", file.getOriginalFilename(), documentId);

        Path tempFile = Files.createTempFile("pdf-upload-", ".pdf");
        try {
            file.transferTo(tempFile.toFile());

            PagePdfDocumentReader reader = new PagePdfDocumentReader(
                    new FileSystemResource(tempFile.toFile()));
            List<Document> pages = reader.get();
            log.info("Extracted {} pages from PDF", pages.size());

            List<Document> chunks = textSplitter.apply(pages);
            log.info("Split into {} chunks", chunks.size());

            for (Document chunk : chunks) {
                chunk.getMetadata().put("documentId", documentId);
                chunk.getMetadata().put("filename", file.getOriginalFilename());
            }

            vectorStore.add(chunks);
            log.info("Stored {} chunks in vector store", chunks.size());

            PdfDocument pdfDocument = new PdfDocument(
                    documentId,
                    file.getOriginalFilename(),
                    pages.size(),
                    chunks.size(),
                    LocalDateTime.now()
            );
            pdfDocument.setChunkIds(chunks.stream().map(Document::getId).toList());
            documentRepository.save(pdfDocument);

            return pdfDocument;
        } finally {
            Files.deleteIfExists(tempFile);
        }
    }

    public List<PdfDocument> listDocuments() {
        return documentRepository.findAll();
    }

    public void deleteDocument(String documentId) {
        PdfDocument doc = documentRepository.findById(documentId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Document not found: " + documentId));

        if (!doc.getChunkIds().isEmpty()) {
            vectorStore.delete(doc.getChunkIds());
            log.info("Deleted {} chunks from vector store for document {}",
                    doc.getChunkIds().size(), documentId);
        }
        documentRepository.delete(doc);
    }
}
