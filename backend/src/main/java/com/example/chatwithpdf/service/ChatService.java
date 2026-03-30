package com.example.chatwithpdf.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class ChatService {

    private static final Logger log = LoggerFactory.getLogger(ChatService.class);
    private static final int TOP_K_PER_DOC = 5;
    private static final int MAX_TOP_K = 15;

    private final ChatClient chatClient;
    private final VectorStore vectorStore;

    public ChatService(ChatClient chatClient, VectorStore vectorStore) {
        this.chatClient = chatClient;
        this.vectorStore = vectorStore;
    }

    public record ChatResponse(String answer, List<SourceChunk> sources) {}
    public record SourceChunk(String content, Map<String, Object> metadata) {}
    public record StreamContext(Flux<String> contentStream, List<SourceChunk> sources) {}

    public ChatResponse chat(String documentId, String question) {
        return chat(List.of(documentId), question);
    }

    public ChatResponse chat(List<String> documentIds, String question) {
        log.info("Processing question for documents {}: '{}'", documentIds, question);

        List<Document> relevantDocs = retrieveChunks(documentIds, question);
        String context = buildContext(relevantDocs, documentIds.size() > 1);
        String systemPrompt = buildSystemPrompt(context, documentIds.size() > 1);

        String answer = chatClient.prompt()
                .system(systemPrompt)
                .user(question)
                .call()
                .content();

        List<SourceChunk> sources = relevantDocs.stream()
                .map(doc -> new SourceChunk(doc.getText(), doc.getMetadata()))
                .toList();

        return new ChatResponse(answer, sources);
    }

    public StreamContext chatStream(String documentId, String question) {
        return chatStream(List.of(documentId), question);
    }

    public StreamContext chatStream(List<String> documentIds, String question) {
        log.info("Streaming response for documents {}: '{}'", documentIds, question);

        List<Document> relevantDocs = retrieveChunks(documentIds, question);
        String context = buildContext(relevantDocs, documentIds.size() > 1);
        String systemPrompt = buildSystemPrompt(context, documentIds.size() > 1);

        Flux<String> contentStream = chatClient.prompt()
                .system(systemPrompt)
                .user(question)
                .stream()
                .content();

        List<SourceChunk> sources = relevantDocs.stream()
                .map(doc -> new SourceChunk(doc.getText(), doc.getMetadata()))
                .toList();

        return new StreamContext(contentStream, sources);
    }

    private List<Document> retrieveChunks(List<String> documentIds, String question) {
        String filterExpression = documentIds.stream()
                .map(id -> "documentId == '" + id + "'")
                .collect(Collectors.joining(" || "));

        int topK = Math.min(documentIds.size() * TOP_K_PER_DOC, MAX_TOP_K);

        SearchRequest searchRequest = SearchRequest.builder()
                .query(question)
                .topK(topK)
                .filterExpression(filterExpression)
                .build();

        List<Document> relevantDocs = vectorStore.similaritySearch(searchRequest);
        log.info("Found {} relevant chunks", relevantDocs.size());
        return relevantDocs;
    }

    private String buildContext(List<Document> docs, boolean multiDoc) {
        if (!multiDoc) {
            return docs.stream()
                    .map(Document::getText)
                    .collect(Collectors.joining("\n\n---\n\n"));
        }
        return docs.stream()
                .map(doc -> {
                    String filename = (String) doc.getMetadata().getOrDefault("filename", "Unknown");
                    return "[Source: " + filename + "]\n" + doc.getText();
                })
                .collect(Collectors.joining("\n\n---\n\n"));
    }

    private String buildSystemPrompt(String context, boolean multiDoc) {
        if (!multiDoc) {
            return """
                    You are a helpful assistant that answers questions based on the provided document context.
                    Use ONLY the information from the context below to answer the question.
                    If the context doesn't contain enough information to answer, say so clearly.
                    Be concise and accurate in your responses.
                    
                    Context:
                    %s
                    """.formatted(context);
        }
        return """
                You are a helpful assistant that answers questions based on the provided document context.
                The context comes from MULTIPLE documents. Each chunk is labeled with its source filename.
                Use ONLY the information from the context below to answer the question.
                When referencing information, mention which document it comes from.
                If the context doesn't contain enough information to answer, say so clearly.
                Be concise and accurate in your responses.
                
                Context:
                %s
                """.formatted(context);
    }
}
