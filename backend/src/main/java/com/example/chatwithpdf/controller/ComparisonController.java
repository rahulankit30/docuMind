package com.example.chatwithpdf.controller;

import com.example.chatwithpdf.service.ComparisonService;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;

@RestController
@RequestMapping("/api/compare")
public class ComparisonController {

    private final ComparisonService comparisonService;

    public ComparisonController(ComparisonService comparisonService) {
        this.comparisonService = comparisonService;
    }

    record ComparisonRequest(String documentId1, String documentId2, String focusArea) {}

    @PostMapping(produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<String>> compare(@RequestBody ComparisonRequest request) {
        if (request.documentId1() == null || request.documentId1().isBlank()) {
            return Flux.just(ServerSentEvent.<String>builder()
                    .event("error").data("documentId1 is required").build());
        }
        if (request.documentId2() == null || request.documentId2().isBlank()) {
            return Flux.just(ServerSentEvent.<String>builder()
                    .event("error").data("documentId2 is required").build());
        }

        try {
            return comparisonService.compare(
                    request.documentId1(), request.documentId2(), request.focusArea());
        } catch (Exception e) {
            return Flux.just(ServerSentEvent.<String>builder()
                    .event("error").data("Comparison failed: " + e.getMessage()).build());
        }
    }
}
