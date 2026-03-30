package com.example.chatwithpdf.service;

import com.example.chatwithpdf.repository.PdfDocumentRepository;
import com.example.chatwithpdf.model.PdfDocument;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class ComparisonService {

    private static final Logger log = LoggerFactory.getLogger(ComparisonService.class);
    private static final int CHUNKS_PER_DOC = 10;

    private final ChatClient chatClient;
    private final VectorStore vectorStore;
    private final PdfDocumentRepository documentRepository;

    public ComparisonService(ChatClient chatClient, VectorStore vectorStore,
                             PdfDocumentRepository documentRepository) {
        this.chatClient = chatClient;
        this.vectorStore = vectorStore;
        this.documentRepository = documentRepository;
    }

    public Flux<ServerSentEvent<String>> compare(String docId1, String docId2, String focusArea) {
        PdfDocument doc1 = documentRepository.findById(docId1)
                .orElseThrow(() -> new IllegalArgumentException("Document A not found: " + docId1));
        PdfDocument doc2 = documentRepository.findById(docId2)
                .orElseThrow(() -> new IllegalArgumentException("Document B not found: " + docId2));

        log.info("Comparing documents: '{}' vs '{}'", doc1.getFilename(), doc2.getFilename());

        String query = (focusArea != null && !focusArea.isBlank())
                ? focusArea
                : "summarize the main topics and key points";

        List<Document> chunksA = retrieveDocChunks(docId1, query);
        List<Document> chunksB = retrieveDocChunks(docId2, query);

        log.info("Retrieved {} chunks for doc A, {} chunks for doc B", chunksA.size(), chunksB.size());

        String contentA = chunksA.stream().map(Document::getText).collect(Collectors.joining("\n\n"));
        String contentB = chunksB.stream().map(Document::getText).collect(Collectors.joining("\n\n"));

        String systemPrompt = buildComparisonPrompt(
                doc1.getFilename(), contentA, doc2.getFilename(), contentB, focusArea);

        String userMessage = (focusArea != null && !focusArea.isBlank())
                ? "Compare these two documents, focusing on: " + focusArea
                : "Compare these two documents comprehensively.";

        Flux<String> contentStream = chatClient.prompt()
                .system(systemPrompt)
                .user(userMessage)
                .stream()
                .content();

        Flux<ServerSentEvent<String>> tokenEvents = contentStream
                .map(token -> ServerSentEvent.<String>builder()
                        .event("token").data(token).build());

        Flux<ServerSentEvent<String>> doneEvent = Flux.just(
                ServerSentEvent.<String>builder()
                        .event("done").data("[DONE]").build());

        return Flux.concat(tokenEvents, doneEvent);
    }

    private List<Document> retrieveDocChunks(String docId, String query) {
        SearchRequest request = SearchRequest.builder()
                .query(query)
                .topK(CHUNKS_PER_DOC)
                .filterExpression("documentId == '" + docId + "'")
                .build();
        return vectorStore.similaritySearch(request);
    }

    private String buildComparisonPrompt(String nameA, String contentA,
                                         String nameB, String contentB, String focusArea) {
        String focus = (focusArea != null && !focusArea.isBlank())
                ? "\nPay special attention to: " + focusArea
                : "";

        return """
                You are a document comparison expert. Analyze the two documents below and provide a structured comparison.
                
                Your analysis should include:
                1. **Key Similarities** — What the documents have in common
                2. **Key Differences** — Where the documents diverge
                3. **Unique to Document A** — Content or points only found in Document A
                4. **Unique to Document B** — Content or points only found in Document B
                5. **Overall Assessment** — A brief summary of how these documents relate to each other
                
                Use ONLY the provided content. If information is insufficient, say so clearly.
                Be thorough and specific in your analysis.
                %s
                
                === Document A: %s ===
                %s
                
                === Document B: %s ===
                %s
                """.formatted(focus, nameA, contentA, nameB, contentB);
    }
}
