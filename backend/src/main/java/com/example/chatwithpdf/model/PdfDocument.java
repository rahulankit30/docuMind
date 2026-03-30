package com.example.chatwithpdf.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "pdf_documents")
public class PdfDocument {

    @Id
    private String id;

    private String filename;

    private int pageCount;

    private int chunkCount;

    @Column(name = "uploaded_at")
    private LocalDateTime uploadedAt;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "pdf_chunk_ids", joinColumns = @JoinColumn(name = "document_id"))
    @Column(name = "chunk_id")
    private List<String> chunkIds = new ArrayList<>();

    public PdfDocument() {}

    public PdfDocument(String id, String filename, int pageCount, int chunkCount,
                       LocalDateTime uploadedAt) {
        this.id = id;
        this.filename = filename;
        this.pageCount = pageCount;
        this.chunkCount = chunkCount;
        this.uploadedAt = uploadedAt;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getFilename() { return filename; }
    public void setFilename(String filename) { this.filename = filename; }

    public int getPageCount() { return pageCount; }
    public void setPageCount(int pageCount) { this.pageCount = pageCount; }

    public int getChunkCount() { return chunkCount; }
    public void setChunkCount(int chunkCount) { this.chunkCount = chunkCount; }

    public LocalDateTime getUploadedAt() { return uploadedAt; }
    public void setUploadedAt(LocalDateTime uploadedAt) { this.uploadedAt = uploadedAt; }

    public List<String> getChunkIds() { return chunkIds; }
    public void setChunkIds(List<String> chunkIds) { this.chunkIds = chunkIds; }
}
