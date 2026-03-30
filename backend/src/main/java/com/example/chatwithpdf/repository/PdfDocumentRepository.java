package com.example.chatwithpdf.repository;

import com.example.chatwithpdf.model.PdfDocument;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PdfDocumentRepository extends JpaRepository<PdfDocument, String> {
}
