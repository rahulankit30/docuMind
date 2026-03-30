package com.example.chatwithpdf.controller;

import com.example.chatwithpdf.service.ChatService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/chat")
public class ChatController {

    private final ChatService chatService;
    private final ObjectMapper objectMapper;

    public ChatController(ChatService chatService, ObjectMapper objectMapper) {
        this.chatService = chatService;
        this.objectMapper = objectMapper;
    }

    record ChatRequest(String documentId, List<String> documentIds, String question) {}

    private List<String> resolveDocumentIds(ChatRequest request) {
        if (request.documentIds() != null && !request.documentIds().isEmpty()) {
            return request.documentIds();
        }
        if (request.documentId() != null && !request.documentId().isBlank()) {
            return List.of(request.documentId());
        }
        return List.of();
    }

    @PostMapping
    public ResponseEntity<?> chat(@RequestBody ChatRequest request) {
        List<String> docIds = resolveDocumentIds(request);
        if (docIds.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "documentId or documentIds is required"));
        }
        if (request.question() == null || request.question().isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "question is required"));
        }

        try {
            ChatService.ChatResponse response = chatService.chat(docIds, request.question());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to process question: " + e.getMessage()));
        }
    }

    @PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<String>> chatStream(@RequestBody ChatRequest request) {
        List<String> docIds = resolveDocumentIds(request);
        if (docIds.isEmpty()) {
            return Flux.just(ServerSentEvent.<String>builder()
                    .event("error").data("documentId or documentIds is required").build());
        }
        if (request.question() == null || request.question().isBlank()) {
            return Flux.just(ServerSentEvent.<String>builder()
                    .event("error").data("question is required").build());
        }

        try {
            ChatService.StreamContext ctx = chatService.chatStream(docIds, request.question());

            Flux<ServerSentEvent<String>> tokenEvents = ctx.contentStream()
                    .map(token -> ServerSentEvent.<String>builder()
                            .event("token").data(token).build());

            String sourcesJson;
            try {
                sourcesJson = objectMapper.writeValueAsString(ctx.sources());
            } catch (JsonProcessingException e) {
                sourcesJson = "[]";
            }
            String finalSourcesJson = sourcesJson;

            Flux<ServerSentEvent<String>> endEvents = Flux.just(
                    ServerSentEvent.<String>builder()
                            .event("sources").data(finalSourcesJson).build(),
                    ServerSentEvent.<String>builder()
                            .event("done").data("[DONE]").build()
            );

            return Flux.concat(tokenEvents, endEvents);
        } catch (Exception e) {
            return Flux.just(ServerSentEvent.<String>builder()
                    .event("error").data("Failed to process question: " + e.getMessage()).build());
        }
    }
}
